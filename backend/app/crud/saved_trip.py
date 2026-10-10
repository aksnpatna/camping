from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.saved_trip import SavedTrip
from app.schemas.saved_trip import SavedTripCreate

def create_saved_trip(db: Session, trip: SavedTripCreate):
    # Prevent overlapping saved trips for the same user
    overlap = db.query(SavedTrip).filter(
        SavedTrip.user_email == trip.user_email,
        SavedTrip.start_date <= trip.end_date,
        SavedTrip.end_date >= trip.start_date
    ).first()

    if overlap:
        raise HTTPException(status_code=400, detail="You already have a trip saved during these dates.")

    db_trip = SavedTrip(
        campsite_id=trip.campsite_id,
        user_email=trip.user_email,
        start_date=trip.start_date,
        end_date=trip.end_date,
        plan_b_alert_active=trip.plan_b_alert_active
    )
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

def get_saved_trips_by_email(db: Session, email: str, skip: int = 0, limit: int = 100):
    return db.query(SavedTrip).filter(SavedTrip.user_email == email).offset(skip).limit(limit).all()
