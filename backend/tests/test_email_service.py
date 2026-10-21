import pytest

import app.services.email_service as email_module
from app.core.config import settings
from app.services.email_service import (
    EmailService,
    STATUS_DISABLED,
    STATUS_FAILED,
    STATUS_QUEUED_OUTBOX,
    STATUS_SENT,
)

MAGIC_URL = "https://camping.akstest.win/?email=camper@example.com&token=secret123"

ALTERNATIVES = [
    {"name": "Pebbly Beach", "state": "NSW", "reason": "Forecast stays clear for your dates"},
    {"name": "Euroka Campground", "state": "NSW", "reason": "Sheltered valley, flush toilets"},
]


class _FakeSMTP:
    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        return None

    def login(self, *args, **kwargs):
        return None

    def sendmail(self, *args, **kwargs):
        return {}


class _BrokenSMTP:
    def __init__(self, *args, **kwargs):
        raise OSError("connection refused")


def test_outbox_transport_records_without_claiming_delivery(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "outbox")
    service = EmailService()

    status = service.send_magic_link(recipient_email="camper@example.com", magic_url=MAGIC_URL)

    assert status == STATUS_QUEUED_OUTBOX
    assert len(service.outbox) == 1
    last = service.outbox[-1]
    assert last["to"] == "camper@example.com"
    assert "Camp Smart Australia" in last["subject"]
    assert "secret123" in last["body"]


def test_no_transport_never_reports_sent(monkeypatch):
    """Regression guard: with no transport configured nothing leaves the process,
    so the recorded status must never be SENT."""
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "none")
    service = EmailService()

    assert service.delivers_for_real is False
    status = service.send_magic_link(recipient_email="camper@example.com", magic_url=MAGIC_URL)
    assert status == STATUS_DISABLED
    assert status != STATUS_SENT


def test_smtp_transport_without_host_fails(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    service = EmailService()

    assert service.delivers_for_real is False
    assert service.send_magic_link(recipient_email="c@example.com", magic_url=MAGIC_URL) == STATUS_FAILED


def test_smtp_transport_reports_sent_only_on_success(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USER", None)
    monkeypatch.setattr(settings, "SMTP_PASSWORD", None)
    monkeypatch.setattr(email_module.smtplib, "SMTP", _FakeSMTP)

    service = EmailService()
    assert service.delivers_for_real is True
    assert service.send_magic_link(recipient_email="c@example.com", magic_url=MAGIC_URL) == STATUS_SENT


def test_smtp_transport_reports_failed_on_exception(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(email_module.smtplib, "SMTP", _BrokenSMTP)

    service = EmailService()
    assert service.send_magic_link(recipient_email="c@example.com", magic_url=MAGIC_URL) == STATUS_FAILED


def test_send_plan_b_alert_outbox(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_TRANSPORT", "outbox")
    service = EmailService()

    status = service.send_plan_b_alert(
        recipient_email="camper@example.com",
        trip_name="Green Patch Weekend",
        reason="Severe bushfire warning and park temporary closure",
        switch_url="https://camping.akstest.win/?email=camper@example.com&token=secret123&trip=10",
        alternatives=ALTERNATIVES,
    )

    assert status == STATUS_QUEUED_OUTBOX
    assert len(service.outbox) == 1
    last = service.outbox[-1]
    assert last["to"] == "camper@example.com"
    assert "Plan B Alert" in last["subject"]
    assert "Green Patch Weekend" in last["subject"]
    assert "Pebbly Beach" in last["body"]
    assert "Euroka Campground" in last["body"]
    assert "Severe bushfire warning" in last["body"]
    assert "unsubscribe" in last["body"].lower()
