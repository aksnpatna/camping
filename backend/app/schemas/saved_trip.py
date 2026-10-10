from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional

class SavedTripBase(BaseModel):
    campsite_id: int
    user_email: EmailStr
    start_date: date
    end_date: date
    plan_b_alert_active: Optional[bool] = True

class SavedTripCreate(SavedTripBase):
    pass

class SavedTripResponse(SavedTripBase):
    id: int

    class Config:
        from_attributes = True
