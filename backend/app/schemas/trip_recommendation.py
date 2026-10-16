from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from app.schemas.facts import CampsiteFacts

class WeatherDaySummary(BaseModel):
    dayName: str
    dateStr: str
    minTemp: float
    maxTemp: float
    rainProb: int
    gearRecommendation: str
    conditionIcon: str  # "sun" | "rain" | "wind"

class GearFitSummary(BaseModel):
    overnight_min_temp: float
    sleeping_bag_rating: str
    recommended_mat_r_value: float
    dew_frost_index: str
    campfire_wind_risk: str

class FindWeekendRequest(BaseModel):
    prompt: Optional[str] = None
    origin_lat: Optional[float] = -33.8688 # Sydney CBD default
    origin_lng: Optional[float] = 151.2093
    max_drive_hours: Optional[float] = 4.0
    dog_friendly: Optional[bool] = None
    rig_access: Optional[str] = None
    target_weekend: Optional[str] = "this_weekend"  # "this_weekend" | "next_weekend" | "long_weekend" | "custom"
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
    booking_type: str = "FIRST_COME_FIRST_SERVED"
    availability_window: str = ""
    booking_url: Optional[str] = None
    management_type: Optional[str] = None
    facilities: Optional[Dict[str, Any]] = None
    fees: Optional[str] = None
    fire_district: Optional[str] = None
    # Provenance: lets the UI label a card "Not verified yet" instead of
    # presenting hand-written values as if they were sourced.
    data_status: Optional[str] = None
    source_url: Optional[str] = None
    evidence_url: Optional[str] = None
    visual_badges: Optional[Dict[str, str]] = None
    community_signals: Optional[Dict[str, Any]] = None
    photo_url: Optional[str] = None
    is_illustrative_photo: bool = False
    facts: Optional[CampsiteFacts] = None
    weather_days: Optional[List[WeatherDaySummary]] = None
    gear_fit: Optional[GearFitSummary] = None

class FindWeekendResponse(BaseModel):
    cards: List[TripRecommendationCard]
    limiting_constraint: Optional[str] = None
    suggested_adjustments: List[str] = []
    parsed_criteria: Optional[Dict[str, Any]] = None
    assumed_origin: Optional[str] = None

class AdjustTripRequest(BaseModel):
    current_request: FindWeekendRequest
    instruction: str

class AdjustTripResponse(BaseModel):
    updated_request: FindWeekendRequest
    cards: List[TripRecommendationCard]
    limiting_constraint: Optional[str] = None
    suggested_adjustments: List[str] = []
    assumed_origin: Optional[str] = None
