from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import date

class ChecklistGenerateRequest(BaseModel):
    campsite_id: int
    gear_profile: List[str] = Field(default=[], max_length=30)
    party_size: int = Field(default=2, ge=1, le=100)
    has_dog: Optional[bool] = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class PackingItem(BaseModel):
    category: str
    item: str
    quantity: str
    reason: str
    owned: bool
    borrow_first: bool = False

class ChecklistResponse(BaseModel):
    campsite_id: int
    campsite_name: str
    packing_items: List[PackingItem]
    food_and_shopping: List[str]
    departure_tasks: List[str]
    missing_equipment_alerts: List[str]

    model_config = ConfigDict(from_attributes=True)
