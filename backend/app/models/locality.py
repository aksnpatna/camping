from sqlalchemy import Column, Integer, String, Index
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from app.core.database import Base


class AustralianLocality(Base):
    """
    Gazetted Australian locality, town, or suburb with PostGIS geographic coordinates.
    Used for 100% offline spatial lookup of nearest service hubs, towns, fuel, and grocery amenities.
    Kept strictly separated from canonical campgrounds to respect data sourcing rules.
    """
    __tablename__ = "australian_localities"

    id = Column(Integer, primary_key=True, index=True)
    postcode = Column(String(10), nullable=False, index=True)
    locality = Column(String(100), nullable=False, index=True)
    state = Column(String(10), nullable=False, index=True)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    sa3name = Column(String(100), nullable=True)
    sa4name = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)

    __table_args__ = (
        Index("idx_australian_localities_location", "location", postgresql_using="gist"),
    )

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
