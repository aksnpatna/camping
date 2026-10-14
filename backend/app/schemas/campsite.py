from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.facts import CampsiteFacts

class CampsiteBase(BaseModel):
    name: str
    state: str
    management_type: Optional[str] = None
    dog_friendly: Optional[bool] = None
    rig_access: Optional[List[str]] = None
    facilities: Optional[Dict[str, Any]] = None
    fees: Optional[str] = None
    booking_url: Optional[str] = None
    fire_district: Optional[str] = None
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    # Provenance, so a consumer can tell a sourced record from a hand-written one.
    data_status: Optional[str] = None
    evidence_url: Optional[str] = None
    access_type: Optional[str] = None
    lga: Optional[str] = None
    npws_branch: Optional[str] = None
    asset_comments: Optional[str] = None

class CampsiteCreate(CampsiteBase):
    longitude: float
    latitude: float

class CampsiteResponse(CampsiteBase):
    id: int
    longitude: float
    latitude: float
    verified_at: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None
    facts: Optional[CampsiteFacts] = None
    
    model_config = ConfigDict(from_attributes=True)


class CampsitePlanBAlternative(BaseModel):
    id: int
    name: str
    state: str
    management_type: Optional[str] = None
    dog_friendly: Optional[bool] = None
    driving_time_minutes: Optional[int] = None
    conditions_verified: bool = False
    reason: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    facts: Optional[CampsiteFacts] = None

    model_config = ConfigDict(from_attributes=True)


class CampsitePlanBResponse(BaseModel):
    original_campsite_id: int
    alternatives: List[CampsitePlanBAlternative]

