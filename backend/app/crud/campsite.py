from typing import Optional
from sqlalchemy.orm import Session
from app.models.campsite import Campsite
from app.schemas.campsite import CampsiteCreate

def create_campsite(db: Session, campsite: CampsiteCreate):
    # Construct WKT (Well-Known Text) for PostGIS POINT geometry
    location_wkt = f"SRID=4326;POINT({campsite.longitude} {campsite.latitude})"
    
    db_campsite = Campsite(
        name=campsite.name,
        state=campsite.state,
        location=location_wkt,
        management_type=campsite.management_type,
        dog_friendly=campsite.dog_friendly,
        rig_access=campsite.rig_access,
        facilities=campsite.facilities,
        fees=campsite.fees,
        booking_url=campsite.booking_url,
        fire_district=campsite.fire_district,
        source_id=campsite.source_id,
        source_url=campsite.source_url
    )
    db.add(db_campsite)
    db.commit()
    db.refresh(db_campsite)
    return db_campsite

from sqlalchemy import func, String

def get_campsites(
    db: Session, 
    skip: int = 0, 
    limit: Optional[int] = 5000, 
    state: Optional[str] = None,
    dog_friendly: Optional[bool] = None, 
    rig_access: Optional[str] = None
):
    query = db.query(Campsite)
    
    if state:
        query = query.filter(func.upper(Campsite.state) == state.upper().strip())

    if dog_friendly is not None:
        query = query.filter(Campsite.dog_friendly == dog_friendly)
        
    if rig_access:
        # Cast JSON to string to do a simple LIKE match
        query = query.filter(func.cast(Campsite.rig_access, String).like(f"%{rig_access}%"))
        
    if limit is not None:
        query = query.limit(limit)
        
    return query.offset(skip).all()

