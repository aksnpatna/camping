from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class MagicToken(Base):
    """
    Single-live, expiring, revocable sign-in token.

    Only the SHA-256 hash is stored, so a database read never yields a usable
    credential. The raw token exists solely inside the emailed magic link and is
    never returned by any HTTP response.
    """

    __tablename__ = "magic_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
