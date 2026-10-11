from fastapi.testclient import TestClient
import os
from app.main import app

client = TestClient(app)

def test_create_campsite_unauthorized():
    # Attempt creation without admin key
    response = client.post(
        "/api/v1/campsites",
        json={
            "name": "Test Campsite",
            "state": "NSW",
            "longitude": 150.0,
            "latitude": -34.0,
            "management_type": "NPWS",
            "dog_friendly": False,
            "rig_access": ["TENT", "4WD_ONLY"]
        }
    )
    assert response.status_code in [403, 422]

def test_create_campsite_authorized(monkeypatch):
    test_key = "secret-admin-pass-123"
    monkeypatch.setenv("ADMIN_KEY", test_key)
    
    response = client.post(
        f"/api/v1/campsites?admin_key={test_key}",
        json={
            "name": "TDD Test Campsite",
            "state": "NSW",
            "longitude": 150.5,
            "latitude": -34.2,
            "management_type": "NPWS",
            "dog_friendly": True,
            "rig_access": ["TENT"]
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "TDD Test Campsite"
    assert "id" in data
    assert data["dog_friendly"] is True

def test_get_campsites():
    response = client.get("/api/v1/campsites")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_campsite_facilities_and_fees_fields(monkeypatch):
    test_key = "secret-admin-pass-123"
    monkeypatch.setenv("ADMIN_KEY", test_key)

    response = client.post(
        f"/api/v1/campsites?admin_key={test_key}",
        json={
            "name": "Verified Amenities Camp",
            "state": "NSW",
            "longitude": 150.3,
            "latitude": -34.5,
            "management_type": "Forestry Corporation",
            "dog_friendly": True,
            "rig_access": ["TENT", "CAMPER_TRAILER"],
            "facilities": {
                "toilets": "pit",
                "showers": "none",
                "drinking_water": False,
                "campfires": True
            },
            "fees": "$0 (Free)",
            "booking_url": "https://www.forestrycorporation.com.au",
            "fire_district": "Southern Highlands"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["facilities"] == {
        "toilets": "pit",
        "showers": "none",
        "drinking_water": False,
        "campfires": True
    }
    assert data["fees"] == "$0 (Free)"
    assert data["booking_url"] == "https://www.forestrycorporation.com.au"
    assert data["fire_district"] == "Southern Highlands"

def test_campsite_insights_attributed_observations():
    res = client.get("/api/v1/campsites")
    assert res.status_code == 200
    first_id = res.json()[0]["id"]

    ins_res = client.get(f"/api/v1/campsites/{first_id}/insights")
    assert ins_res.status_code == 200
    ins_data = ins_res.json()
    assert "observations" in ins_data
    assert "retrieved_at" in ins_data
    assert isinstance(ins_data["observations"], list)
    assert len(ins_data["observations"]) > 0
    assert "category" in ins_data["observations"][0]
    assert "source_attribution" in ins_data["observations"][0]



