import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.microclimate_engine import MicroclimateEngine

client = TestClient(app)

def test_microclimate_engine_physics_calculations():
    # Test direct physics calculation functions
    today = date.today()
    future_date = today + timedelta(days=5)

    # 1. Sea level coastal point (Sydney coast)
    coastal = MicroclimateEngine.compute_microclimate(
        latitude=-33.85,
        longitude=151.25,
        target_date=future_date,
        elevation_m=10.0,
        campsite_name="Coogee Camp",
        temp_max_base=24.0,
        temp_min_base=16.0,
        rain_prob_base=20,
        wind_speed_base=15.0
    )
    assert coastal.elevation_m == 10.0
    assert "dawn" in coastal.phases
    assert "midday" in coastal.phases
    assert "dusk" in coastal.phases
    assert "night" in coastal.phases
    assert coastal.sleeping_bag_rating is not None
    assert coastal.dew_frost_index is not None

    # 2. High-elevation valley point (Blue Mountains / Megalong Valley, ~800m)
    valley = MicroclimateEngine.compute_microclimate(
        latitude=-33.72,
        longitude=150.28,
        target_date=future_date,
        elevation_m=800.0,
        campsite_name="Megalong Valley Camp",
        temp_max_base=24.0,
        temp_min_base=16.0,
        rain_prob_base=20,
        wind_speed_base=15.0
    )
    # Environmental lapse rate: ~ -6.5°C per 1000m => at 800m, temps should be roughly 4-5°C lower than sea level base
    assert valley.temp_max < coastal.temp_max
    assert valley.temp_min < coastal.temp_min
    assert valley.recommended_mat_r_value >= 2.0


def test_microclimate_api_endpoint_within_16_days():
    target_date = (date.today() + timedelta(days=4)).isoformat()
    response = client.get(
        f"/api/v1/weather/microclimate?latitude=-33.8688&longitude=151.2093&date={target_date}"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["latitude"] == -33.8688
    assert data["longitude"] == 151.2093
    assert data["date"] == target_date
    assert data["forecast_type"] in ["numerical_ensemble", "climatological_physics"]
    assert "temp_max" in data
    assert "temp_min" in data
    assert "phases" in data
    for phase in ["dawn", "midday", "dusk", "night"]:
        assert phase in data["phases"]
        assert "temperature" in data["phases"][phase]
        assert "camper_tip" in data["phases"][phase]
    assert "sleeping_bag_rating" in data
    assert "dew_frost_index" in data
    assert "campfire_wind_risk" in data
    assert "peg_strain_factor" in data


def test_microclimate_api_endpoint_future_climatology():
    # 45 days in advance (beyond standard 16-day numerical forecast)
    target_date = (date.today() + timedelta(days=45)).isoformat()
    response = client.get(
        f"/api/v1/weather/microclimate?latitude=-33.8688&longitude=151.2093&date={target_date}"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["forecast_type"] == "climatological_physics"
    assert data["temp_max"] > -10.0
    assert data["temp_min"] < data["temp_max"]
    assert len(data["terrain_notes"]) > 0


def test_microclimate_api_with_campsite_id():
    # Fetch first available campsite
    campsites_res = client.get("/api/v1/campsites")
    assert campsites_res.status_code == 200
    campsites = campsites_res.json()
    if campsites:
        campsite_id = campsites[0]["id"]
        target_date = (date.today() + timedelta(days=7)).isoformat()
        response = client.get(
            f"/api/v1/weather/microclimate?campsite_id={campsite_id}&date={target_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["campsite_id"] == campsite_id
        assert abs(data["latitude"] - campsites[0]["latitude"]) < 0.001


def test_microclimate_api_validation_errors():
    # Missing date
    res = client.get("/api/v1/weather/microclimate?latitude=-33.86&longitude=151.20")
    assert res.status_code == 422

    # Missing lat/lng when campsite_id not provided
    res2 = client.get("/api/v1/weather/microclimate?date=2026-12-01")
    assert res2.status_code == 400 or res2.status_code == 422


@pytest.mark.anyio
async def test_microclimate_ai_condition_synthesis():
    target_date = (date.today() + timedelta(days=2)).isoformat()
    response = client.get(
        f"/api/v1/weather/microclimate?latitude=-33.72&longitude=150.28&date={target_date}"
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "ai_condition_summary" in data
    assert data["ai_condition_summary"] is not None
    assert len(data["ai_condition_summary"]) > 15
    # Should contain realistic advice derived from telemetry
    summary_lower = data["ai_condition_summary"].lower()
    assert any(term in summary_lower for term in ["bag", "temp", "cold", "wind", "dew", "camp", "fire", "layer", "gear", "°c"])

