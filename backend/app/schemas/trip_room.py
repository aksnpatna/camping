from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import date, datetime

class TripRoomCreate(BaseModel):
    trip_name: str = "Weekend Camping Trip"
    created_by_email: EmailStr
    start_date: date
    end_date: date
    shortlist_campsite_ids: List[int] = []

class VoteRequest(BaseModel):
    campsite_id: int
    vote_type: str  # "primary" or "backup"
    voter_name: str

class ClaimGearRequest(BaseModel):
    item_name: str
    claimer_name: str

class TaskRequest(BaseModel):
    id: Optional[str] = None
    title: str
    assigned_to: Optional[str] = None
    completed: Optional[bool] = False

class PreferenceRequest(BaseModel):
    member_name: str
    preference: str

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
