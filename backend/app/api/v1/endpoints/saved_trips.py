from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.saved_trip import SavedTripCreate, SavedTripResponse
from app.crud import saved_trip as crud_saved_trip

router = APIRouter()

@router.post("/", response_model=SavedTripResponse)
def create_saved_trip(trip: SavedTripCreate, db: Session = Depends(get_db)):
    return crud_saved_trip.create_saved_trip(db=db, trip=trip)

@router.get("/{email}", response_model=List[SavedTripResponse])
def read_saved_trips(email: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_saved_trip.get_saved_trips_by_email(db, email=email, skip=skip, limit=limit)

from app.models.campsite import Campsite
from app.models.saved_trip import SavedTrip
@router.get("/dashboard/{email}")
def get_user_dashboard(email: str, db: Session = Depends(get_db)):
    trips = db.query(SavedTrip, Campsite).join(Campsite).filter(SavedTrip.user_email == email).all()
    result = []
    for t, c in trips:
        result.append({
            "id": t.id,
            "campsite_id": c.id,
            "campsite_name": c.name,
            "state": c.state,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "plan_b_active": t.plan_b_alert_active
        })
    return result
