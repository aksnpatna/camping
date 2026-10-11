import uuid
import os
import hmac
import hashlib
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.campsite import Campsite
from app.models.saved_trip import SavedTrip
from app.models.plan_b_alert import PlanBAlert
from app.worker.plan_b import run_plan_b_check

client = TestClient(app)

def get_magic_token(email: str) -> str:
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    return hmac.new(secret, email.encode(), hashlib.sha256).hexdigest()

def test_plan_b_creates_persistent_alerts_with_alternatives():
    email = f"camper_watch_{uuid.uuid4().hex[:8]}@example.com"
    token = get_magic_token(email)

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
        "dog_friendly": True,
        "party_size": 2
    })
    assert create_res.status_code == 200
    trip_id = create_res.json()["id"]

    # 2. Mock weather response showing severe storm / high rain probability (85%)
    mock_weather_response = MagicMock()
    mock_weather_response.status_code = 200
    mock_weather_response.json.return_value = {
        "daily": {
            "temperature_2m_max": [24.0, 26.0],
            "precipitation_probability_max": [85, 90]
        }
    }

    with patch("httpx.Client.get", return_value=mock_weather_response):
        # Run worker pass
        run_plan_b_check()

    # 3. Verify persistent PlanBAlert in database
    with SessionLocal() as db:
        alerts = db.query(PlanBAlert).filter(PlanBAlert.saved_trip_id == trip_id).all()
        assert len(alerts) >= 1
        alert = alerts[0]
        assert alert.alert_type == "WEATHER_WARNING"
        assert "Rain Prob" in alert.details or "Weather alert" in alert.details
        assert alert.delivery_status == "SENT"
        assert len(alert.suggested_alternatives) >= 2
        # Alternative sites should not be the primary site
        alt_ids = [a["id"] for a in alert.suggested_alternatives]
        assert primary_campsite_id not in alt_ids

        # Verify plan_b_alert_active remains True (monitoring is persistent)
        db_trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
        assert db_trip.plan_b_alert_active is True

    # 4. Verify Dashboard endpoint returns persistent alerts and alternatives
    dash_res = client.get(f"/api/v1/saved-trips/dashboard/{email}?token={token}")
    assert dash_res.status_code == 200
    dash_trips = dash_res.json()
    assert len(dash_trips) >= 1
    target_trip = next(t for t in dash_trips if t["id"] == trip_id)
    assert "alerts" in target_trip
    assert len(target_trip["alerts"]) >= 1
    assert len(target_trip["alerts"][0]["suggested_alternatives"]) >= 2

def test_switch_campsite_to_alternative():
    email = f"camper_switch_{uuid.uuid4().hex[:8]}@example.com"
    token = get_magic_token(email)

    campsites = client.get("/api/v1/campsites").json()
    orig_site = campsites[0]["id"]
    new_site = campsites[1]["id"]

    start = date.today() + timedelta(days=7)
    end = start + timedelta(days=2)

    # Create trip
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

    # Authorized switch with token
    switch_res = client.post(f"/api/v1/saved-trips/{trip_id}/switch-campsite?token={token}", json={
        "new_campsite_id": new_site
    })
    assert switch_res.status_code == 200
    updated_trip = switch_res.json()
    assert updated_trip["campsite_id"] == new_site

def test_simulate_alert_creates_alternatives():
    email = f"camper_sim_{uuid.uuid4().hex[:8]}@example.com"
    token = get_magic_token(email)

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
    assert alert_data["delivery_status"] == "SENT"
    assert len(alert_data["suggested_alternatives"]) >= 2
    assert site_id not in [a["id"] for a in alert_data["suggested_alternatives"]]

