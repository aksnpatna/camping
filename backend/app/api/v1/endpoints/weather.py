from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.campsite import Campsite
from app.schemas.weather import MicroclimateResponse
from app.services.microclimate_engine import MicroclimateEngine

router = APIRouter()

@router.get(
    "/microclimate",
    response_model=MicroclimateResponse,
    summary="Get Downscaled Microclimate Telemetry for Campsite & Target Date",
    description="""
    Predictive microclimate physics engine:
    1. Uses 16-day numerical weather predictions within 15 days of departure.
    2. Uses analytical multi-year climatology normals for dates beyond 16 days.
    3. Downscales using terrain lapse rates (-6.5°C/1000m) and nocturnal valley cold-air pooling.
    4. Computes 4 diurnal camping phases (Dawn, Midday, Dusk, Night) with equipment & fire safety advice.
    """
)
async def get_campsite_microclimate(
    date_str: str = Query(..., alias="date", description="Target trip date (YYYY-MM-DD)"),
    latitude: Optional[float] = Query(None, description="Campsite latitude"),
    longitude: Optional[float] = Query(None, description="Campsite longitude"),
    campsite_id: Optional[int] = Query(None, description="Optional Campsite ID to look up coordinates & terrain name"),
    elevation: Optional[float] = Query(None, description="Optional elevation in meters ASL"),
    db: Session = Depends(get_db),
):
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid date format. Expected YYYY-MM-DD."
        )

    campsite_name: Optional[str] = None
    lat = latitude
    lng = longitude
    elev = elevation

    if campsite_id is not None:
        campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
        if not campsite and (lat is None or lng is None):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campsite with ID {campsite_id} not found."
            )
        if campsite:
            lat = campsite.latitude
            lng = campsite.longitude
            campsite_name = campsite.name

    if lat is None or lng is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either campsite_id with existing coordinates or (latitude, longitude) must be provided."
        )

    return await MicroclimateEngine.get_forecast_async(
        latitude=lat,
        longitude=lng,
        target_date=target_date,
        elevation_m=elev,
        campsite_name=campsite_name,
        campsite_id=campsite_id,
    )

