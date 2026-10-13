from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base

class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    path = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(64), nullable=True, index=True)
    user_agent = Column(String(500), nullable=True)
    referrer = Column(String(500), nullable=True)
    session_id = Column(String(64), nullable=True, index=True)
    user_email = Column(String(255), nullable=True, index=True)
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class EmailLead(Base):
    __tablename__ = "email_leads"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    source = Column(String(50), default="saved_trip", index=True, nullable=False)
    status = Column(String(20), default="active", nullable=False)
    trips_count = Column(Integer, default=1, nullable=False)
    first_ip = Column(String(64), nullable=True)
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    meta_data = Column(JSON, nullable=True)
