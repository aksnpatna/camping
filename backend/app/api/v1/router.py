from fastapi import APIRouter

from app.api.v1.endpoints import health, campsites, saved_trips, fire_status, trips, auth, weather, analytics

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(campsites.router, prefix="/campsites", tags=["campsites"])
api_router.include_router(saved_trips.router, prefix="/saved-trips", tags=["saved-trips"])
api_router.include_router(fire_status.router, prefix="/fire-status", tags=["fire-status"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
