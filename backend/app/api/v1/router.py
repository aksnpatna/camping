from fastapi import APIRouter

from app.api.v1.endpoints import health, campsites, saved_trips

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(campsites.router, prefix="/campsites", tags=["campsites"])
api_router.include_router(saved_trips.router, prefix="/saved-trips", tags=["saved-trips"])
