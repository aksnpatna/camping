import re
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models.magic_token import MagicToken
from app.services.email_service import email_service
from app.services.magic_link import assert_secret_key_safe, hash_token, revoke_magic_tokens

client = TestClient(app)

TOKEN_PATTERN = re.compile(r"token=([A-Za-z0-9_\-]+)")


def test_request_magic_link_never_returns_the_token(magic_token_for):
    """Regression guard for the token-leak defect: the credential must exist only
    inside the emailed link, never in the HTTP response."""
    email = "camper.auth.test@example.com"

    token = magic_token_for(client, email)
    assert token and len(token) >= 20

    sent = email_service.outbox[0]
    assert sent["to_email"] == email
    assert "Camp Smart Australia Access Link" in sent["subject"]
    assert token in sent["body_html"]
    assert f"email={email}" in sent["body_html"]


def test_request_magic_link_does_not_disclose_whether_address_is_known():
    known = "camper.enumeration.known@example.com"
    unknown = "camper.enumeration.unknown@example.com"

    client.post("/api/v1/auth/request-magic-link", json={"email": known})
    known_body = client.post("/api/v1/auth/request-magic-link", json={"email": known}).json()
    unknown_body = client.post("/api/v1/auth/request-magic-link", json={"email": unknown}).json()

    assert known_body["message"] == unknown_body["message"]
    assert set(known_body.keys()) == {"email", "message"}


def test_issued_token_is_stored_hashed_and_expiring(magic_token_for):
    email = "camper.hash.test@example.com"
    token = magic_token_for(client, email)

    with SessionLocal() as db:
        record = (
            db.query(MagicToken)
            .filter(MagicToken.email == email)
            .order_by(MagicToken.id.desc())
            .first()
        )
        assert record is not None
        assert record.token_hash == hash_token(token)
        assert record.token_hash != token  # raw credential is never persisted
        assert record.expires_at is not None
        assert record.revoked_at is None
        assert record.last_used_at is None


def test_reissuing_keeps_an_open_session_alive(magic_token_for):
    """A Plan B alert email must not kill a camper's open dashboard session."""
    email = "camper.session.test@example.com"

    first = magic_token_for(client, email)
    second = magic_token_for(client, email)
    assert first != second

    assert client.get(f"/api/v1/saved-trips/{email}?token={first}").status_code == 200
    assert client.get(f"/api/v1/saved-trips/{email}?token={second}").status_code == 200


def test_revoked_token_is_rejected(magic_token_for):
    email = "camper.revoke.test@example.com"
    token = magic_token_for(client, email)

    assert client.get(f"/api/v1/saved-trips/{email}?token={token}").status_code == 200

    with SessionLocal() as db:
        revoked = revoke_magic_tokens(db, email)
    assert revoked >= 1

    assert client.get(f"/api/v1/saved-trips/{email}?token={token}").status_code == 403


def test_expired_token_is_rejected(magic_token_for):
    email = "camper.expiry.test@example.com"
    token = magic_token_for(client, email)

    assert client.get(f"/api/v1/saved-trips/{email}?token={token}").status_code == 200

    with SessionLocal() as db:
        db.query(MagicToken).filter(MagicToken.email == email).update(
            {"expires_at": datetime.utcnow() - timedelta(minutes=1)},
            synchronize_session=False,
        )
        db.commit()

    assert client.get(f"/api/v1/saved-trips/{email}?token={token}").status_code == 403


def test_email_alone_cannot_mint_access(magic_token_for):
    """The core bypass is closed: knowing an address is not enough."""
    email = "camper.victim.test@example.com"
    magic_token_for(client, email)

    assert client.get(f"/api/v1/saved-trips/{email}").status_code == 403
    assert client.get(f"/api/v1/saved-trips/{email}?token=bad-token").status_code == 403
    assert client.get(f"/api/v1/saved-trips/{email}?token={'0' * 64}").status_code == 403
    assert client.get(f"/api/v1/saved-trips/{email}?token={hash_token(email)}").status_code == 403


def test_request_magic_link_invalid_email():
    res = client.post("/api/v1/auth/request-magic-link", json={"email": "not-an-email"})
    assert res.status_code == 422


def test_assert_secret_key_safe_fails_closed_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "dev-secret-key")
    with pytest.raises(RuntimeError):
        assert_secret_key_safe()

    monkeypatch.setattr(settings, "SECRET_KEY", "")
    with pytest.raises(RuntimeError):
        assert_secret_key_safe()

    monkeypatch.setattr(settings, "SECRET_KEY", "a-strong-random-secret-value")
    assert assert_secret_key_safe() is None


def test_assert_secret_key_safe_allows_development(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "SECRET_KEY", "dev-secret-key")
    assert assert_secret_key_safe() is None
