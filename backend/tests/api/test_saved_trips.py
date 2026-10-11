import hmac
import hashlib
import os
import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_magic_token(email: str) -> str:
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    return hmac.new(secret, email.encode(), hashlib.sha256).hexdigest()

def test_read_saved_trips_requires_auth():
    email = f"unauthed_{uuid.uuid4().hex[:8]}@example.com"
    # Unauthenticated should fail with 403
    res = client.get(f"/api/v1/saved-trips/{email}")
    assert res.status_code == 403

def test_read_saved_trips_invalid_token():
    email = f"invalid_{uuid.uuid4().hex[:8]}@example.com"
    res = client.get(f"/api/v1/saved-trips/{email}?token=bad-token")
    assert res.status_code == 403

def test_create_and_read_saved_trip():
    email = f"v2camper_{uuid.uuid4().hex[:8]}@example.com"
    token = get_magic_token(email)

    
    # First get an existing campsite id
    campsites_res = client.get("/api/v1/campsites")
    assert campsites_res.status_code == 200
    campsite_id = campsites_res.json()[0]["id"]
    
    today = date.today() + timedelta(days=30)
    end = today + timedelta(days=2)
    
    # Create saved trip
    payload = {
        "campsite_id": campsite_id,
        "user_email": email,
        "start_date": today.isoformat(),
        "end_date": end.isoformat(),
        "plan_b_alert_active": True
    }
    create_res = client.post("/api/v1/saved-trips", json=payload)
    assert create_res.status_code == 200
    created_data = create_res.json()
    assert created_data["user_email"] == email
    
    # Read trips with valid token
    get_res = client.get(f"/api/v1/saved-trips/{email}?token={token}")
    assert get_res.status_code == 200
    trips = get_res.json()
    assert any(t["id"] == created_data["id"] for t in trips)
    
    # Read dashboard with valid token
    dash_res = client.get(f"/api/v1/saved-trips/dashboard/{email}?token={token}")
    assert dash_res.status_code == 200
    dash_trips = dash_res.json()
    assert any(t["id"] == created_data["id"] for t in dash_trips)
