import pytest
from app.core.database import SessionLocal
from app.services.town_locator import TownLocatorService


def test_town_locator_calculates_nearest_town():
    """Verify that TownLocatorService finds the nearest Australian town given coordinates."""
    with SessionLocal() as db:
        # Coordinates for Euroka Campground in Blue Mountains
        res = TownLocatorService.find_nearest_locality(db, longitude=150.6272, latitude=-33.7842)
        assert res is not None
        assert res.locality in ["Glenbrook", "Lapstone", "Blaxland"]
        assert res.distance_km < 10.0


def test_town_locator_generates_meaningful_amenities():
    """Verify that town amenities advisory produces distance, fuel and grocery guidance without generic placeholders."""
    with SessionLocal() as db:
        res = TownLocatorService.find_nearest_locality(db, longitude=150.6272, latitude=-33.7842)
        assert res is not None
        advisory = TownLocatorService.get_town_amenities_advisory(res)
        assert "Verify in nearest town" not in advisory["nearest_fuel"]
        assert "Verify in nearest town" not in advisory["nearest_grocery"]
        assert res.locality in advisory["nearest_fuel"]
        assert f"{res.distance_km:.0f} km" in advisory["nearest_fuel"] or f"{int(res.distance_km)} km" in advisory["nearest_fuel"] or "km" in advisory["nearest_fuel"]
