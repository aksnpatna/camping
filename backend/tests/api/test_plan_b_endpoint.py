import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.campsite import Campsite

client = TestClient(app)


def test_plan_b_endpoint_404_for_nonexistent_site():
    response = client.get("/api/v1/campsites/99999999/plan-b")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_plan_b_endpoint_returns_alternatives_with_facts():
    with SessionLocal() as db:
        first_site = db.query(Campsite).first()
        assert first_site is not None, "Need at least one campsite in database"
        site_id = first_site.id

    response = client.get(f"/api/v1/campsites/{site_id}/plan-b?limit=2")
    assert response.status_code == 200
    data = response.json()
    assert data["original_campsite_id"] == site_id
    assert isinstance(data["alternatives"], list)

    if data["alternatives"]:
        alt = data["alternatives"][0]
        assert "id" in alt
        assert alt["id"] != site_id
        assert "name" in alt
        assert "state" in alt
        assert "reason" in alt
        assert "conditions_verified" in alt
        assert "facts" in alt
        if alt["facts"]:
            assert "fire_status" in alt["facts"]
            assert "toilets" in alt["facts"]


def test_plan_b_endpoint_honours_dog_filter():
    with SessionLocal() as db:
        first_site = db.query(Campsite).first()
        site_id = first_site.id

    response = client.get(f"/api/v1/campsites/{site_id}/plan-b?has_dog=true&limit=3")
    assert response.status_code == 200
    data = response.json()
    for alt in data["alternatives"]:
        assert alt["dog_friendly"] is True
