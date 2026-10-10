from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(Integer, primary_key=True, index=True)
    campsite_id = Column(Integer, ForeignKey("canonical_campsites.id"), nullable=False)
    user_email = Column(String, index=True, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    plan_b_alert_active = Column(Boolean, default=True)

    # Relationships
    campsite = relationship("Campsite")
