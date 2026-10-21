import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_META_BYTES = 4096


class AnalyticsEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=50)
    path: str = Field(min_length=1, max_length=500)
    referrer: Optional[str] = Field(default=None, max_length=500)
    session_id: Optional[str] = Field(default=None, max_length=100)
    user_email: Optional[str] = Field(default=None, max_length=254)
    meta_data: Optional[Dict[str, Any]] = None

    @field_validator("meta_data")
    @classmethod
    def _cap_meta_size(cls, value):
        if value is not None and len(json.dumps(value, default=str)) > MAX_META_BYTES:
            raise ValueError(f"meta_data must be under {MAX_META_BYTES} bytes")
        return value

class AnalyticsEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    path: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime

class EmailLeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    source: str
    status: str
    trips_count: int
    first_ip: Optional[str] = None
    last_active_at: datetime
    created_at: datetime
    meta_data: Optional[Dict[str, Any]] = None

class AnalyticsSummaryResponse(BaseModel):
    total_events: int
    unique_ips: int
    unique_sessions: int
    total_leads: int
    top_pages: List[Dict[str, Any]]
    recent_events: List[AnalyticsEventResponse]
    recent_leads: List[EmailLeadResponse]
