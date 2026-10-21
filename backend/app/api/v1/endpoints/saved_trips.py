from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import client_ip as resolve_request_ip, rate_limit
from app.crud import saved_trip as crud_saved_trip
from app.crud import analytics as crud_analytics
from app.schemas.analytics import AnalyticsEventCreate
from app.models.campsite import Campsite
from app.models.plan_b_alert import PlanBAlert
from app.models.saved_trip import SavedTrip
from app.schemas.saved_trip import (
    SavedTripCreate,
    SavedTripResponse,
    SimulateAlertRequest,
    SwitchCampsiteRequest,
    TogglePlanBRequest,
    UnsubscribeResponse,
)
from app.services.magic_link import verify_magic_token
from app.worker.plan_b import dispatch_alert_email, find_plan_b_alternatives

router = APIRouter()


_save_limit = Depends(rate_limit("save-trip", 20, 3600))


@router.post("", response_model=SavedTripResponse, dependencies=[_save_limit])
@router.post("/", response_model=SavedTripResponse, include_in_schema=False, dependencies=[_save_limit])
def create_saved_trip(trip: SavedTripCreate, request: Request, db: Session = Depends(get_db)):
    email = trip.user_email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1] or len(email) < 5:
        raise HTTPException(status_code=400, detail="Invalid email address format")
    if trip.start_date > trip.end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")
    campsite = db.query(Campsite).filter(Campsite.id == trip.campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
    
    saved_trip_obj = crud_saved_trip.create_saved_trip(db=db, trip=trip)

    # Automatically capture lead for future communications and record event
    client_ip = resolve_request_ip(request)

    crud_analytics.record_or_update_lead(
        db=db,
        email=email,
        source="plan_b_save",
        ip_address=client_ip,
        metadata={
            "campsite_id": campsite.id,
            "campsite_name": campsite.name,
            "state": campsite.state,
            "start_date": trip.start_date.isoformat(),
            "end_date": trip.end_date.isoformat(),
            "party_size": trip.party_size,
            "has_dog": trip.has_dog,
            "rig_access": trip.rig_access
        }
    )

    crud_analytics.record_event(
        db=db,
        event_in=AnalyticsEventCreate(
            event_type="trip_saved",
            path=f"/campsites/{campsite.id}",
            user_email=email,
            meta_data={
                "campsite_name": campsite.name,
                "dates": f"{trip.start_date} to {trip.end_date}"
            }
        ),
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent")
    )

    return saved_trip_obj


@router.get("/{email}", response_model=List[SavedTripResponse])
def read_saved_trips(email: str, token: str = "", skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    verify_magic_token(db, email, token)
    return crud_saved_trip.get_saved_trips_by_email(db, email=email, skip=skip, limit=limit)


@router.get("/dashboard/{email}")
def get_user_dashboard(email: str, token: str = "", db: Session = Depends(get_db)):
    verify_magic_token(db, email, token)
    trips = db.query(SavedTrip, Campsite).join(Campsite).filter(SavedTrip.user_email == email).all()
    result = []
    for t, c in trips:
        alerts = (
            db.query(PlanBAlert)
            .filter(PlanBAlert.saved_trip_id == t.id)
            .order_by(PlanBAlert.triggered_at.desc())
            .all()
        )
        alert_list = [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "details": a.details,
                "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
                "delivery_status": a.delivery_status,
                "severity": a.severity,
                "suggested_alternatives": a.suggested_alternatives or [],
            }
            for a in alerts
        ]
        result.append({
            "id": t.id,
            "campsite_id": c.id,
            "campsite_name": c.name,
            "state": c.state,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "plan_b_active": t.plan_b_alert_active,
            "is_shortlist": t.is_shortlist,
            "room_token": t.room_token,
            "alerts": alert_list,
        })
    return result


@router.post("/{trip_id}/switch-campsite", response_model=SavedTripResponse)
def switch_campsite(trip_id: int, switch_data: SwitchCampsiteRequest, token: str = "", db: Session = Depends(get_db)):
    """
    Switch a saved trip to an alternative campsite (e.g. from a Plan B alert).
    """
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")

    verify_magic_token(db, trip.user_email, token, status_code=401)

    new_site = db.query(Campsite).filter(Campsite.id == switch_data.new_campsite_id).first()
    if not new_site:
        raise HTTPException(status_code=404, detail="Target campsite not found")

    trip.campsite_id = new_site.id
    db.commit()
    db.refresh(trip)
    return trip


@router.post("/{trip_id}/simulate-alert")
def simulate_plan_b_alert(trip_id: int, sim_data: SimulateAlertRequest, token: str = "", db: Session = Depends(get_db)):
    """
    Simulate a condition shift (weather warning / fire ban) and generate a
    persistent Plan B alert with alternatives.
    """
    from app.core.config import settings
    if settings.ENVIRONMENT in ("production", "prod"):
        raise HTTPException(
            status_code=403,
            detail="Simulated alert generation is disabled in production",
        )

    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")

    verify_magic_token(db, trip.user_email, token, status_code=401)

    campsite = db.query(Campsite).filter(Campsite.id == trip.campsite_id).first()
    alternatives = find_plan_b_alternatives(db, trip, campsite) if campsite else []
    details_text = sim_data.reason or "Simulated weather/condition shift detected in campground area."
    site_name = campsite.name if campsite else "Campsite"
    delivery_status = dispatch_alert_email(db, trip, site_name, details_text, alternatives)

    alert = PlanBAlert(
        saved_trip_id=trip.id,
        user_email=trip.user_email,
        campsite_id=trip.campsite_id,
        alert_type=sim_data.alert_type or "WEATHER_WARNING",
        details=details_text,
        suggested_alternatives=alternatives,
        delivery_status=delivery_status,
        retry_count=0 if delivery_status == "SENT" else 1,
        severity=1,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {
        "id": alert.id,
        "saved_trip_id": alert.saved_trip_id,
        "alert_type": alert.alert_type,
        "details": alert.details,
        "triggered_at": alert.triggered_at.isoformat() if alert.triggered_at else None,
        "delivery_status": alert.delivery_status,
        "severity": alert.severity,
        "suggested_alternatives": alert.suggested_alternatives,
    }


@router.post("/{trip_id}/toggle-plan-b", response_model=SavedTripResponse)
def toggle_plan_b_monitoring(
    trip_id: int,
    toggle_data: Optional[TogglePlanBRequest] = None,
    token: str = "",
    db: Session = Depends(get_db),
):
    """
    Toggle or explicitly set Plan B continuous monitoring for a saved trip.
    """
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")

    verify_magic_token(db, trip.user_email, token, status_code=401)

    if toggle_data and toggle_data.active is not None:
        trip.plan_b_alert_active = toggle_data.active
    else:
        trip.plan_b_alert_active = not bool(trip.plan_b_alert_active)

    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}/unsubscribe", response_model=UnsubscribeResponse)
def unsubscribe_trip_alerts(
    trip_id: int,
    token: str = "",
    db: Session = Depends(get_db),
):
    """
    1-Click unsubscribe endpoint for Plan B condition alerts (Spam Act 2003 compliance).
    Validates the magic token and turns off automated alerts for this trip.
    """
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Saved trip not found")

    verify_magic_token(db, trip.user_email, token, status_code=401)

    trip.plan_b_alert_active = False
    db.commit()

    return UnsubscribeResponse(
        trip_id=trip.id,
        user_email=trip.user_email,
        plan_b_alert_active=False,
        message="Plan B alerts have been successfully turned off for this trip. You will not receive condition shift emails for this trip.",
    )
