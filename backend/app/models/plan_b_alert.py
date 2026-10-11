from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
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
    delivery_status = Column(String, default="DELIVERED")  # "DELIVERED", "FAILED", "PENDING"
    retry_count = Column(Integer, default=0)
    suggested_alternatives = Column(JSON, default=list)  # [{"id": 1, "name": "...", "reason": "..."}]

    # Relationships
    saved_trip = relationship("SavedTrip")
    campsite = relationship("Campsite")
