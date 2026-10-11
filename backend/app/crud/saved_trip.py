from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.saved_trip import SavedTrip
from app.schemas.saved_trip import SavedTripCreate

def create_saved_trip(db: Session, trip: SavedTripCreate):
    if trip.is_shortlist:
        # Prevent duplicate same-campsite candidate on overlapping dates
        duplicate = db.query(SavedTrip).filter(
            SavedTrip.user_email == trip.user_email,
            SavedTrip.campsite_id == trip.campsite_id,
            SavedTrip.start_date <= trip.end_date,
            SavedTrip.end_date >= trip.start_date
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="This campsite is already on your shortlist for these dates.")
    else:
        # Prevent overlapping confirmed (non-shortlist) trips for the same user
        overlap = db.query(SavedTrip).filter(
            SavedTrip.user_email == trip.user_email,
            SavedTrip.is_shortlist == False,
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
        plan_b_alert_active=trip.plan_b_alert_active if trip.plan_b_alert_active is not None else True,
        is_shortlist=trip.is_shortlist if trip.is_shortlist is not None else False,
        origin_lat=trip.origin_lat,
        origin_lng=trip.origin_lng,
        max_drive_hours=trip.max_drive_hours,
        party_size=trip.party_size,
        has_dog=trip.has_dog,
        rig_access=trip.rig_access,
        room_token=trip.room_token
    )
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

def get_saved_trips_by_email(db: Session, email: str, skip: int = 0, limit: int = 100):
    return db.query(SavedTrip).filter(SavedTrip.user_email == email).offset(skip).limit(limit).all()
