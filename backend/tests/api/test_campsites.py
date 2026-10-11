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

