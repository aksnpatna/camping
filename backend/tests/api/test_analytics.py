from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analytics_event_ingestion_and_summary():
    # 1. Post a page view event
    event_payload = {
        "event_type": "page_view",
        "path": "/explore/sawpit-picnic-area",
        "referrer": "https://google.com",
        "session_id": "test-session-123",
        "meta_data": {"device": "mobile", "campsite_name": "Sawpit Picnic Area"}
    }
    res = client.post("/api/v1/analytics/events", json=event_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["event_type"] == "page_view"
    assert data["path"] == "/explore/sawpit-picnic-area"
    assert "id" in data

    # 2. Post a trip save event with an email
    lead_email = "camper_test_analytics@campsmart.au"
    event_with_email = {
        "event_type": "trip_saved",
        "path": "/trip-saved",
        "session_id": "test-session-123",
        "user_email": lead_email,
        "meta_data": {"campsite_id": 2614, "action": "saved_trip"}
    }
    res2 = client.post("/api/v1/analytics/events", json=event_with_email)
    assert res2.status_code == 201

    # 3. Fetch analytics summary
    summary_res = client.get("/api/v1/analytics/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_events"] >= 2
    assert summary["unique_ips"] >= 1
    assert any(p["path"] == "/explore/sawpit-picnic-area" for p in summary["top_pages"])

    # 4. Fetch email leads list
    leads_res = client.get("/api/v1/analytics/leads")
    assert leads_res.status_code == 200
    leads = leads_res.json()
    emails = [l["email"] for l in leads]
    assert lead_email in emails


def test_beta_feedback_event_and_lead_capture():
    feedback_email = "feedback_camper@example.com.au"
    payload = {
        "event_type": "beta_feedback",
        "path": "/?city=Sydney&max_hours=3",
        "session_id": "test-feedback-session-456",
        "user_email": feedback_email,
        "meta_data": {
            "category": "data_issue",
            "rating": 4,
            "message": "Euroka Campground toilets had no toilet paper on Saturday morning.",
            "campsite_name": "Euroka Campground",
            "viewport": "390x844"
        }
    }
    res = client.post("/api/v1/analytics/events", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["event_type"] == "beta_feedback"
    assert data["meta_data"]["category"] == "data_issue"
    assert data["meta_data"]["campsite_name"] == "Euroka Campground"
    assert data["user_email"] == feedback_email

    # Verify that the email is captured as a lead
    leads_res = client.get("/api/v1/analytics/leads")
    assert leads_res.status_code == 200
    emails = [l["email"] for l in leads_res.json()]
    assert feedback_email in emails
