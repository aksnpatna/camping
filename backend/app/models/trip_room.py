from datetime import datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, JSON
from app.core.database import Base

class TripRoom(Base):
    __tablename__ = "trip_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_token = Column(String, unique=True, index=True, nullable=False)
    trip_name = Column(String, nullable=False)
    created_by_email = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    shortlist_campsite_ids = Column(JSON, default=list)
    votes = Column(JSON, default=list)  # [{"campsite_id": 1, "voter_name": "...", "vote_type": "primary" | "backup"}]
    claimed_gear = Column(JSON, default=list)  # [{"item_name": "...", "claimed_by": "..."}]
    tasks = Column(JSON, default=list)  # [{"id": "...", "title": "...", "completed": false, "assigned_to": "..."}]
    preferences = Column(JSON, default=list)  # [{"member_name": "...", "preference": "..."}]
    created_at = Column(DateTime, default=datetime.utcnow)
