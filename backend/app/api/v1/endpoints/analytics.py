from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import client_ip, rate_limit, require_admin
from app.crud import analytics as crud_analytics
from app.schemas.analytics import (
    AnalyticsEventCreate,
    AnalyticsEventResponse,
    AnalyticsSummaryResponse,
    EmailLeadResponse
)

router = APIRouter()


def get_client_ip(request: Request) -> Optional[str]:
    # Trusted-proxy aware: forwarded headers are only believed from our own proxy.
    return client_ip(request)


@router.post(
    "/events",
    response_model=AnalyticsEventResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("analytics-events", 30, 60))],
)
def record_event(
    event_in: AnalyticsEventCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip_value = get_client_ip(request)
    user_agent = (request.headers.get("user-agent") or "")[:300] or None
    return crud_analytics.record_event(
        db=db,
        event_in=event_in,
        ip_address=client_ip_value,
        user_agent=user_agent
    )

@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    dependencies=[Depends(require_admin)],
)
def get_analytics_summary(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db)
):
    return crud_analytics.get_analytics_summary(db=db, limit=limit)

@router.get(
    "/leads",
    response_model=List[EmailLeadResponse],
    dependencies=[Depends(require_admin)],
)
def get_email_leads(
    skip: int = Query(0, ge=0, le=100000),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    return crud_analytics.get_email_leads(db=db, skip=skip, limit=limit)
