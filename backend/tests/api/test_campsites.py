from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_campsite():
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
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Campsite"
    assert "id" in data

def test_get_campsites():
    response = client.get("/api/v1/campsites")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
