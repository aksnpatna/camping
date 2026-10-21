from pydantic import BaseModel, EmailStr, ConfigDict, Field
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
    # Bounds apply to untrusted input only; responses stay lenient so legacy rows still serialise.
    origin_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    origin_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    max_drive_hours: Optional[float] = Field(default=None, ge=0, le=48)
    party_size: Optional[int] = Field(default=2, ge=1, le=100)
    rig_access: Optional[str] = Field(default=None, max_length=100)
    room_token: Optional[str] = Field(default=None, max_length=64)

class SavedTripResponse(SavedTripBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class SwitchCampsiteRequest(BaseModel):
    new_campsite_id: int

class TogglePlanBRequest(BaseModel):
    active: Optional[bool] = None

class UnsubscribeResponse(BaseModel):
    trip_id: int
    user_email: str
    plan_b_alert_active: bool
    message: str

class SimulateAlertRequest(BaseModel):
    alert_type: Optional[str] = Field(default="WEATHER_WARNING", max_length=40)
    reason: Optional[str] = Field(default="Severe condition shift detected", max_length=300)


