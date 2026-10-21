"""
Security hardening tests: admin auth, abuse/burst protection, IP trust,
input limits, security headers and CORS.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import limiter, resolve_client_ip
from app.main import app
from app.services.email_service import email_service

PUBLIC_PEER = ("203.0.113.9", 50000)  # TEST-NET-3, treated as an untrusted peer
PROXY_PEER = ("172.18.0.5", 50000)    # docker-network proxy, trusted


@pytest.fixture
def enable_limits(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def admin_key(monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_KEY", "test-admin-key-0123456789")
    return "test-admin-key-0123456789"


# --------------------------------------------------------------------------- #
# Admin protection
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("path", ["/api/v1/analytics/summary", "/api/v1/analytics/leads"])
def test_admin_endpoints_reject_anonymous(path, admin_key):
    client = TestClient(app)
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", ["/api/v1/analytics/summary", "/api/v1/analytics/leads"])
def test_admin_endpoints_reject_wrong_key(path, admin_key):
    client = TestClient(app)
    assert client.get(path, headers={"X-Admin-Key": "nope"}).status_code == 403


@pytest.mark.parametrize("path", ["/api/v1/analytics/summary", "/api/v1/analytics/leads"])
def test_admin_endpoints_fail_closed_when_key_unset(path, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_KEY", None)
    client = TestClient(app)
    assert client.get(path, headers={"X-Admin-Key": ""}).status_code in (401, 403)
    assert client.get(path, headers={"X-Admin-Key": "anything"}).status_code == 403


def test_admin_endpoints_allow_valid_key(admin_key):
    client = TestClient(app)
    for path in ("/api/v1/analytics/summary", "/api/v1/analytics/leads"):
        assert client.get(path, headers={"X-Admin-Key": admin_key}).status_code == 200


def test_admin_key_in_query_string_is_not_accepted(admin_key):
    client = TestClient(app)
    res = client.get(f"/api/v1/analytics/summary?admin_key={admin_key}")
    assert res.status_code == 401


def test_analytics_limit_is_bounded(admin_key):
    client = TestClient(app)
    res = client.get("/api/v1/analytics/leads?limit=1000000", headers={"X-Admin-Key": admin_key})
    assert res.status_code == 422


# --------------------------------------------------------------------------- #
# Client IP resolution (anti-spoofing)
# --------------------------------------------------------------------------- #
def test_untrusted_peer_cannot_spoof_ip():
    ip = resolve_client_ip({"x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "5.6.7.8"}, "203.0.113.9")
    assert ip == "203.0.113.9"


def test_trusted_proxy_uses_cf_connecting_ip():
    assert resolve_client_ip({"cf-connecting-ip": "198.51.100.7"}, "172.18.0.5") == "198.51.100.7"


def test_trusted_proxy_xff_ignores_spoofed_left_entries():
    # Client-supplied "9.9.9.9" is leftmost; the real client was appended by the proxy.
    ip = resolve_client_ip({"x-forwarded-for": "9.9.9.9, 198.51.100.7"}, "172.18.0.5")
    assert ip == "198.51.100.7"


def test_invalid_forwarded_values_fall_back_to_peer():
    assert resolve_client_ip({"cf-connecting-ip": "not-an-ip"}, "172.18.0.5") == "172.18.0.5"


# --------------------------------------------------------------------------- #
# Burst / flood protection
# --------------------------------------------------------------------------- #
def test_global_rate_limit_returns_429_with_retry_after(enable_limits, monkeypatch):
    monkeypatch.setattr(settings, "GLOBAL_RATE_LIMIT", 5)
    client = TestClient(app, client=PUBLIC_PEER)
    codes = [client.get("/api/v1/does-not-exist").status_code for _ in range(8)]
    assert codes[:5] == [404] * 5
    assert codes[5:] == [429] * 3
    res = client.get("/api/v1/does-not-exist")
    assert res.status_code == 429
    assert int(res.headers["Retry-After"]) >= 1


def test_rotating_xff_does_not_evade_limit(enable_limits, monkeypatch):
    monkeypatch.setattr(settings, "GLOBAL_RATE_LIMIT", 5)
    client = TestClient(app, client=PUBLIC_PEER)
    codes = [
        client.get("/api/v1/does-not-exist", headers={"X-Forwarded-For": f"10.1.1.{i}"}).status_code
        for i in range(8)
    ]
    assert 429 in codes


def test_distinct_real_clients_behind_proxy_are_limited_independently(enable_limits, monkeypatch):
    monkeypatch.setattr(settings, "GLOBAL_RATE_LIMIT", 3)
    client = TestClient(app, client=PROXY_PEER)
    for _ in range(3):
        assert client.get("/api/v1/does-not-exist", headers={"CF-Connecting-IP": "198.51.100.1"}).status_code == 404
    assert client.get("/api/v1/does-not-exist", headers={"CF-Connecting-IP": "198.51.100.1"}).status_code == 429
    # A different visitor behind the same proxy is unaffected.
    assert client.get("/api/v1/does-not-exist", headers={"CF-Connecting-IP": "198.51.100.2"}).status_code == 404


def test_persistent_offender_is_temporarily_banned(enable_limits, monkeypatch):
    monkeypatch.setattr(settings, "GLOBAL_RATE_LIMIT", 2)
    monkeypatch.setattr(settings, "BAN_STRIKE_THRESHOLD", 5)
    client = TestClient(app, client=PUBLIC_PEER)
    for _ in range(20):
        client.get("/api/v1/does-not-exist")
    res = client.get("/api/v1/does-not-exist")
    assert res.status_code == 429
    assert limiter.is_banned("203.0.113.9")


def test_health_endpoint_exempt_from_limit(enable_limits, monkeypatch):
    monkeypatch.setattr(settings, "GLOBAL_RATE_LIMIT", 2)
    client = TestClient(app, client=PUBLIC_PEER)
    assert all(client.get("/api/v1/health").status_code != 429 for _ in range(10))


def test_magic_link_per_ip_limit(enable_limits):
    client = TestClient(app, client=PUBLIC_PEER)
    codes = [
        client.post("/api/v1/auth/request-magic-link", json={"email": f"user{i}@example.com"}).status_code
        for i in range(8)
    ]
    assert codes[:5] == [200] * 5
    assert 429 in codes[5:]


def test_magic_link_per_email_limit_stops_mail_bombing(enable_limits):
    """Many different attackers must not be able to flood one victim's inbox,
    and the response must stay generic (no enumeration oracle)."""
    email_service.clear_outbox()
    victim = "victim@example.com"
    for i in range(8):
        client = TestClient(app, client=(f"203.0.113.{i + 10}", 40000))
        res = client.post("/api/v1/auth/request-magic-link", json={"email": victim})
        assert res.status_code == 200
    assert len(email_service.outbox) <= 3


def test_expensive_ai_endpoints_are_tightly_limited(enable_limits):
    client = TestClient(app, client=PUBLIC_PEER)
    codes = [client.get("/api/v1/campsites/1/ai-summary").status_code for _ in range(20)]
    assert 429 in codes


def test_event_ingestion_is_rate_limited(enable_limits):
    client = TestClient(app, client=PUBLIC_PEER)
    codes = [
        client.post("/api/v1/analytics/events", json={"event_type": "page_view", "path": "/x"}).status_code
        for _ in range(60)
    ]
    assert 429 in codes


# --------------------------------------------------------------------------- #
# Input limits
# --------------------------------------------------------------------------- #
def test_oversized_body_rejected_413():
    client = TestClient(app)
    res = client.post(
        "/api/v1/analytics/events",
        content=b"x" * (settings.MAX_BODY_BYTES + 1),
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 413


def test_event_meta_data_size_capped():
    client = TestClient(app)
    res = client.post(
        "/api/v1/analytics/events",
        json={"event_type": "page_view", "path": "/x", "meta_data": {"blob": "a" * 5000}},
    )
    assert res.status_code == 422


def test_event_type_and_path_length_capped():
    client = TestClient(app)
    assert client.post("/api/v1/analytics/events", json={"event_type": "e" * 200, "path": "/x"}).status_code == 422
    assert client.post("/api/v1/analytics/events", json={"event_type": "page_view", "path": "/" + "p" * 2000}).status_code == 422


def test_check_in_rejects_unknown_status_and_long_notes():
    client = TestClient(app)
    assert client.post("/api/v1/campsites/1/check-ins", json={"water_status": "<script>"}).status_code == 422
    assert client.post("/api/v1/campsites/1/check-ins", json={"notes": "n" * 2000}).status_code == 422


def test_trip_room_token_is_high_entropy():
    client = TestClient(app)
    res = client.post(
        "/api/v1/trips/rooms",
        json={
            "trip_name": "T",
            "created_by_email": "owner@example.com",
            "start_date": "2026-11-01",
            "end_date": "2026-11-03",
        },
    )
    assert res.status_code == 200, res.text
    token = res.json()["room_token"]
    assert len(token) >= 20


def test_trip_room_free_text_is_length_capped():
    client = TestClient(app)
    res = client.post(
        "/api/v1/trips/rooms",
        json={
            "trip_name": "T" * 500,
            "created_by_email": "owner@example.com",
            "start_date": "2026-11-01",
            "end_date": "2026-11-03",
        },
    )
    assert res.status_code == 422


# --------------------------------------------------------------------------- #
# Headers / CORS
# --------------------------------------------------------------------------- #
def test_security_headers_present():
    res = TestClient(app).get("/api/v1/health")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["Referrer-Policy"] == "no-referrer"


def test_cors_blocks_unlisted_origin_and_allows_listed():
    client = TestClient(app)
    bad = client.options(
        "/api/v1/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers
    good_origin = settings.allowed_origins_list[0]
    good = client.options(
        "/api/v1/health",
        headers={"Origin": good_origin, "Access-Control-Request-Method": "GET"},
    )
    assert good.headers.get("access-control-allow-origin") == good_origin
