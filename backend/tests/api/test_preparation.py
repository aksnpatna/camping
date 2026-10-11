import uuid
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_saved_trip_shortlist_allows_multiple_candidates_same_dates():
    email = f"camper_{uuid.uuid4().hex[:8]}@example.com"
    campsites_res = client.get("/api/v1/campsites")
    assert campsites_res.status_code == 200
    campsites = campsites_res.json()
    assert len(campsites) >= 2
    campsite_1 = campsites[0]["id"]
    campsite_2 = campsites[1]["id"]

    start = date.today() + timedelta(days=20)
    end = start + timedelta(days=2)

    # 1. First shortlist candidate
    res1 = client.post("/api/v1/saved-trips", json={
        "campsite_id": campsite_1,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_shortlist": True
    })
    assert res1.status_code == 200, res1.text

    # 2. Second shortlist candidate for the SAME user on the SAME weekend
    res2 = client.post("/api/v1/saved-trips", json={
        "campsite_id": campsite_2,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_shortlist": True
    })
    assert res2.status_code == 200, res2.text

    # 3. Duplicate candidate for exact same campsite on same dates should fail
    res_dup = client.post("/api/v1/saved-trips", json={
        "campsite_id": campsite_1,
        "user_email": email,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_shortlist": True
    })
    assert res_dup.status_code == 400

    # 4. Confirmed trip overlap: creating two non-shortlist trips on overlapping dates should fail
    email_confirmed = f"confirmed_{uuid.uuid4().hex[:8]}@example.com"
    c_res1 = client.post("/api/v1/saved-trips", json={
        "campsite_id": campsite_1,
        "user_email": email_confirmed,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_shortlist": False
    })
    assert c_res1.status_code == 200

    c_res2 = client.post("/api/v1/saved-trips", json={
        "campsite_id": campsite_2,
        "user_email": email_confirmed,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "is_shortlist": False
    })
    assert c_res2.status_code == 400


def test_dynamic_checklist_generation():
    campsites_res = client.get("/api/v1/campsites")
    campsite_id = campsites_res.json()[0]["id"]

    payload = {
        "campsite_id": campsite_id,
        "gear_profile": ["2-person tent", "sleeping pad"],
        "party_size": 2,
        "has_dog": True,
        "start_date": (date.today() + timedelta(days=14)).isoformat(),
        "end_date": (date.today() + timedelta(days=16)).isoformat()
    }

    res = client.post("/api/v1/trips/checklist/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "packing_items" in data
    assert "food_and_shopping" in data
    assert "departure_tasks" in data
    assert "missing_equipment_alerts" in data

    # Verify item status based on profile
    items = {item["item"].lower(): item for item in data["packing_items"]}
    # Tent was owned
    assert any("tent" in name and item["owned"] for name, item in items.items())
    # Missing items should prioritize borrowing before buying
    missing_items = [i for i in data["packing_items"] if not i["owned"]]
    assert len(missing_items) > 0
    assert any(i.get("borrow_first") is True for i in missing_items)

    # Dog supplies should be present when has_dog=True
    assert any("dog" in i["item"].lower() or i["category"] == "Pet Supplies" for i in data["packing_items"])


def test_shared_trip_room_lifecycle():
    campsites_res = client.get("/api/v1/campsites")
    campsites = campsites_res.json()
    id1 = campsites[0]["id"]
    id2 = campsites[1]["id"]

    start = date.today() + timedelta(days=10)
    end = start + timedelta(days=2)

    # 1. Create Room
    create_payload = {
        "trip_name": "Summer Getaway",
        "created_by_email": "organizer@example.com",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "shortlist_campsite_ids": [id1, id2]
    }
    create_res = client.post("/api/v1/trips/rooms", json=create_payload)
    assert create_res.status_code == 200
    room = create_res.json()
    token = room["room_token"]
    assert token is not None

    # 2. Get Room
    get_res = client.get(f"/api/v1/trips/rooms/{token}")
    assert get_res.status_code == 200
    room_data = get_res.json()
    assert len(room_data["shortlist_campsites"]) == 2

    # 3. Vote on Campsites (Primary vs Backup)
    vote_res = client.post(f"/api/v1/trips/rooms/{token}/vote", json={
        "campsite_id": id1,
        "vote_type": "primary",
        "voter_name": "Sarah"
    })
    assert vote_res.status_code == 200
    assert vote_res.json()["primary_votes"][str(id1)] >= 1

    # 4. Claim shared gear
    claim_res = client.post(f"/api/v1/trips/rooms/{token}/claim-gear", json={
        "item_name": "Double Burner Stove",
        "claimer_name": "Mike"
    })
    assert claim_res.status_code == 200
    assert any(c["item_name"] == "Double Burner Stove" and c["claimed_by"] == "Mike" for c in claim_res.json()["claimed_gear"])

    # 5. Add and toggle task
    task_res = client.post(f"/api/v1/trips/rooms/{token}/task", json={
        "title": "Pick up 15kg ice from servo",
        "assigned_to": "Sarah"
    })
    assert task_res.status_code == 200
    task_list = task_res.json()["tasks"]
    assert any(t["title"] == "Pick up 15kg ice from servo" for t in task_list)
