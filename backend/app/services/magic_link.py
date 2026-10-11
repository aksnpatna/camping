import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings, DEV_SECRET_KEY
from app.models.magic_token import MagicToken

logger = logging.getLogger(__name__)

PRODUCTION_LIKE = ("production", "prod", "staging", "stage")


def assert_secret_key_safe() -> None:
    """
    Fail closed when a production-like environment is running with the shipped
    development secret. A weak or predictable SECRET_KEY undermines every
    signature the service produces.
    """
    environment = (settings.ENVIRONMENT or "").strip().lower()
    if environment in PRODUCTION_LIKE:
        if not settings.SECRET_KEY or settings.SECRET_KEY == DEV_SECRET_KEY:
            raise RuntimeError(
                "Refusing to start: SECRET_KEY is unset or still the development "
                f"default while ENVIRONMENT='{environment}'. Set a strong random "
                "SECRET_KEY before running outside development."
            )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def build_magic_link(email: str, token: str) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/?email={email}&token={token}"


def issue_magic_token(db: Session, email: str) -> str:
    """
    Mint a fresh random, expiring token for this address.

    Previously issued tokens are deliberately left alive: a Plan B alert email
    must not kill a camper's open dashboard session. Each token expires on its
    own short TTL and can be revoked explicitly.

    Returns the raw token. Callers must only ever place it in an outbound email,
    never in an HTTP response body.
    """
    normalized = email.strip().lower()
    now = datetime.utcnow()
    raw_token = secrets.token_urlsafe(32)
    ttl_minutes = max(int(settings.MAGIC_TOKEN_TTL_MINUTES or 30), 1)

    db.add(
        MagicToken(
            email=normalized,
            token_hash=hash_token(raw_token),
            expires_at=now + timedelta(minutes=ttl_minutes),
            created_at=now,
        )
    )
    db.commit()
    return raw_token


def revoke_magic_tokens(db: Session, email: str) -> int:
    """Explicitly invalidate every live token for an address."""
    normalized = email.strip().lower()
    count = (
        db.query(MagicToken)
        .filter(MagicToken.email == normalized, MagicToken.revoked_at.is_(None))
        .update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return count


def resolve_magic_token(db: Session, email: str, token: Optional[str]) -> Optional[MagicToken]:
    """Return the live MagicToken row for this email/token pair, or None."""
    if not token:
        return None

    normalized = email.strip().lower()
    now = datetime.utcnow()

    record = (
        db.query(MagicToken)
        .filter(
            MagicToken.email == normalized,
            MagicToken.token_hash == hash_token(token),
            MagicToken.revoked_at.is_(None),
            MagicToken.expires_at > now,
        )
        .first()
    )
    if record is None:
        return None

    # Constant-time confirmation that the stored hash still matches the presented
    # token before it is accepted.
    if not hmac.compare_digest(record.token_hash, hash_token(token)):
        return None

    record.last_used_at = now
    db.commit()
    return record


def verify_magic_token(db: Session, email: str, token: Optional[str], status_code: int = 403) -> None:
    """
    Ownership gate for per-camper resources. Raises unless the caller presents a
    live, unexpired, unrevoked token that was issued for exactly this address.
    """
    if not token:
        raise HTTPException(status_code=status_code, detail="Authentication token required")

    if resolve_magic_token(db, email, token) is None:
        raise HTTPException(
            status_code=status_code,
            detail="Invalid, expired or revoked magic link token",
        )
