from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, DateTime
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from sqlalchemy.sql import func
from app.core.database import Base

class Campsite(Base):
    __tablename__ = "canonical_campsites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    
    # Storing standard lon/lat as a PostGIS point with SRID 4326 (WGS 84)
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    
    state = Column(String(50), nullable=False) # e.g., NSW, VIC
    management_type = Column(String(100)) # e.g., NPWS, State Forest, Private
    
    # Core constraints
    dog_friendly = Column(Boolean, nullable=True) # True=Yes, False=No, Null=Unknown
    rig_access = Column(JSON, nullable=True) # e.g., ['4WD_ONLY', 'CARAVAN', 'TENT']
    facilities = Column(JSON, nullable=True) # e.g. {"toilets": "flush"|"pit"|"none", "showers": "hot"|"cold"|"none", "drinking_water": bool, "campfires": bool}
    fees = Column(String(100), nullable=True) # e.g. "$24.60/night", "$0 (Free)"
    booking_url = Column(Text, nullable=True) # Direct reservation link or None
    fire_district = Column(String(100), nullable=True) # e.g. "Greater Sydney Region", "Illawarra/Shoalhaven"
    
    # Metadata for provenance & trust
    source_id = Column(String(255)) 
    source_url = Column(Text)
    last_verified_at = Column(DateTime(timezone=True), server_default=func.now())
    
    @property
    def longitude(self) -> float:
        if self.location is not None:
            return to_shape(self.location).x
        return 0.0

    @property
    def latitude(self) -> float:
        if self.location is not None:
            return to_shape(self.location).y
        return 0.0
