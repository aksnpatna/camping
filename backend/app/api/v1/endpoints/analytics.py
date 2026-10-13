from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import analytics as crud_analytics
from app.schemas.analytics import (
    AnalyticsEventCreate,
    AnalyticsEventResponse,
    AnalyticsSummaryResponse,
    EmailLeadResponse
)

router = APIRouter()

def get_client_ip(request: Request) -> Optional[str]:
    # Check common proxy / cloudflare headers
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return None

@router.post("/events", response_model=AnalyticsEventResponse, status_code=status.HTTP_201_CREATED)
def record_event(
    event_in: AnalyticsEventCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")
    return crud_analytics.record_event(
        db=db,
        event_in=event_in,
        ip_address=client_ip,
        user_agent=user_agent
    )

@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    return crud_analytics.get_analytics_summary(db=db, limit=limit)

@router.get("/leads", response_model=List[EmailLeadResponse])
def get_email_leads(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud_analytics.get_email_leads(db=db, skip=skip, limit=limit)
