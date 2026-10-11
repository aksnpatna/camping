from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

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

class CampsiteCreate(CampsiteBase):
    longitude: float
    latitude: float

class CampsiteResponse(CampsiteBase):
    id: int
    longitude: float
    latitude: float
    last_verified_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
