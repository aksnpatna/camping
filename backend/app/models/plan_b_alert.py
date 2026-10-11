from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class PlanBAlert(Base):
    __tablename__ = "plan_b_alerts"

    id = Column(Integer, primary_key=True, index=True)
    saved_trip_id = Column(Integer, ForeignKey("saved_trips.id"), nullable=False, index=True)
    user_email = Column(String, index=True, nullable=False)
    campsite_id = Column(Integer, ForeignKey("canonical_campsites.id"), nullable=False)
    alert_type = Column(String, nullable=False)  # "WEATHER_WARNING", "FIRE_DANGER", "PARK_CLOSURE"
    details = Column(String, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    # "SENT", "FAILED", "QUEUED_OUTBOX", "DISABLED", "PENDING" — must reflect what
    # actually happened. Never recorded as SENT unless SMTP accepted the message.
    delivery_status = Column(String, default="PENDING")
    retry_count = Column(Integer, default=0)
    # Coarse escalation level (1-3) used to suppress repeat alerts for an
    # unchanged condition while still allowing through a genuine worsening.
    severity = Column(Integer, default=1, nullable=False)
    # Origin URL for news-derived alerts, so one headline alerts a trip once.
    source_url = Column(Text, nullable=True)
    suggested_alternatives = Column(JSON, default=list)  # [{"id": 1, "name": "...", "reason": "..."}]

    # Relationships
    saved_trip = relationship("SavedTrip")
    campsite = relationship("Campsite")
