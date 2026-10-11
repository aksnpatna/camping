from sqlalchemy import Column, Integer, String, Text, Boolean, JSON, DateTime, Date
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from sqlalchemy.sql import func
from app.core.database import Base

# Provenance states. A record may only claim "verified" when a human or an
# authoritative source has confirmed the specific facts it carries.
DATA_STATUS_VERIFIED = "verified"
DATA_STATUS_RULE_DERIVED = "rule_derived"
DATA_STATUS_UNVERIFIED = "unverified"


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

    # Authoritative attributes carried verbatim from the source dataset, kept
    # separate from any derived field so the original value is never lost.
    access_type = Column(String(50), nullable=True)   # e.g. "Vehicle Based", "Remote Walk-in"
    lga = Column(String(100), nullable=True)          # Local Government Area
    npws_branch = Column(String(100), nullable=True)  # NPWS management branch
    asset_comments = Column(Text, nullable=True)      # e.g. "Vehicle access by permit"
    source_modified_at = Column(Date, nullable=True)  # source record's own modified date

    # Metadata for provenance & trust
    source_id = Column(String(255), index=True)
    source_url = Column(Text)
    evidence_url = Column(Text, nullable=True)  # where a specific fact was confirmed
    data_status = Column(String(20), nullable=False, default=DATA_STATUS_UNVERIFIED, server_default=DATA_STATUS_UNVERIFIED)
    verified_at = Column(DateTime, nullable=True)
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

