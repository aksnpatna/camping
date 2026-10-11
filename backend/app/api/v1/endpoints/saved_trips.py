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

def verify_magic_token(email: str, token: str, status_code: int = 403):
    if not token:
        raise HTTPException(status_code=status_code, detail="Authentication token required")
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    expected_token = hmac.new(secret, email.encode(), hashlib.sha256).hexdigest()
    if token != expected_token:
        raise HTTPException(status_code=status_code, detail="Invalid magic link token")

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

from app.schemas.saved_trip import SwitchCampsiteRequest, SimulateAlertRequest
from app.worker.plan_b import find_plan_b_alternatives

@router.post("/{trip_id}/switch-campsite", response_model=SavedTripResponse)
def switch_campsite(trip_id: int, switch_data: SwitchCampsiteRequest, token: str = "", db: Session = Depends(get_db)):
    """
    Switch a saved trip to an alternative campsite (e.g. from a Plan B alert).
    """
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")
    
    verify_magic_token(trip.user_email, token, status_code=401)

    new_site = db.query(Campsite).filter(Campsite.id == switch_data.new_campsite_id).first()
    if not new_site:
        raise HTTPException(status_code=404, detail="Target campsite not found")

    trip.campsite_id = new_site.id
    db.commit()
    db.refresh(trip)
    return trip

@router.post("/{trip_id}/simulate-alert")
def simulate_plan_b_alert(trip_id: int, sim_data: SimulateAlertRequest, token: str = "", db: Session = Depends(get_db)):
    """
    Simulate a condition shift (weather warning / fire ban) and generate persistent Plan B alert with alternatives.
    """
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")

    verify_magic_token(trip.user_email, token, status_code=401)

    campsite = db.query(Campsite).filter(Campsite.id == trip.campsite_id).first()
    alternatives = find_plan_b_alternatives(db, trip, campsite) if campsite else []

    alert = PlanBAlert(
        saved_trip_id=trip.id,
        user_email=trip.user_email,
        campsite_id=trip.campsite_id,
        alert_type=sim_data.alert_type or "WEATHER_WARNING",
        details=sim_data.reason or "Simulated weather/condition shift detected in campground area.",
        suggested_alternatives=alternatives,
        delivery_status="DELIVERED",
        retry_count=0
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "saved_trip_id": alert.saved_trip_id,
        "alert_type": alert.alert_type,
        "details": alert.details,
        "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
        "delivery_status": alert.delivery_status,
        "suggested_alternatives": alert.suggested_alternatives
    }


