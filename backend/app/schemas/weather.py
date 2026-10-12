from typing import Optional, Dict, List
from pydantic import BaseModel, Field

class PhaseTelemetry(BaseModel):
    temperature: float = Field(..., description="Estimated ambient temperature in °C for this time of day")
    feels_like: float = Field(..., description="Apparent temperature in °C considering wind chill / humidity")
    wind_speed: float = Field(..., description="Estimated wind speed in km/h")
    humidity_or_dew: str = Field(..., description="Condensation, dew point, or humidity condition")
    condition_description: str = Field(..., description="Atmospheric state e.g. Dawn Chill, Solar Peak")
    camper_tip: str = Field(..., description="Actionable camping guidance for this phase")

class MicroclimateResponse(BaseModel):
    latitude: float
    longitude: float
    date: str
    day_of_year: int
    elevation_m: float
    campsite_id: Optional[int] = None
    campsite_name: Optional[str] = None
    forecast_type: str = Field(..., description="'numerical_ensemble' (<=15d) or 'climatological_physics' (>15d)")
    temp_max: float
    temp_min: float
    rain_probability: int
    expected_rainfall_mm: float
    wind_max_kmh: float
    uv_index_max: int
    phases: Dict[str, PhaseTelemetry]
    sleeping_bag_rating: str
    recommended_mat_r_value: float
    dew_frost_index: str
    campfire_wind_risk: str
    peg_strain_factor: str
    valley_inversion_active: bool
    terrain_notes: List[str]
