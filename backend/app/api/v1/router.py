from fastapi import APIRouter, Depends

from app.api.v1.endpoints import health, campsites, saved_trips, fire_status, trips, auth, weather, analytics
from app.core.security import rate_limit

api_router = APIRouter()

# Group-level per-IP ceilings (calls / 60s). Costly or sensitive routes add a
# tighter limit of their own. The global per-IP cap lives in RateLimitMiddleware.
api_router.include_router(health.router, tags=["health"])
api_router.include_router(
    campsites.router, prefix="/campsites", tags=["campsites"],
    dependencies=[Depends(rate_limit("campsites", 90, 60))],
)
api_router.include_router(
    saved_trips.router, prefix="/saved-trips", tags=["saved-trips"],
    dependencies=[Depends(rate_limit("saved-trips", 30, 60))],
)
api_router.include_router(
    fire_status.router, prefix="/fire-status", tags=["fire-status"],
    dependencies=[Depends(rate_limit("fire-status", 30, 60))],
)
api_router.include_router(
    trips.router, prefix="/trips", tags=["trips"],
    dependencies=[Depends(rate_limit("trips", 40, 60))],
)
api_router.include_router(
    auth.router, prefix="/auth", tags=["auth"],
    dependencies=[Depends(rate_limit("auth", 20, 60))],
)
api_router.include_router(
    weather.router, prefix="/weather", tags=["weather"],
    dependencies=[Depends(rate_limit("weather", 30, 60))],
)
api_router.include_router(
    analytics.router, prefix="/analytics", tags=["analytics"],
    dependencies=[Depends(rate_limit("analytics", 60, 60))],
)
