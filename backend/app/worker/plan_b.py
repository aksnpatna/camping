import logging
import httpx
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from app.core.database import SessionLocal
from app.models.saved_trip import SavedTrip
from app.models.campsite import Campsite
from app.models.plan_b_alert import PlanBAlert
from app.services.news_scraper import check_campsite_news
from app.services.email_service import email_service, STATUS_SENT, STATUS_FAILED
from app.services.magic_link import build_magic_link, issue_magic_token
from app.services.recommendation_engine import RecommendationEngine

logger = logging.getLogger(__name__)

# A camper is re-alerted only when the condition genuinely worsens, never merely
# because the hourly pass observed the same bad weather again.
ALERT_COOLDOWN_HOURS = 24

# Alert trigger thresholds (PLAN.md Plan B engine)
RAIN_ALERT_THRESHOLD = 70
TEMP_ALERT_THRESHOLD = 35

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def weather_severity(max_rain_prob: Optional[int], max_temp: Optional[float]) -> int:
    """Coarse escalation level so a worsening condition can break the cooldown."""
    rain = max_rain_prob or 0
    temp = max_temp or 0.0
    if rain >= 95 or temp >= 42:
        return 3
    if rain >= 85 or temp >= 38:
        return 2
    return 1


def fetch_window_forecast(
    latitude: float,
    longitude: float,
    start_date,
    end_date,
    timeout: float = 4.0,
) -> Optional[Dict[str, Any]]:
    """
    Real Open-Meteo forecast for the trip window. Returns None when the forecast
    cannot be obtained, so callers can say "not verified" instead of guessing.
    """
    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.get(
                f"{OPEN_METEO_FORECAST_URL}?latitude={latitude}&longitude={longitude}"
                f"&daily=temperature_2m_max,precipitation_probability_max"
                f"&timezone=auto&start_date={start_date}&end_date={end_date}"
            )
        if res.status_code != 200:
            return None

        daily = (res.json() or {}).get("daily") or {}
        rain_values = [v for v in (daily.get("precipitation_probability_max") or []) if v is not None]
        temp_values = [v for v in (daily.get("temperature_2m_max") or []) if v is not None]
        if not rain_values or not temp_values:
            return None

        max_rain_prob = int(max(rain_values))
        max_temp = float(max(temp_values))
        return {
            "max_rain_prob": max_rain_prob,
            "max_temp": max_temp,
            "severe": max_rain_prob >= RAIN_ALERT_THRESHOLD or max_temp >= TEMP_ALERT_THRESHOLD,
        }
    except Exception as e:
        logger.warning("Forecast fetch failed for (%s, %s): %s", latitude, longitude, e)
        return None


def should_dispatch_alert(
    db,
    trip_id: int,
    alert_type: str,
    severity: int,
    source_url: Optional[str] = None,
) -> bool:
    """
    Throttle repeat alerts. Monitoring stays active across alerts, but an
    unchanged condition must not email the camper on every hourly pass.
    """
    base = db.query(PlanBAlert).filter(
        PlanBAlert.saved_trip_id == trip_id,
        PlanBAlert.alert_type == alert_type,
    )

    # One alert per matched news source, ever, for this trip.
    if source_url:
        if base.filter(PlanBAlert.source_url == source_url).first() is not None:
            return False

    cutoff = datetime.utcnow() - timedelta(hours=ALERT_COOLDOWN_HOURS)
    recent = (
        base.filter(PlanBAlert.triggered_at >= cutoff)
        .order_by(PlanBAlert.triggered_at.desc())
        .first()
    )
    if recent is None:
        return True

    # Allow through only a genuine worsening.
    return severity > (recent.severity or 1)


def describe_alternative(
    site: Campsite,
    drive_mins: Optional[int],
    forecast: Optional[Dict[str, Any]],
) -> str:
    """
    Build the reason string only from facts that were actually checked. No claim
    of stability is made unless this candidate's own forecast was retrieved.
    """
    facts: List[str] = []

    if drive_mins is not None:
        facts.append(f"{drive_mins // 60}h {drive_mins % 60}m drive from your saved origin")
    if site.dog_friendly is True:
        facts.append("dog friendly")

    if forecast is None:
        facts.append("conditions not yet verified for your dates")
    elif forecast["severe"]:
        facts.append(
            f"also affected by this system ({forecast['max_rain_prob']}% rain chance, "
            f"{forecast['max_temp']:.0f}°C max) — verify before switching"
        )
    else:
        facts.append(
            f"forecast stays clear for your dates ({forecast['max_rain_prob']}% rain chance, "
            f"{forecast['max_temp']:.0f}°C max)"
        )

    sentence = "; ".join(facts)
    return sentence[:1].upper() + sentence[1:]


