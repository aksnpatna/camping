import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def _isolate_security_state(monkeypatch):
    """
    Abuse protection is exercised explicitly in tests/api/test_security.py.
    Everywhere else it is switched off so unrelated suites that fire many
    requests from the single TestClient address are not throttled.
    """
    from app.core.security import limiter

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    limiter.reset()
    yield
    limiter.reset()
