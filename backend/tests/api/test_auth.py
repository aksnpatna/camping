import hmac
import hashlib
import os
from fastapi.testclient import TestClient
from app.main import app
from app.services.email_service import email_service

client = TestClient(app)

def test_request_magic_link_success():
    email = "camper.auth.test@example.com"
    email_service.clear_outbox()

    res = client.post("/api/v1/auth/request-magic-link", json={"email": email})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert "magic_link" in data
    assert "message" in data

    # Verify deterministic HMAC token matches expected
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    expected_token = hmac.new(secret, email.encode(), hashlib.sha256).hexdigest()
    assert data["token"] == expected_token
    assert f"email={email}" in data["magic_link"]
    assert f"token={expected_token}" in data["magic_link"]

    # Verify email was dispatched to outbox
    assert len(email_service.outbox) == 1
    sent = email_service.outbox[0]
    assert sent["to_email"] == email
    assert "Camp Smart Australia Access Link" in sent["subject"]
    assert expected_token in sent["body_html"]

def test_request_magic_link_invalid_email():
    res = client.post("/api/v1/auth/request-magic-link", json={"email": "not-an-email"})
    assert res.status_code == 422