def find_plan_b_alternatives(db, trip: SavedTrip, original_campsite: Optional[Campsite], limit: int = 2):
    """
    Alternatives that still honour the camper's saved intent, ranked by real
    proximity, with each candidate's own forecast checked before it is described.
    """
    if original_campsite is None:
        return []

    query = db.query(Campsite).filter(Campsite.id != original_campsite.id)
    if trip.has_dog is True:
        query = query.filter(Campsite.dog_friendly == True)

    has_origin = trip.origin_lat is not None and trip.origin_lng is not None
    max_hours = float(trip.max_drive_hours) if trip.max_drive_hours else None

    scored = []
    for site in query.all():
        # Honour the saved rig requirement when both sides declare one.
        if trip.rig_access and site.rig_access and trip.rig_access not in site.rig_access:
            continue

        # Always measurable, and it preserves the geography of the trip being
        # replaced even when no origin was saved.
        site_km, site_mins = RecommendationEngine.get_driving_stats(
            original_campsite.latitude,
            original_campsite.longitude,
            site.latitude,
            site.longitude,
        )

        origin_mins = None
        if has_origin:
            _, origin_mins = RecommendationEngine.get_driving_stats(
                trip.origin_lat, trip.origin_lng, site.latitude, site.longitude
            )
            # Never suggest anything beyond the camper's saved drive limit.
            if max_hours and (origin_mins / 60.0) > max_hours:
                continue

        scored.append((site, site_mins, origin_mins, site_km))

    scored.sort(key=lambda item: item[2] if item[2] is not None else item[1])

    # Sample candidates with corridor diversity:
    # Evaluating only immediate neighbors traps the camper in the same local storm.
    # We sample the closest candidate plus regional escape candidates (>=35km and >=65km away).
    candidates_to_check = []
    seen_ids = set()

    if scored:
        candidates_to_check.append(scored[0])
        seen_ids.add(scored[0][0].id)

    escape_35 = next((item for item in scored if item[0].id not in seen_ids and item[3] >= 35), None)
    if escape_35:
        candidates_to_check.append(escape_35)
        seen_ids.add(escape_35[0].id)

    escape_65 = next((item for item in scored if item[0].id not in seen_ids and item[3] >= 65), None)
    if escape_65:
        candidates_to_check.append(escape_65)
        seen_ids.add(escape_65[0].id)

    for item in scored:
        if len(candidates_to_check) >= 5:
            break
        if item[0].id not in seen_ids:
            candidates_to_check.append(item)
            seen_ids.add(item[0].id)

    alternatives = []
    for site, site_mins, origin_mins, site_km in candidates_to_check:
        forecast = fetch_window_forecast(site.latitude, site.longitude, trip.start_date, trip.end_date)
        drive_mins = origin_mins if origin_mins is not None else None
        alternatives.append({
            "id": site.id,
            "name": site.name,
            "state": site.state,
            "management_type": site.management_type or "Verified",
            "dog_friendly": site.dog_friendly,
            "driving_time_minutes": drive_mins,
            "conditions_verified": forecast is not None,
            "reason": describe_alternative(site, drive_mins, forecast),
        })

    # Prefer candidates whose own forecast is clear, then fall back to the rest.
    alternatives.sort(key=lambda a: 0 if (a["conditions_verified"] and "also affected" not in a["reason"]) else 1)
    return alternatives[:limit]


def dispatch_alert_email(db, trip: SavedTrip, campsite_name: str, details: str, alts: list) -> str:
    """
    Send the Plan B alert and return the true delivery outcome. The switch link
    carries a freshly issued, expiring token — never a derived or permanent one.
    """
    try:
        token = issue_magic_token(db, trip.user_email)
        switch_url = build_magic_link(trip.user_email.strip().lower(), token)
        return email_service.send_plan_b_alert(
            recipient_email=trip.user_email,
            trip_name=campsite_name,
            reason=details,
            switch_url=switch_url,
            alternatives=alts,
        )
    except Exception as err:
        logger.error("Failed to send Plan B alert email to %s: %s", trip.user_email, err)
        return STATUS_FAILED


