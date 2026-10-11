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
        "prompt": "Sydney weekend trip",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 3.5
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) > 0
    for card in cards:
        # Verified booking/source URL is preserved
        if card.get("booking_url"):
            assert len(card["booking_url"]) > 10
        # Main compromise must not be empty or canned fallback
        assert "main_compromise" in card
        assert len(card["main_compromise"]) > 5

def test_preset_sydney_dog_3_5h():
    payload = {
        "prompt": "Leaving Sydney Friday afternoon, 2 adults and a dog. Tent camping, under 3.5 hours driving.",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) >= 1
    # All returned cards must be dog-friendly
    for card in data["cards"]:
        assert card["dog_friendly"] is True
        assert card["driving_time_minutes"] <= 3.5 * 60 + 30

def test_preset_family_under_2h():
    payload = {
        "prompt": "Two adults, two kids. Leaving Sydney Saturday morning, under 2 hours driving, toilets essential.",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) >= 1
    for card in data["cards"]:
        assert card["driving_time_minutes"] <= 2.0 * 60 + 30

def test_preset_quick_overnight_under_90m():
    payload = {
        "prompt": "Leaving Sydney Friday after work, back Saturday evening, under 90 minutes drive.",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) >= 1
    for card in data["cards"]:
        assert card["driving_time_minutes"] <= 90 + 30

def test_preset_4wd_under_4h():
    payload = {
        "prompt": "Under 4 hours drive from Sydney, 4WD tracks preferred, quiet bush camping.",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) >= 1
    for card in data["cards"]:
        assert card["driving_time_minutes"] <= 4.0 * 60 + 30

def test_cards_provide_availability_window_and_modality():
    payload = {
        "prompt": "Sydney camping trip with dog under 3.5h",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) >= 1
    valid_modalities = {
        "FIRST_COME_FIRST_SERVED",
        "ONLINE_BOOKING_REQUIRED",
        "FREE_REGISTRATION_REQUIRED",
        "OPERATOR_PORTAL"
    }
    for card in cards:
        assert "booking_type" in card
        assert card["booking_type"] in valid_modalities
        assert "availability_window" in card
        assert len(card["availability_window"]) >= 20



