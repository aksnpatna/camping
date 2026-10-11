import logging
import httpx
import hmac
import hashlib
from datetime import date
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.saved_trip import SavedTrip
from app.models.campsite import Campsite
from app.models.plan_b_alert import PlanBAlert
from app.services.news_scraper import check_campsite_news
from app.services.email_service import email_service

logger = logging.getLogger(__name__)

def dispatch_alert_email(trip: SavedTrip, campsite_name: str, details: str, alts: list) -> bool:
    secret = (settings.SECRET_KEY or "dev-secret-key").encode()
    token = hmac.new(secret, trip.user_email.strip().lower().encode(), hashlib.sha256).hexdigest()
    switch_url = f"{settings.FRONTEND_URL.rstrip('/')}/?email={trip.user_email.strip().lower()}&token={token}"
    try:
        return email_service.send_plan_b_alert(
            recipient_email=trip.user_email,
            trip_name=campsite_name,
            reason=details,
            switch_url=switch_url,
            alternatives=alts
        )
    except Exception as err:
        logger.error(f"Failed to send Plan B alert email to {trip.user_email}: {err}")
        return False

def find_plan_b_alternatives(db, trip: SavedTrip, original_campsite: Campsite):
    query = db.query(Campsite).filter(Campsite.id != original_campsite.id)
    if trip.has_dog is True:
        query = query.filter(Campsite.dog_friendly == True)
    
    # Prioritize same state first
    candidates = query.filter(Campsite.state == original_campsite.state).limit(3).all()
    if len(candidates) < 2:
        additional = query.filter(Campsite.state != original_campsite.state).limit(2).all()
        candidates.extend(additional)

    alternatives = []
    for c in candidates[:2]:
        alternatives.append({
            "id": c.id,
            "name": c.name,
            "state": c.state,
            "management_type": c.management_type or "Verified",
            "dog_friendly": c.dog_friendly,
            "reason": f"Stable alternative in {c.state} matching your party requirements."
        })
    return alternatives

def run_plan_b_check():
    logger.info("Running Plan B Monitor Check (Single Pass)...")
    with SessionLocal() as db:
        today = date.today()
        # Fetch active trips
        trips = db.query(SavedTrip, Campsite).join(Campsite).filter(
            SavedTrip.plan_b_alert_active == True,
            SavedTrip.start_date >= today
        ).all()

        for trip, campsite in trips:
            logger.info(f"Checking trip to {campsite.name} from {trip.start_date} to {trip.end_date}...")
            
            # 1. Check weather (synchronous httpx client for background worker)
            try:
                with httpx.Client() as client:
                    res = client.get(
                        f"https://api.open-meteo.com/v1/forecast?latitude={campsite.latitude}&longitude={campsite.longitude}&daily=temperature_2m_max,precipitation_probability_max&timezone=auto&start_date={trip.start_date}&end_date={trip.end_date}"
                    )
                    
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("daily"):
                            max_rain_prob = max(data["daily"]["precipitation_probability_max"])
                            max_temp = max(data["daily"]["temperature_2m_max"])
                            
                            if max_rain_prob >= 70 or max_temp >= 35:
                                details = (
                                    f"Weather alert for {trip.user_email} at {campsite.name}. "
                                    f"Rain Prob: {max_rain_prob}%, Max Temp: {max_temp}°C"
                                )
                                logger.warning(f"PLAN B ALERT! {details}")
                                alts = find_plan_b_alternatives(db, trip, campsite)
                                sent_ok = dispatch_alert_email(trip, campsite.name, details, alts)
                                alert = PlanBAlert(
                                    saved_trip_id=trip.id,
                                    user_email=trip.user_email,
                                    campsite_id=campsite.id,
                                    alert_type="WEATHER_WARNING",
                                    details=details,
                                    delivery_status="SENT" if sent_ok else "FAILED",
                                    retry_count=0 if sent_ok else 1,
                                    suggested_alternatives=alts
                                )
                                db.add(alert)
                                # Preserve trip.plan_b_alert_active = True for persistent condition monitoring
                                db.commit()
                                continue  # Skip news if weather already triggered
                            else:
                                logger.info(f"Weather looks good for {campsite.name}.")
            except Exception as e:
                logger.error(f"Weather check failed for {campsite.name}: {e}")
                
            # 2. Check DuckDuckGo / Tavily for news alerts (fires, closures)
            try:
                news_data = check_campsite_news(campsite.name, campsite.state)
                if news_data and news_data.get("results"):
                    alert_keywords = ["fire", "flood", "closed", "closure", "warning", "evacuate"]
                    for result in news_data["results"]:
                        text = (result.get("title", "") + " " + result.get("body", "")).lower()
                        if any(kw in text for kw in alert_keywords):
                            alert_type = "FIRE_DANGER" if "fire" in text else "PARK_CLOSURE"
                            details = f"Danger alert for {campsite.name}: {result['title']} ({result['source']})"
                            logger.warning(f"PLAN B ALERT! {details}")
                            alts = find_plan_b_alternatives(db, trip, campsite)
                            sent_ok = dispatch_alert_email(trip, campsite.name, details, alts)
                            alert = PlanBAlert(
                                saved_trip_id=trip.id,
                                user_email=trip.user_email,
                                campsite_id=campsite.id,
                                alert_type=alert_type,
                                details=details,
                                delivery_status="SENT" if sent_ok else "FAILED",
                                retry_count=0 if sent_ok else 1,
                                suggested_alternatives=alts
                            )
                            db.add(alert)
                            # Preserve trip.plan_b_alert_active = True for persistent condition monitoring
                            db.commit()
                            break
            except Exception as e:
                logger.error(f"News check failed for {campsite.name}: {e}")

