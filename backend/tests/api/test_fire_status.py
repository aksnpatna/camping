from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_AFDRS_RATINGS = {"No Rating", "Moderate", "High", "Extreme", "Catastrophic"}


def _feed_mock(xml: str):
    response = MagicMock()
    response.status_code = 200
    response.content = xml.encode()
    return response


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
        # A ban is read from the feed; an absent declaration stays unknown.
        assert data["total_fire_ban"] is None or isinstance(data["total_fire_ban"], bool)
        # Verify no fake 'Low-Moderate'
        assert data["rating"] != "Low-Moderate"
        assert "status" in data


def test_fire_status_degradation_handling(monkeypatch):
    from app.api.v1.endpoints import fire_status

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
    assert data.get("total_fire_ban") is None
    assert "pilot catchment" in data.get("message", "").lower() or "check" in data.get("message", "").lower()


def test_fire_status_nsw_district_parsing():
    response = client.get("/api/v1/fire-status?state=NSW&district=Greater+Sydney+Region")
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.json()
        assert data["state"] == "NSW"
        assert "district" in data
        assert data["rating"] in VALID_AFDRS_RATINGS
        assert data["total_fire_ban"] is None or isinstance(data["total_fire_ban"], bool)


def test_unrecognised_rating_is_never_coerced_to_moderate():
    """Regression guard: an unknown rating must stay unknown, not become a
    substantive 'Moderate' rating in the safety path."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District>"
        "<Name>Test District</Name>"
        "<DangerLevelToday>Low-Moderate</DangerLevelToday>"
        "<FireBanToday>Maybe</FireBanToday>"
        "</District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="NSW", district="Test District")

    assert data["rating"] == "No Rating"
    assert data["rating"] != "Moderate"
    assert data["total_fire_ban"] is None
    assert "unavailable" in data["action_required"].lower()


def test_missing_rating_element_stays_unknown():
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District><Name>Empty District</Name></District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="NSW", district="Empty District")

    assert data["rating"] == "No Rating"
    assert data["total_fire_ban"] is None


def test_declared_total_fire_ban_is_read_from_the_feed():
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District>"
        "<Name>Ban District</Name>"
        "<DangerLevelToday>Catastrophic</DangerLevelToday>"
        "<FireBanToday>Yes</FireBanToday>"
        "</District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="NSW", district="Ban District")

    assert data["rating"] == "Catastrophic"
    assert data["total_fire_ban"] is True
    assert "total fire ban" in data["action_required"].lower()


def test_high_rating_without_declared_ban_is_not_inferred_as_ban():
    """A ban must be declared, never inferred from the rating alone."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District>"
        "<Name>No Ban District</Name>"
        "<DangerLevelToday>Extreme</DangerLevelToday>"
        "<FireBanToday>No</FireBanToday>"
        "</District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="NSW", district="No Ban District")

    assert data["rating"] == "Extreme"
    assert data["total_fire_ban"] is False
