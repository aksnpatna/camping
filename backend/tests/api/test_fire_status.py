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


def test_fire_status_non_automated_honest_degradation():
    response = client.get("/api/v1/fire-status?state=QLD")
    # Non-automated jurisdictions must NEVER return a synthesized Moderate/live rating!
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data.get("rating") is None
    assert data.get("total_fire_ban") is None
    assert "check" in data.get("message", "").lower()


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


def test_fire_status_all_jurisdictions():
    """Validates that all 8 states/territories plus JBT have valid routing and never simulate ratings."""
    jurisdictions = {
        "NSW": ["RFS"],
        "VIC": ["CFA", "VicEmergency"],
        "QLD": ["QFD", "Queensland Fire"],
        "WA": ["DFES", "Emergency WA"],
        "SA": ["CFS", "Country Fire Service"],
        "TAS": ["TFS", "Tasmania Fire Service"],
        "NT": ["Bushfires NT", "NTFES"],
        "ACT": ["ESA", "RFS"],
        "JBT": ["Parks Australia", "RFS"],
    }
    for state, agency_keywords in jurisdictions.items():
        resp = client.get(f"/api/v1/fire-status?state={state}")
        assert resp.status_code in [200, 503]
        if resp.status_code == 200:
            data = resp.json()
            assert data["state"] == state
            assert any(kw.lower() in data["source"].lower() for kw in agency_keywords)
            if data["status"] == "unavailable":
                assert data["rating"] is None
                assert data["total_fire_ban"] is None
                assert "official" in data["action_required"].lower() or "check" in data["action_required"].lower()
            elif data["status"] == "live":
                assert data["rating"] in VALID_AFDRS_RATINGS
                assert data["total_fire_ban"] is None or isinstance(data["total_fire_ban"], bool)


def test_fire_status_act_live_parsing():
    """ACT district is parsed live from the official AFDRS XML feed."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District>"
        "<Name>ACT</Name>"
        "<DangerLevelToday>Moderate</DangerLevelToday>"
        "<FireBanToday>No</FireBanToday>"
        "</District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="ACT")

    assert data["state"] == "ACT"
    assert data["district"] == "ACT"
    assert data["status"] == "live"
    assert data["rating"] == "Moderate"
    assert data["total_fire_ban"] is False
    assert "ACT" in data["source"] or "ESA" in data["source"]


def test_fire_status_jbt_routes_to_illawarra_shoalhaven():
    """Jervis Bay Territory correctly routes to Illawarra/Shoalhaven district."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?>'
        "<root><District>"
        "<Name>Illawarra/Shoalhaven</Name>"
        "<DangerLevelToday>High</DangerLevelToday>"
        "<FireBanToday>Yes</FireBanToday>"
        "</District></root>"
    )

    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="JBT")

    assert data["state"] == "JBT"
    assert data["district"] == "Illawarra/Shoalhaven"
    assert data["status"] == "live"
    assert data["rating"] == "High"
    assert data["total_fire_ban"] is True
    assert "Parks Australia" in data["source"] or "Shoalhaven" in data["source"]


_TWO_DISTRICT_XML = (
    '<?xml version="1.0"?>'
    "<root>"
    "<District><Name>Far North Coast</Name><DangerLevelToday>Low</DangerLevelToday>"
    "<FireBanToday>No</FireBanToday></District>"
    "<District><Name>Greater Sydney Region</Name><DangerLevelToday>Extreme</DangerLevelToday>"
    "<FireBanToday>Yes</FireBanToday></District>"
    "</root>"
)


def test_unmatched_requested_district_is_never_substituted():
    """A district the feed does not know must degrade to 'unavailable', not
    silently return another district's live rating or total fire ban."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    with patch("httpx.Client.get", return_value=_feed_mock(_TWO_DISTRICT_XML)):
        data = fetch_live_rfs_status(state="NSW", district="Atlantis")

    assert data["status"] == "unavailable"
    assert data["rating"] is None
    assert data["total_fire_ban"] is None


def test_feed_missing_default_district_does_not_fall_back_to_first_node():
    """If the agency's default district is absent, do not present the first
    district in the feed as the answer."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    xml = (
        '<?xml version="1.0"?><root><District><Name>Far North Coast</Name>'
        "<DangerLevelToday>Low</DangerLevelToday><FireBanToday>No</FireBanToday>"
        "</District></root>"
    )
    with patch("httpx.Client.get", return_value=_feed_mock(xml)):
        data = fetch_live_rfs_status(state="NSW")

    assert data["status"] == "unavailable"
    assert data["rating"] is None


def test_matched_district_still_returns_live():
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    with patch("httpx.Client.get", return_value=_feed_mock(_TWO_DISTRICT_XML)):
        data = fetch_live_rfs_status(state="NSW", district="Far North Coast")

    assert data["status"] == "live"
    assert data["district"] == "Far North Coast"
    assert data["total_fire_ban"] is False
 
 
def test_fire_status_vic_live_parsing():
    """VIC districts are parsed live from official VicEmergency GeoJSON feed."""
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    mock_vic_json = {
        "properties": {
            "conditions": {
                "fdr": {
                    "Central": "MODERATE",
                    "South West": "HIGH",
                    "Mallee": "NO FORECAST",
                },
                "tfb": {
                    "Central": "NO - RESTRICTIONS MAY APPLY",
                    "South West": "YES",
                    "Mallee": "NO - RESTRICTIONS MAY APPLY",
                }
            }
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_vic_json

    with patch("httpx.Client.get", return_value=mock_resp):
        data = fetch_live_rfs_status(state="VIC", district="Central")

    assert data["state"] == "VIC"
    assert data["district"] == "Central"
    assert data["status"] == "live"
    assert data["rating"] == "Moderate"
    assert data["total_fire_ban"] is False
    assert "VicEmergency" in data["source"] or "EMV" in data["source"]

    with patch("httpx.Client.get", return_value=mock_resp):
        data_sw = fetch_live_rfs_status(state="VIC", district="South West")

    assert data_sw["rating"] == "High"
    assert data_sw["total_fire_ban"] is True
    assert "total fire ban" in data_sw["action_required"].lower()


def test_fire_status_vic_unmatched_district_degrades():
    from app.api.v1.endpoints.fire_status import fetch_live_rfs_status

    mock_vic_json = {
        "properties": {
            "conditions": {
                "fdr": {"Central": "MODERATE"},
                "tfb": {"Central": "NO"}
            }
        }
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_vic_json

    with patch("httpx.Client.get", return_value=mock_resp):
        data = fetch_live_rfs_status(state="VIC", district="Atlantis")

    assert data["status"] == "unavailable"
    assert data["rating"] is None
    assert data["total_fire_ban"] is None