def run_plan_b_check():
    logger.info("Running Plan B Monitor Check (Single Pass)...")
    with SessionLocal() as db:
        today = date.today()
        trips = (
            db.query(SavedTrip, Campsite)
            .join(Campsite)
            .filter(SavedTrip.plan_b_alert_active == True, SavedTrip.start_date >= today)
            .all()
        )

        for trip, campsite in trips:
            logger.info("Checking trip to %s from %s to %s...", campsite.name, trip.start_date, trip.end_date)

            # 1. Weather over the actual trip window
            forecast = fetch_window_forecast(
                campsite.latitude, campsite.longitude, trip.start_date, trip.end_date, timeout=8.0
            )
            if forecast and forecast["severe"]:
                severity = weather_severity(forecast["max_rain_prob"], forecast["max_temp"])

                if not should_dispatch_alert(db, trip.id, "WEATHER_WARNING", severity):
                    logger.info(
                        "Suppressing repeat WEATHER_WARNING for trip %s (severity %s unchanged "
                        "within %sh cooldown). Monitoring remains active.",
                        trip.id, severity, ALERT_COOLDOWN_HOURS,
                    )
                    continue

                details = (
                    f"Weather alert for {trip.user_email} at {campsite.name}. "
                    f"Rain Prob: {forecast['max_rain_prob']}%, Max Temp: {forecast['max_temp']:.0f}°C"
                )
                logger.warning("PLAN B ALERT! %s", details)

                alts = find_plan_b_alternatives(db, trip, campsite)
                delivery_status = dispatch_alert_email(db, trip, campsite.name, details, alts)

                db.add(PlanBAlert(
                    saved_trip_id=trip.id,
                    user_email=trip.user_email,
                    campsite_id=campsite.id,
                    alert_type="WEATHER_WARNING",
                    details=details,
                    delivery_status=delivery_status,
                    retry_count=0 if delivery_status == STATUS_SENT else 1,
                    severity=severity,
                    suggested_alternatives=alts,
                ))
                # Monitoring stays active: persistence must not be achieved by
                # silencing the camper, nor by spamming them hourly.
                db.commit()
                continue
            elif forecast:
                logger.info("Weather looks good for %s.", campsite.name)

            # 2. News scan for fires / closures (unvetted signal — labelled as such)
            try:
                news_data = check_campsite_news(campsite.name, campsite.state)
                if news_data and news_data.get("results"):
                    alert_keywords = ["fire", "flood", "closed", "closure", "warning", "evacuate"]
                    for result in news_data["results"]:
                        title = result.get("title") or ""
                        body = result.get("body") or ""
                        text = f"{title} {body}".lower()
                        if not any(kw in text for kw in alert_keywords):
                            continue

                        alert_type = "FIRE_DANGER" if "fire" in text else "PARK_CLOSURE"
                        source_url = result.get("url") or result.get("source")
                        severity = 2

                        if not should_dispatch_alert(db, trip.id, alert_type, severity, source_url=source_url):
                            logger.info(
                                "Suppressing duplicate %s for trip %s (source already alerted: %s)",
                                alert_type, trip.id, source_url,
                            )
                            continue

                        details = (
                            f"Unverified condition signal for {campsite.name}: {title} "
                            f"({result.get('source')}). Confirm with the official park or fire "
                            f"authority before travelling."
                        )
                        logger.warning("PLAN B ALERT! %s", details)

                        alts = find_plan_b_alternatives(db, trip, campsite)
                        delivery_status = dispatch_alert_email(db, trip, campsite.name, details, alts)

                        db.add(PlanBAlert(
                            saved_trip_id=trip.id,
                            user_email=trip.user_email,
                            campsite_id=campsite.id,
                            alert_type=alert_type,
                            details=details,
                            delivery_status=delivery_status,
                            retry_count=0 if delivery_status == STATUS_SENT else 1,
                            severity=severity,
                            source_url=source_url,
                            suggested_alternatives=alts,
                        ))
                        db.commit()
                        break
            except Exception as e:
                logger.error("News check failed for %s: %s", campsite.name, e)
