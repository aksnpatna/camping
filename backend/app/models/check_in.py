from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class CampsiteCheckIn(Base):
    __tablename__ = "campsite_check_ins"

    id = Column(Integer, primary_key=True, index=True)
    campsite_id = Column(Integer, ForeignKey("canonical_campsites.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Quick micro-status signals
    water_status = Column(String(30), nullable=True)     # "flowing" | "trickle" | "dry" | "not_applicable"
    toilets_status = Column(String(30), nullable=True)   # "clean" | "bring_tp" | "poor" | "no_toilets"
    road_status = Column(String(30), nullable=True)      # "2wd_clear" | "corrugated" | "4wd_only" | "muddy"
    vibe_status = Column(String(30), nullable=True)      # "plenty_space" | "filling_fast" | "full"
    telco_status = Column(String(30), nullable=True)     # "telstra_4g" | "optus_4g" | "no_service"
    
    notes = Column(String(255), nullable=True)
