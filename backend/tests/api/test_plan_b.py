import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.campsite import Campsite
from app.models.plan_b_alert import PlanBAlert
from app.models.saved_trip import SavedTrip
from app.services.email_service import email_service
from app.worker.plan_b import find_plan_b_alternatives, run_plan_b_check

client = TestClient(app)


def _weather_mock(rain_probs, temps):
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "daily": {
            "temperature_2m_max": temps,
            "precipitation_probability_max": rain_probs,
        }
    }
    return response


def _alert_emails_to(address: str):
    """Plan B alert emails only — the sign-in link issued during setup is not an alert."""
    return [
        m
        for m in email_service.outbox
        if m["to_email"] == address and "Plan B Alert" in m["subject"]
    ]


def test_plan_b_creates_persistent_alerts_with_alternatives(magic_token_for):
    email = f"camper_watch_{uuid.uuid4().hex[:8]}@example.com"
    token = magic_token_for(client, email)

    campsites_res = client.get("/api/v1/campsites")
    assert campsites_res.status_code == 200
    campsites = campsites_res.json()
    assert len(campsites) >= 3
    primary_campsite_id = campsites[0]["id"]

    start = date.today() + timedelta(days=5)
    end = start + timedelta(days=2)

    # 1. Create a SavedTrip with original constraints preserved
    create_res = client.post("/api/v1/saved-trips", json={
        "campsite_id": primary_campsite_id,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "plan_b_alert_active": True,
        "party_size": 2
    })
    assert create_res.status_code == 200
    trip_id = create_res.json()["id"]

    # 2. Mock weather showing severe storm / high rain probability
    with patch("httpx.Client.get", return_value=_weather_mock([85, 90], [24.0, 26.0])):
        run_plan_b_check()

    # 3. Verify persistent PlanBAlert in database
    with SessionLocal() as db:
        alerts = db.query(PlanBAlert).filter(PlanBAlert.saved_trip_id == trip_id).all()
        assert len(alerts) >= 1
        alert = alerts[0]
        assert alert.alert_type == "WEATHER_WARNING"
        assert "Rain Prob" in alert.details or "Weather alert" in alert.details
        # Outbox transport records the truth: queued, never claimed as sent.
        assert alert.delivery_status == "QUEUED_OUTBOX"
        assert alert.severity >= 1
        assert len(alert.suggested_alternatives) >= 2
        alt_ids = [a["id"] for a in alert.suggested_alternatives]
        assert primary_campsite_id not in alt_ids

        # Monitoring remains active (persistence without spam)
        db_trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
        assert db_trip.plan_b_alert_active is True

    assert len(_alert_emails_to(email)) == 1

    # 4. Dashboard returns persistent alerts and alternatives
    dash_res = client.get(f"/api/v1/saved-trips/dashboard/{email}?token={token}")
    assert dash_res.status_code == 200
    dash_trips = dash_res.json()
    target_trip = next(t for t in dash_trips if t["id"] == trip_id)
    assert len(target_trip["alerts"]) >= 1
    assert len(target_trip["alerts"][0]["suggested_alternatives"]) >= 2


def test_unchanged_condition_is_not_re_alerted_but_escalation_is(magic_token_for):
    """Regression guard for hourly alert spam: persistence must not be achieved by
    emailing the camper on every worker pass."""
    email = f"camper_dedupe_{uuid.uuid4().hex[:8]}@example.com"
    magic_token_for(client, email)

    campsites = client.get("/api/v1/campsites").json()
    primary_campsite_id = campsites[0]["id"]

    start = date.today() + timedelta(days=5)
    end = start + timedelta(days=2)

    trip_res = client.post("/api/v1/saved-trips", json={
        "campsite_id": primary_campsite_id,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "plan_b_alert_active": True
    })
    trip_id = trip_res.json()["id"]

    unchanged = _weather_mock([85, 88], [24.0, 26.0])
    with patch("httpx.Client.get", return_value=unchanged):
        run_plan_b_check()
        run_plan_b_check()
        run_plan_b_check()

    with SessionLocal() as db:
        alerts = (
            db.query(PlanBAlert)
            .filter(PlanBAlert.saved_trip_id == trip_id, PlanBAlert.alert_type == "WEATHER_WARNING")
            .all()
        )
        assert len(alerts) == 1, "an unchanged condition must not create repeat alerts"
        assert alerts[0].severity == 2
        assert db.query(SavedTrip).filter(SavedTrip.id == trip_id).first().plan_b_alert_active is True

    assert len(_alert_emails_to(email)) == 1, "an unchanged condition must not re-email the camper"

    # A genuine worsening still gets through the cooldown.
    worse = _weather_mock([96, 97], [44.0, 45.0])
    with patch("httpx.Client.get", return_value=worse):
        run_plan_b_check()

    with SessionLocal() as db:
        alerts = (
            db.query(PlanBAlert)
            .filter(PlanBAlert.saved_trip_id == trip_id, PlanBAlert.alert_type == "WEATHER_WARNING")
            .order_by(PlanBAlert.id)
            .all()
        )
        assert len(alerts) == 2, "a worsening condition must break the cooldown"
        assert [a.severity for a in alerts] == [2, 3]

    assert len(_alert_emails_to(email)) == 2


