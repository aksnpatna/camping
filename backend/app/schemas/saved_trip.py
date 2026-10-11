from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import date
from typing import Optional

class SavedTripBase(BaseModel):
    campsite_id: int
    user_email: EmailStr
    start_date: date
    end_date: date
    plan_b_alert_active: Optional[bool] = True
    is_shortlist: Optional[bool] = False
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    max_drive_hours: Optional[float] = None
    party_size: Optional[int] = 2
    has_dog: Optional[bool] = None
    rig_access: Optional[str] = None
    room_token: Optional[str] = None

class SavedTripCreate(SavedTripBase):
    pass

class SavedTripResponse(SavedTripBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


