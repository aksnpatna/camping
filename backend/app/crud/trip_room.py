import uuid
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.trip_room import TripRoom
from app.models.campsite import Campsite
from app.schemas.trip_room import (
    TripRoomCreate,
    VoteRequest,
    ClaimGearRequest,
    TaskRequest,
    PreferenceRequest,
    TripRoomResponse,
    ShortlistCampsiteSummary
)

def create_trip_room(db: Session, data: TripRoomCreate) -> TripRoomResponse:
    token = uuid.uuid4().hex[:12]
    room = TripRoom(
        room_token=token,
        trip_name=data.trip_name,
        created_by_email=data.created_by_email,
        start_date=data.start_date,
        end_date=data.end_date,
        shortlist_campsite_ids=data.shortlist_campsite_ids,
        votes=[],
        claimed_gear=[],
        tasks=[
            {"id": str(uuid.uuid4())[:8], "title": "Check fire danger status", "completed": False, "assigned_to": None},
            {"id": str(uuid.uuid4())[:8], "title": "Download offline maps", "completed": False, "assigned_to": None}
        ],
        preferences=[]
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return format_trip_room_response(db, room)

def get_trip_room_by_token(db: Session, token: str) -> TripRoomResponse:
    room = db.query(TripRoom).filter(TripRoom.room_token == token).first()
    if not room:
        raise HTTPException(status_code=404, detail="Trip room not found")
    return format_trip_room_response(db, room)

def vote_campsite(db: Session, token: str, vote: VoteRequest) -> TripRoomResponse:
    room = db.query(TripRoom).filter(TripRoom.room_token == token).first()
    if not room:
        raise HTTPException(status_code=404, detail="Trip room not found")

    votes = list(room.votes or [])
    matching = next((v for v in votes if v.get("voter_name") == vote.voter_name and v.get("campsite_id") == vote.campsite_id), None)
    if matching and matching.get("vote_type") == vote.vote_type.lower():
        # Toggle off if same vote clicked again
        votes = [v for v in votes if not (v.get("voter_name") == vote.voter_name and v.get("campsite_id") == vote.campsite_id)]
    else:
        # Replace existing or add new
        votes = [v for v in votes if not (v.get("voter_name") == vote.voter_name and v.get("campsite_id") == vote.campsite_id)]
        votes.append({
            "campsite_id": vote.campsite_id,
            "voter_name": vote.voter_name,
            "vote_type": vote.vote_type.lower()
        })
    room.votes = votes
    db.commit()
    db.refresh(room)
    return format_trip_room_response(db, room)

def claim_gear(db: Session, token: str, claim: ClaimGearRequest) -> TripRoomResponse:
    room = db.query(TripRoom).filter(TripRoom.room_token == token).first()
    if not room:
        raise HTTPException(status_code=404, detail="Trip room not found")

    claimed = list(room.claimed_gear or [])
    if not claim.claimer_name or claim.claimer_name.strip() == "":
        # Unclaim item
        claimed = [c for c in claimed if c.get("item_name") != claim.item_name]
    else:
        existing = next((c for c in claimed if c.get("item_name") == claim.item_name), None)
        if existing:
            existing["claimed_by"] = claim.claimer_name.strip()
        else:
            claimed.append({
                "item_name": claim.item_name,
                "claimed_by": claim.claimer_name.strip()
            })
    room.claimed_gear = claimed
    db.commit()
    db.refresh(room)
    return format_trip_room_response(db, room)

def add_or_update_task(db: Session, token: str, task: TaskRequest) -> TripRoomResponse:
    room = db.query(TripRoom).filter(TripRoom.room_token == token).first()
    if not room:
        raise HTTPException(status_code=404, detail="Trip room not found")

    tasks = list(room.tasks or [])
    if task.id:
        existing = next((t for t in tasks if t.get("id") == task.id), None)
        if existing:
            existing["title"] = task.title
            if task.assigned_to is not None:
                existing["assigned_to"] = task.assigned_to
            if task.completed is not None:
                existing["completed"] = task.completed
    else:
        tasks.append({
            "id": str(uuid.uuid4())[:8],
            "title": task.title,
            "completed": bool(task.completed),
            "assigned_to": task.assigned_to
        })
    room.tasks = tasks
    db.commit()
    db.refresh(room)
    return format_trip_room_response(db, room)

def add_preference(db: Session, token: str, pref: PreferenceRequest) -> TripRoomResponse:
    room = db.query(TripRoom).filter(TripRoom.room_token == token).first()
    if not room:
        raise HTTPException(status_code=404, detail="Trip room not found")

    preferences = list(room.preferences or [])
    preferences.append({
        "member_name": pref.member_name,
        "preference": pref.preference
    })
    room.preferences = preferences
    db.commit()
    db.refresh(room)
    return format_trip_room_response(db, room)

def format_trip_room_response(db: Session, room: TripRoom) -> TripRoomResponse:
    campsite_ids = room.shortlist_campsite_ids or []
    campsites = db.query(Campsite).filter(Campsite.id.in_(campsite_ids)).all() if campsite_ids else []

    primary_votes: Dict[str, int] = {}
    backup_votes: Dict[str, int] = {}

    for v in (room.votes or []):
        cid = str(v.get("campsite_id"))
        vtype = v.get("vote_type", "primary").lower()
        if vtype == "primary":
            primary_votes[cid] = primary_votes.get(cid, 0) + 1
        else:
            backup_votes[cid] = backup_votes.get(cid, 0) + 1

    summaries = []
    for c in campsites:
        cid_str = str(c.id)
        summaries.append(ShortlistCampsiteSummary(
            id=c.id,
            name=c.name,
            state=c.state,
            latitude=c.latitude,
            longitude=c.longitude,
            dog_friendly=c.dog_friendly,
            rig_access=c.rig_access or [],
            management_type=c.management_type,
            primary_votes=primary_votes.get(cid_str, 0),
            backup_votes=backup_votes.get(cid_str, 0)
        ))

    return TripRoomResponse(
        id=room.id,
        room_token=room.room_token,
        trip_name=room.trip_name,
        created_by_email=room.created_by_email,
        start_date=room.start_date,
        end_date=room.end_date,
        shortlist_campsite_ids=campsite_ids,
        shortlist_campsites=summaries,
        votes=room.votes or [],
        primary_votes=primary_votes,
        backup_votes=backup_votes,
        claimed_gear=room.claimed_gear or [],
        tasks=room.tasks or [],
        preferences=room.preferences or [],
        created_at=room.created_at
    )
