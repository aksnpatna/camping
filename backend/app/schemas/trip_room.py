from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import date, datetime

class TripRoomCreate(BaseModel):
    trip_name: str = Field(default="Weekend Camping Trip", min_length=1, max_length=100)
    created_by_email: EmailStr
    start_date: date
    end_date: date
    shortlist_campsite_ids: List[int] = Field(default=[], max_length=30)

class VoteRequest(BaseModel):
    campsite_id: int
    vote_type: str = Field(max_length=10)  # "primary" or "backup"
    voter_name: str = Field(min_length=1, max_length=50)

    @field_validator("vote_type")
    @classmethod
    def _valid_vote_type(cls, value: str) -> str:
        if value.lower() not in ("primary", "backup"):
            raise ValueError("vote_type must be 'primary' or 'backup'")
        return value

class ClaimGearRequest(BaseModel):
    item_name: str = Field(min_length=1, max_length=100)
    claimer_name: str = Field(max_length=50)

class TaskRequest(BaseModel):
    id: Optional[str] = Field(default=None, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    assigned_to: Optional[str] = Field(default=None, max_length=50)
    completed: Optional[bool] = False

class PreferenceRequest(BaseModel):
    member_name: str = Field(min_length=1, max_length=50)
    preference: str = Field(min_length=1, max_length=300)

class ShortlistCampsiteSummary(BaseModel):
    id: int
    name: str
    state: str
    latitude: float
    longitude: float
    dog_friendly: Optional[bool] = None
    rig_access: List[str] = []
    management_type: Optional[str] = None
    primary_votes: int = 0
    backup_votes: int = 0

class TripRoomResponse(BaseModel):
    id: int
    room_token: str
    trip_name: str
    created_by_email: str
    start_date: date
    end_date: date
    shortlist_campsite_ids: List[int]
    shortlist_campsites: List[ShortlistCampsiteSummary] = []
    votes: List[Dict[str, Any]] = []
    primary_votes: Dict[str, int] = {}
    backup_votes: Dict[str, int] = {}
    claimed_gear: List[Dict[str, Any]] = []
    tasks: List[Dict[str, Any]] = []
    preferences: List[Dict[str, Any]] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
