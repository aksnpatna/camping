from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_campsite_check_in_flow():
    # 1. Get an existing campsite
    res = client.get("/api/v1/campsites?limit=1")
    assert res.status_code == 200
    campsites = res.json()
    assert len(campsites) > 0
    site_id = campsites[0]["id"]

    # 2. Submit a 10-second ground check-in
    check_in_payload = {
        "water_status": "flowing",
        "toilets_status": "clean",
        "road_status": "2wd_clear",
        "vibe_status": "plenty_space",
        "telco_status": "telstra_4g",
        "notes": "Creek has clean water, campsite is peaceful"
    }
    post_res = client.post(f"/api/v1/campsites/{site_id}/check-ins", json=check_in_payload)
    assert post_res.status_code == 201
    data = post_res.json()
    assert data["campsite_id"] == site_id
    assert data["water_status"] == "flowing"
    assert data["toilets_status"] == "clean"

    # 3. Retrieve check-ins and summary
    get_res = client.get(f"/api/v1/campsites/{site_id}/check-ins")
    assert get_res.status_code == 200
    summary_data = get_res.json()
    assert summary_data["total_count"] >= 1
    assert summary_data["summary"]["water"] == "flowing"
    assert summary_data["summary"]["toilets"] == "clean"
    assert summary_data["summary"]["road"] == "2wd_clear"
    assert summary_data["summary"]["telco"] == "telstra_4g"
    assert len(summary_data["recent_check_ins"]) >= 1
