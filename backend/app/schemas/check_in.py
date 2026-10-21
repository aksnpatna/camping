from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class CheckInCreate(BaseModel):
    water_status: Optional[Literal["flowing", "trickle", "dry", "not_applicable"]] = None
    toilets_status: Optional[Literal["clean", "bring_tp", "poor", "no_toilets"]] = None
    road_status: Optional[Literal["2wd_clear", "corrugated", "4wd_only", "muddy"]] = None
    vibe_status: Optional[Literal["plenty_space", "filling_fast", "full"]] = None
    telco_status: Optional[Literal["telstra_4g", "optus_4g", "no_service"]] = None
    notes: Optional[str] = Field(default=None, max_length=500)

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
