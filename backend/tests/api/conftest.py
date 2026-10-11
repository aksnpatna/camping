import re

import pytest

from app.core.config import settings
from app.services.email_service import email_service

TOKEN_PATTERN = re.compile(r"token=([A-Za-z0-9_\-]+)")


@pytest.fixture(autouse=True)
def outbox_transport(monkeypatch):
    """
    Run API tests against the explicit development outbox transport so delivery
    outcomes are deterministic.

    This never claims real delivery: the recorded status is QUEUED_OUTBOX, not
    SENT, which is exactly the honesty the production code must preserve.
    """
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "outbox")
    email_service.clear_outbox()
    yield
    email_service.clear_outbox()


@pytest.fixture
def magic_token_for():
    """
    Obtain a real magic-link token through the production code path.

    Doubles as the token-leak regression guard: because the HTTP response is
    asserted to carry neither the token nor the link, the only way to recover a
    working credential is out of the emailed body.
    """

    def _obtain(client, email: str) -> str:
        email_service.clear_outbox()
        res = client.post("/api/v1/auth/request-magic-link", json={"email": email})
        assert res.status_code == 200, res.text

        body = res.json()
        assert "token" not in body, "magic-link response must never reveal the token"
        assert "magic_link" not in body, "magic-link response must never reveal the link"

        assert len(email_service.outbox) == 1, "expected exactly one magic-link email"
        match = TOKEN_PATTERN.search(email_service.outbox[0]["body_html"])
        assert match, "magic-link email did not contain a token"
        return match.group(1)

    return _obtain
