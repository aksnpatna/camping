from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_find_weekend_natural_language_dog():
    # Camper asks for a dog-friendly weekend under 6 hours from Sydney
    payload = {
        "prompt": "Two adults, two kids and a dog. Leaving Sydney Friday afternoon, back Sunday. Tent camping, toilets essential, under 6 hours driving.",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "cards" in data
    assert len(data["cards"]) > 0
    assert len(data["cards"]) <= 3
    
    # Golden rule: Never silently drop dog requirement!
    for card in data["cards"]:
        assert card["dog_friendly"] is True
        assert "why_it_fits" in card
        assert len(card["why_it_fits"]) > 0
        assert "main_compromise" in card
        assert card["driving_time_minutes"] > 0
        assert "highlight_badge" in card

def test_find_weekend_limiting_constraint_when_unreachable():
    # Intentionally tight limit (15 mins drive from Sydney) with dog required
    payload = {
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 0.25,
        "dog_friendly": True
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Must NOT silently expand drive limit or drop dog filter
    assert len(data["cards"]) == 0
    assert "limiting_constraint" in data
    assert data["limiting_constraint"] is not None
    assert "suggested_adjustments" in data
    assert len(data["suggested_adjustments"]) > 0

def test_adjust_trip_conversational():
    # Start with initial search
    base_request = {
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 3.0,
        "dog_friendly": False
    }
    adjust_payload = {
        "current_request": base_request,
        "instruction": "Allow another 60 minutes driving and dogs must be allowed"
    }
    response = client.post("/api/v1/trips/adjust", json=adjust_payload)
    assert response.status_code == 200
    data = response.json()
    assert "updated_request" in data
    assert data["updated_request"]["dog_friendly"] is True
    assert data["updated_request"]["max_drive_hours"] >= 4.0
    assert "cards" in data

def test_recommendation_cards_no_fabricated_compromises():
    payload = {
        "prompt": "Melbourne weekend trip",
        "origin_lat": -37.8136,
        "origin_lng": 144.9631,
        "max_drive_hours": 5.0
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) > 0
    for card in cards:
        # Non-NSW sites must NEVER link to the NSW NPWS homepage!
        if card.get("state") != "NSW":
            assert card.get("booking_url") != "https://www.nationalparks.nsw.gov.au"


