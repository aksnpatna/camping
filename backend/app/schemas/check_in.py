from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class CheckInCreate(BaseModel):
    water_status: Optional[str] = None     # "flowing" | "trickle" | "dry" | "not_applicable"
    toilets_status: Optional[str] = None   # "clean" | "bring_tp" | "poor" | "no_toilets"
    road_status: Optional[str] = None      # "2wd_clear" | "corrugated" | "4wd_only" | "muddy"
    vibe_status: Optional[str] = None      # "plenty_space" | "filling_fast" | "full"
    telco_status: Optional[str] = None     # "telstra_4g" | "optus_4g" | "no_service"
    notes: Optional[str] = None

class CheckInResponse(BaseModel):
    id: int
    campsite_id: int
    created_at: datetime
    water_status: Optional[str] = None
    toilets_status: Optional[str] = None
    road_status: Optional[str] = None
    vibe_status: Optional[str] = None
    telco_status: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CheckInSummary(BaseModel):
    water: Optional[str] = None
    toilets: Optional[str] = None
    road: Optional[str] = None
    vibe: Optional[str] = None
    telco: Optional[str] = None
    last_updated: Optional[str] = None

class CampsiteCheckInsListResponse(BaseModel):
    total_count: int
    summary: CheckInSummary
    recent_check_ins: List[CheckInResponse]
