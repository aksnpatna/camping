from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_verified_campsites_prioritized_over_stubs():
    # Sydney search under 3 hours: verified sites like Euroka, Bendeela, Bonnie Vale must be prioritized
    payload = {
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 3.0
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) >= 1
    # The top recommended card should be verified when verified sites exist in range
    assert cards[0]["data_status"] == "verified", f"Top card should be verified, but got: {cards[0]['name']} ({cards[0]['data_status']})"
    verified_cards = [c for c in cards if c.get("data_status") == "verified"]
    assert len(verified_cards) >= 2, "Should prioritize verified campsites when available within drive limit"

def test_recommendation_cards_include_weather_days_and_gear_fit():
    payload = {
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 3.0
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) > 0
    for card in cards:
        # Check weather_days presence
        assert "weather_days" in card, "Card must include weather_days"
        assert card["weather_days"] is not None
        assert len(card["weather_days"]) == 4, "Must provide 4-day weekend weather (Fri-Mon)"
        for day in card["weather_days"]:
            assert "dayName" in day
            assert "dateStr" in day
            assert "minTemp" in day
            assert "maxTemp" in day
            assert "rainProb" in day
            assert "gearRecommendation" in day
            assert "conditionIcon" in day
        
        # Check gear_fit presence
        assert "gear_fit" in card, "Card must include gear_fit"
        assert card["gear_fit"] is not None
        assert "overnight_min_temp" in card["gear_fit"]
        assert "sleeping_bag_rating" in card["gear_fit"]

        # Check forecast_source presence and honest values
        assert "forecast_source" in card, "Card must include forecast_source"
        assert card["forecast_source"] in ("live", "climatology", "mixed")

        # Verify no fabricated shade key in visual_badges
        if card.get("visual_badges"):
            assert "shade" not in card["visual_badges"], "shade badge must not be fabricated"


def test_recommendation_three_distinct_archetypes():
    payload = {
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 3.5
    }
    response = client.post("/api/v1/trips/find-weekend", json=payload)
    assert response.status_code == 200
    cards = response.json()["cards"]
    if len(cards) == 3:
        # 3 distinct sites, not duplicate IDs
        ids = [c["id"] for c in cards]
        assert len(set(ids)) == 3, "All 3 cards must be distinct campsites"
        # Must have distinct highlight badges
        badges = [c["highlight_badge"] for c in cards]
        assert len(set(badges)) >= 2, "Cards should offer distinct trip archetypes"
