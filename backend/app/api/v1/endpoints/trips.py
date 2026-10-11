from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.trip_recommendation import (
    FindWeekendRequest,
    FindWeekendResponse,
    AdjustTripRequest,
    AdjustTripResponse
)
from app.services.llm_inference import LLMInferenceService
from app.services.recommendation_engine import RecommendationEngine

router = APIRouter()

@router.post("/find-weekend", response_model=FindWeekendResponse)
async def find_weekend_trips(request: FindWeekendRequest, db: Session = Depends(get_db)):
    """
    'Find My Weekend' Answer-First Trip Finder:
    Extracts constraints from natural language prompts, applies strict criteria,
    and returns 3 ranked condition-aware trip cards with calculated reasons and compromises.
    """
    if request.prompt:
        extracted = await LLMInferenceService.parse_trip_prompt(request.prompt)
        # Apply extracted attributes if not explicitly passed
        if extracted.get("dog_friendly") is not None and request.dog_friendly is None:
            request.dog_friendly = extracted["dog_friendly"]
        if extracted.get("max_drive_hours") and (request.max_drive_hours is None or request.max_drive_hours == 4.0):
            request.max_drive_hours = extracted["max_drive_hours"]
        if extracted.get("rig_access") and not request.rig_access:
            request.rig_access = extracted["rig_access"]
        if extracted.get("origin_lat") and extracted.get("origin_lng"):
            request.origin_lat = extracted["origin_lat"]
            request.origin_lng = extracted["origin_lng"]

    response = RecommendationEngine.find_weekend(db=db, request=request)
    if request.prompt:
        response.parsed_criteria = {
            "dog_friendly": request.dog_friendly,
            "max_drive_hours": request.max_drive_hours,
            "rig_access": request.rig_access
        }
    return response

@router.post("/adjust", response_model=AdjustTripResponse)
async def adjust_trip_parameters(request: AdjustTripRequest, db: Session = Depends(get_db)):
    """
    'What-If' Conversational Adjustments:
    Interprets follow-up requests (e.g. 'Leave Saturday instead', 'Allow another 30 mins driving'),
    updates visible constraints, and re-runs recommendation ranking.
    """
    current_dict = request.current_request.model_dump()
    updated_dict = LLMInferenceService.adjust_constraints_deterministic(current_dict, request.instruction)
    
    updated_req = FindWeekendRequest(**updated_dict)
    response = RecommendationEngine.find_weekend(db=db, request=updated_req)

    return AdjustTripResponse(
        updated_request=updated_req,
        cards=response.cards,
        limiting_constraint=response.limiting_constraint,
        suggested_adjustments=response.suggested_adjustments
    )

# --- Phase 2: Prepare Together Journey Endpoints ---
from app.schemas.checklist import ChecklistGenerateRequest, ChecklistResponse
from app.services.checklist_service import ChecklistService
from app.schemas.trip_room import (
    TripRoomCreate,
    VoteRequest,
    ClaimGearRequest,
    TaskRequest,
    PreferenceRequest,
    TripRoomResponse
)
from app.crud import trip_room as crud_trip_room

@router.post("/checklist/generate", response_model=ChecklistResponse)
def generate_trip_checklist(request: ChecklistGenerateRequest, db: Session = Depends(get_db)):
    """
    Generate dynamic, condition-aware packing checklist with calculated reasons,
    food/shopping essentials, pre-departure tasks, and missing equipment borrow alerts.
    """
    return ChecklistService.generate_checklist(db=db, request=request)

@router.post("/rooms", response_model=TripRoomResponse)
def create_room(room_in: TripRoomCreate, db: Session = Depends(get_db)):
    """
    Create a shareable Trip Room for a group to coordinate shortlists, vote on campsites,
    claim equipment, and manage departure tasks.
    """
    return crud_trip_room.create_trip_room(db=db, data=room_in)

@router.get("/rooms/{room_token}", response_model=TripRoomResponse)
def get_room(room_token: str, db: Session = Depends(get_db)):
    """
    Retrieve full state of a shared Trip Room.
    """
    return crud_trip_room.get_trip_room_by_token(db=db, token=room_token)

@router.post("/rooms/{room_token}/vote", response_model=TripRoomResponse)
def vote_room_campsite(room_token: str, vote: VoteRequest, db: Session = Depends(get_db)):
    """
    Vote for a shortlisted campsite (Primary vs. Backup).
    """
    return crud_trip_room.vote_campsite(db=db, token=room_token, vote=vote)

@router.post("/rooms/{room_token}/claim-gear", response_model=TripRoomResponse)
def claim_room_gear(room_token: str, claim: ClaimGearRequest, db: Session = Depends(get_db)):
    """
    Claim shared equipment to bring for the group.
    """
    return crud_trip_room.claim_gear(db=db, token=room_token, claim=claim)

@router.post("/rooms/{room_token}/task", response_model=TripRoomResponse)
def update_room_task(room_token: str, task: TaskRequest, db: Session = Depends(get_db)):
    """
    Add or toggle completion of a group preparation task.
    """
    return crud_trip_room.add_or_update_task(db=db, token=room_token, task=task)

@router.post("/rooms/{room_token}/preference", response_model=TripRoomResponse)
def add_room_preference(room_token: str, pref: PreferenceRequest, db: Session = Depends(get_db)):
    """
    Add personal notes or preferences to the group room.
    """
    return crud_trip_room.add_preference(db=db, token=room_token, pref=pref)

