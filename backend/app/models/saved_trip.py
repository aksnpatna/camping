from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, Float
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

    # v2 Shortlist and Camper Intent preservation
    is_shortlist = Column(Boolean, default=False, nullable=False)
    origin_lat = Column(Float, nullable=True)
    origin_lng = Column(Float, nullable=True)
    max_drive_hours = Column(Float, nullable=True)
    party_size = Column(Integer, nullable=True)
    has_dog = Column(Boolean, nullable=True)
    rig_access = Column(String, nullable=True)
    room_token = Column(String, nullable=True, index=True)

    # Relationships
    campsite = relationship("Campsite")

