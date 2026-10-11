from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any

class FindWeekendRequest(BaseModel):
    prompt: Optional[str] = None
    origin_lat: Optional[float] = -33.8688 # Sydney CBD default
    origin_lng: Optional[float] = 151.2093
    max_drive_hours: Optional[float] = 4.0
    dog_friendly: Optional[bool] = None
    rig_access: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

class TripRecommendationCard(BaseModel):
    id: int
    name: str
    state: str
    latitude: float
    longitude: float
    dog_friendly: Optional[bool] = None
    rig_access: Optional[List[str]] = None
    vehicle_clearance: str = "2WD"
    driving_distance_km: int
    driving_time_minutes: int
    highlight_badge: str
    why_it_fits: List[str]
    main_compromise: str
    estimated_cost: str
    booking_status: str
    booking_url: Optional[str] = None
    management_type: Optional[str] = None
    facilities: Optional[Dict[str, Any]] = None
    fees: Optional[str] = None

class FindWeekendResponse(BaseModel):
    cards: List[TripRecommendationCard]
    limiting_constraint: Optional[str] = None
    suggested_adjustments: List[str] = []
    parsed_criteria: Optional[Dict[str, Any]] = None

class AdjustTripRequest(BaseModel):
    current_request: FindWeekendRequest
    instruction: str

class AdjustTripResponse(BaseModel):
    updated_request: FindWeekendRequest
    cards: List[TripRecommendationCard]
    limiting_constraint: Optional[str] = None
    suggested_adjustments: List[str] = []
