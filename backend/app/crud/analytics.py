from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timezone

from app.models.analytics import AnalyticsEvent, EmailLead
from app.schemas.analytics import AnalyticsEventCreate

def record_event(
    db: Session,
    event_in: AnalyticsEventCreate,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> AnalyticsEvent:
    event = AnalyticsEvent(
        event_type=event_in.event_type,
        path=event_in.path,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
        referrer=event_in.referrer[:500] if event_in.referrer else None,
        session_id=event_in.session_id,
        user_email=event_in.user_email.strip().lower() if event_in.user_email else None,
        meta_data=event_in.meta_data,
    )
    db.add(event)

    # If an email is provided with this event, also ensure an EmailLead record exists
    if event_in.user_email:
        record_or_update_lead(
            db=db,
            email=event_in.user_email,
            source=event_in.event_type,
            ip_address=ip_address,
            metadata=event_in.meta_data
        )

    db.commit()
    db.refresh(event)
    return event


def record_or_update_lead(
    db: Session,
    email: str,
    source: str = "saved_trip",
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> EmailLead:
    clean_email = email.strip().lower()
    lead = db.query(EmailLead).filter(EmailLead.email == clean_email).first()

    now = datetime.now(timezone.utc)
    if lead:
        lead.trips_count += 1
        lead.last_active_at = now
        if metadata:
            existing_meta = lead.meta_data or {}
            existing_meta.update(metadata)
            lead.meta_data = existing_meta
    else:
        lead = EmailLead(
            email=clean_email,
            source=source,
            status="active",
            trips_count=1,
            first_ip=ip_address,
            last_active_at=now,
            meta_data=metadata
        )
        db.add(lead)

    db.commit()
    db.refresh(lead)
    return lead


def get_analytics_summary(db: Session, limit: int = 15) -> Dict[str, Any]:
    total_events = db.query(func.count(AnalyticsEvent.id)).scalar() or 0
    unique_ips = db.query(func.count(func.distinct(AnalyticsEvent.ip_address))).scalar() or 0
    unique_sessions = db.query(func.count(func.distinct(AnalyticsEvent.session_id))).scalar() or 0
    total_leads = db.query(func.count(EmailLead.id)).scalar() or 0

    # Top pages
    top_pages_query = (
        db.query(AnalyticsEvent.path, func.count(AnalyticsEvent.id).label("hits"))
        .group_by(AnalyticsEvent.path)
        .order_by(desc("hits"))
        .limit(limit)
        .all()
    )
    top_pages = [{"path": p[0], "hits": p[1]} for p in top_pages_query]

    # Recent events
    recent_events = (
        db.query(AnalyticsEvent)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
        .all()
    )

    # Recent leads
    recent_leads = (
        db.query(EmailLead)
        .order_by(EmailLead.last_active_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "total_events": total_events,
        "unique_ips": unique_ips,
        "unique_sessions": unique_sessions,
        "total_leads": total_leads,
        "top_pages": top_pages,
        "recent_events": recent_events,
        "recent_leads": recent_leads
    }


def get_email_leads(db: Session, skip: int = 0, limit: int = 100) -> List[EmailLead]:
    return (
        db.query(EmailLead)
        .order_by(EmailLead.last_active_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