def test_alternatives_respect_saved_drive_limit():
    with SessionLocal() as db:
        original = db.query(Campsite).first()
        assert db.query(Campsite).count() >= 3

        email = f"camper_intent_{uuid.uuid4().hex[:8]}@example.com"
        start = date.today() + timedelta(days=6)
        trip = SavedTrip(
            campsite_id=original.id,
            user_email=email,
            start_date=start,
            end_date=start + timedelta(days=2),
            plan_b_alert_active=False,
            origin_lat=-33.8688,
            origin_lng=151.2093,
            max_drive_hours=1.5,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        alts = find_plan_b_alternatives(db, trip, original)
        for alt in alts:
            assert alt["id"] != original.id
            assert alt["driving_time_minutes"] is not None
            assert alt["driving_time_minutes"] <= 90, "must not suggest beyond the saved drive limit"
            assert "conditions_verified" in alt
            # No unverifiable claims: party capacity is not in the data model.
            assert "party requirements" not in alt["reason"]
            assert "matching your party" not in alt["reason"]


def test_alternatives_honour_dog_requirement():
    with SessionLocal() as db:
        dog_sites = db.query(Campsite).filter(Campsite.dog_friendly == True).count()
        assert dog_sites >= 2, "seed should contain multiple dog-friendly sites"

        original = db.query(Campsite).first()
        email = f"camper_dog_{uuid.uuid4().hex[:8]}@example.com"
        start = date.today() + timedelta(days=6)
        trip = SavedTrip(
            campsite_id=original.id,
            user_email=email,
            start_date=start,
            end_date=start + timedelta(days=2),
            plan_b_alert_active=False,
            has_dog=True,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        alts = find_plan_b_alternatives(db, trip, original)
        assert len(alts) >= 1
        for alt in alts:
            assert alt["dog_friendly"] is True


def test_alternative_reason_never_claims_unverified_stability():
    with SessionLocal() as db:
        original = db.query(Campsite).first()
        email = f"camper_reason_{uuid.uuid4().hex[:8]}@example.com"
        start = date.today() + timedelta(days=6)
        trip = SavedTrip(
            campsite_id=original.id,
            user_email=email,
            start_date=start,
            end_date=start + timedelta(days=2),
            plan_b_alert_active=False,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        # A forecast the engine cannot read must produce an honest "not verified".
        broken = MagicMock()
        broken.status_code = 500
        with patch("httpx.Client.get", return_value=broken):
            alts = find_plan_b_alternatives(db, trip, original)

        assert len(alts) >= 1
        for alt in alts:
            assert alt["conditions_verified"] is False
            assert "not yet verified" in alt["reason"]
            assert "stable" not in alt["reason"].lower()


def test_switch_campsite_to_alternative(magic_token_for):
    email = f"camper_switch_{uuid.uuid4().hex[:8]}@example.com"
    token = magic_token_for(client, email)

    campsites = client.get("/api/v1/campsites").json()
    orig_site = campsites[0]["id"]
    new_site = campsites[1]["id"]

    start = date.today() + timedelta(days=7)
    end = start + timedelta(days=2)

    trip_res = client.post("/api/v1/saved-trips", json={
        "campsite_id": orig_site,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "plan_b_alert_active": True
    })
    trip_id = trip_res.json()["id"]

    # Unauthorized switch without token should be 401
    unauth = client.post(f"/api/v1/saved-trips/{trip_id}/switch-campsite", json={
        "new_campsite_id": new_site
    })
    assert unauth.status_code == 401

    # Authorized switch with a real issued token
    switch_res = client.post(f"/api/v1/saved-trips/{trip_id}/switch-campsite?token={token}", json={
        "new_campsite_id": new_site
    })
    assert switch_res.status_code == 200
    assert switch_res.json()["campsite_id"] == new_site


def test_simulate_alert_creates_alternatives(magic_token_for):
    email = f"camper_sim_{uuid.uuid4().hex[:8]}@example.com"
    token = magic_token_for(client, email)

    campsites = client.get("/api/v1/campsites").json()
    site_id = campsites[0]["id"]

    start = date.today() + timedelta(days=12)
    end = start + timedelta(days=2)

    trip_res = client.post("/api/v1/saved-trips", json={
        "campsite_id": site_id,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "plan_b_alert_active": True
    })
    trip_id = trip_res.json()["id"]

    sim_res = client.post(f"/api/v1/saved-trips/{trip_id}/simulate-alert?token={token}", json={
        "alert_type": "WEATHER_WARNING",
        "reason": "Severe gale warnings and high fire danger in region"
    })
    assert sim_res.status_code == 200
    alert_data = sim_res.json()
    assert alert_data["alert_type"] == "WEATHER_WARNING"
    assert "Severe gale" in alert_data["details"]
    assert alert_data["delivery_status"] == "QUEUED_OUTBOX"
    assert len(alert_data["suggested_alternatives"]) >= 2
    assert site_id not in [a["id"] for a in alert_data["suggested_alternatives"]]
