import pytest
from app.services.email_service import EmailService

def test_email_service_send_magic_link():
    service = EmailService()
    success = service.send_magic_link(
        recipient_email="camper@example.com",
        magic_url="https://camping.akstest.win/?email=camper@example.com&token=secret123"
    )
    assert success is True
    assert len(service.outbox) >= 1
    last = service.outbox[-1]
    assert last["to"] == "camper@example.com"
    assert "Camp Smart Australia" in last["subject"]
    assert "secret123" in last["body"]

def test_email_service_send_plan_b_alert():
    service = EmailService()
    alternatives = [
        {"name": "Pebbly Beach", "state": "NSW", "reason": "Stable conditions, no fire ban"},
        {"name": "Euroka Campground", "state": "NSW", "reason": "Sheltered valley, flush toilets"}
    ]
    success = service.send_plan_b_alert(
        recipient_email="camper@example.com",
        trip_name="Green Patch Weekend",
        reason="Severe bushfire warning and park temporary closure",
        switch_url="https://camping.akstest.win/?email=camper@example.com&token=secret123&trip=10",
        alternatives=alternatives
    )
    assert success is True
    assert len(service.outbox) >= 1
    last = service.outbox[-1]
    assert last["to"] == "camper@example.com"
    assert "Plan B Alert" in last["subject"]
    assert "Green Patch Weekend" in last["subject"]
    assert "Pebbly Beach" in last["body"]
    assert "Euroka Campground" in last["body"]
    assert "Severe bushfire warning" in last["body"]
