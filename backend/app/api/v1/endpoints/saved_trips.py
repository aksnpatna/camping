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
