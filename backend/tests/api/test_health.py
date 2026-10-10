from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_health_check_returns_200():
    """Ensure the health check endpoint returns 200 OK and expected payload."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "development"}
