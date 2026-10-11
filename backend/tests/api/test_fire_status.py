from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

VALID_AFDRS_RATINGS = {"No Rating", "Moderate", "High", "Extreme", "Catastrophic"}

def test_get_fire_status_contract():
    response = client.get("/api/v1/fire-status?state=NSW")
    # Must either be 200 with live verified state, or 503 per degradation rule
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert data["state"] == "NSW"
        assert "rating" in data
        assert data["rating"] in VALID_AFDRS_RATINGS
        assert "total_fire_ban" in data
        assert isinstance(data["total_fire_ban"], bool)
        # Verify no fake 'Low-Moderate'
        assert data["rating"] != "Low-Moderate"
        assert "status" in data

def test_fire_status_degradation_handling(monkeypatch):
    from app.api.v1.endpoints import fire_status
    # Force feed failure simulation to test strict degradation
    def mock_fetch_fail(*args, **kwargs):
        raise Exception("RFS Feed Connection Timeout")
        
    monkeypatch.setattr(fire_status, "fetch_live_rfs_status", mock_fetch_fail)
    response = client.get("/api/v1/fire-status?state=NSW")
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()

def test_fire_status_non_nsw_honest_degradation():
    response = client.get("/api/v1/fire-status?state=VIC")
    # Non-NSW must NEVER return a synthesized Moderate/live rating!
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data.get("rating") is None
    assert "pilot catchment" in data.get("message", "").lower() or "check" in data.get("message", "").lower()

def test_fire_status_nsw_district_parsing():
    response = client.get("/api/v1/fire-status?state=NSW&district=Greater+Sydney+Region")
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["state"] == "NSW"
        assert "district" in data
        assert data["rating"] in VALID_AFDRS_RATINGS
        assert isinstance(data["total_fire_ban"], bool)

