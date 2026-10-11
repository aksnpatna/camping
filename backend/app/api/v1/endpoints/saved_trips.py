from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.saved_trip import SavedTripCreate, SavedTripResponse
from app.crud import saved_trip as crud_saved_trip

router = APIRouter()

@router.post("", response_model=SavedTripResponse)
def create_saved_trip(trip: SavedTripCreate, db: Session = Depends(get_db)):
    return crud_saved_trip.create_saved_trip(db=db, trip=trip)

import hmac
import hashlib
import os
from fastapi import HTTPException

def verify_magic_token(email: str, token: str):
    if not token:
        raise HTTPException(status_code=403, detail="Authentication token required")
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    expected_token = hmac.new(secret, email.encode(), hashlib.sha256).hexdigest()
    if token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid magic link token")

@router.get("/{email}", response_model=List[SavedTripResponse])
def read_saved_trips(email: str, token: str = "", skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    verify_magic_token(email, token)
    return crud_saved_trip.get_saved_trips_by_email(db, email=email, skip=skip, limit=limit)

from app.models.campsite import Campsite
from app.models.saved_trip import SavedTrip
from app.models.plan_b_alert import PlanBAlert

@router.get("/dashboard/{email}")
def get_user_dashboard(email: str, token: str = "", db: Session = Depends(get_db)):
    verify_magic_token(email, token)
    trips = db.query(SavedTrip, Campsite).join(Campsite).filter(SavedTrip.user_email == email).all()
    result = []
    for t, c in trips:
        alerts = db.query(PlanBAlert).filter(PlanBAlert.saved_trip_id == t.id).order_by(PlanBAlert.triggered_at.desc()).all()
        alert_list = [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "details": a.details,
                "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
                "delivery_status": a.delivery_status,
                "suggested_alternatives": a.suggested_alternatives or []
            }
            for a in alerts
        ]
        result.append({
            "id": t.id,
            "campsite_id": c.id,
            "campsite_name": c.name,
            "state": c.state,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "plan_b_active": t.plan_b_alert_active,
            "is_shortlist": t.is_shortlist,
            "room_token": t.room_token,
            "alerts": alert_list
        })
    return result

