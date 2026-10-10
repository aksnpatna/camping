import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.worker.plan_b import check_plan_b_alerts

from app.api.v1.router import api_router

app = FastAPI(
    title="Camp Smart Australia API", 
    description="Backend for the Camp Smart Answer-First Trip Finder",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_plan_b_alerts())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3021", "http://127.0.0.1:3021", "https://camping.akstest.win"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
