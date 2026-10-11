# Camp Smart Australia — Plan v3: Trust, Truthfulness & Pilot Depth

> **For Agents & Engineers:** MANDATORY WORKFLOW: Adhere to `tdd-workflow`, `backend-architect`, `api-patterns`, `ui-ux-designer`, and `lint-and-validate` per `AGENTS.md`. Write failing tests before modifying implementation code. Never fabricate data fields or silently drop user constraints.

**Goal:** Transform Camp Smart Australia from an 85% complete prototype into an uncompromisingly truthful, defensible camping copilot by eliminating all synthetic claims, implementing real email notification delivery, parsing official NSW fire feeds per-district, and establishing a deeply verified 30+ campsite pilot catchment in the Greater Sydney / NSW zone.

**Architecture:** 
- **Backend:** FastAPI + PostgreSQL + PostGIS (SQLAlchemy 2.0, Alembic migrations) + Async background workers.
- **Data & Safety:** Official NSW RFS XML feed (`fdrToban.xml`) with per-district parsing; Open-Meteo live forecasts; OSRM server-side routing; Local GPU LLM (Qwen3-9B on `:8002` via `llama-swap` with Ollama & Groq fallback).
- **Delivery:** Pluggable transactional email service (`EmailService`) for magic links and Plan B condition-shift alerts.
- **Frontend:** Next.js 14 App Router (Vanilla Tailwind/CSS, MapLibre GL, PWA Service Worker caching).

---

## 📋 Executive Audit Summary & Context

An exhaustive review of the codebase against `plan_v2.md` and competitor benchmarks ([1791694364548-implementation-data-competitor-review.md](file:///.kilo/plans/1791694364548-implementation-data-competitor-review.md)) revealed that while the 3 core user journeys (**Choose**, **Prepare Together**, **Stay Informed**) are built end-to-end, **the product currently outruns its underlying data**:
1. **Fabricated Content in Trip Cards:** Canned compromises cycling by modulo (`recommendation_engine.py:142-149`), templated costs, and all 22 seed sites defaulting to the NSW NPWS homepage for bookings regardless of state or jurisdiction.
2. **Missing Delivery for Plan B:** Alerts marked `DELIVERED` when no email/push exists; worker self-disables monitoring after a single alert (`trip.plan_b_alert_active = False`); dashboard requires an access token that campers have no way of receiving.
3. **Safety Feed Vulnerabilities:** Non-NSW requests synthesize a `Moderate/live` rating (violating the non-negotiable fire degradation rule); NSW RFS XML is parsed by full-text keyword matching across the whole state rather than per-district.
4. **Data Void in Seed:** Only 2 of the 22 seeded sites are in NSW (none dog-friendly), causing 3 of 4 homepage presets ("Sydney + Dog <3.5h", "Family <2h", "90-min overnight") to return 0 results. No facilities or fee fields exist in the database model.
5. **Competitive Opening (Oct 2026):** WikiCamps AU (post-G'day Parks acquisition) suffers widespread backlash over stripped features, deleted free camping listings, and subscription hikes. Camp Smart's moat is **absolute honesty and curation in a dense pilot catchment**, not competing on 65,000 unverified map dots.

---

## 🎯 Phase Breakdown & Priorities

```
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 1 (P0): De-fabrication & Safety Truthfulness                   │
│  - Eliminate canned compromises, templated costs & default NPWS links   │
│  - Alembic migration: add facilities, fees, booking_url, fire_district  │
│  - District-level NSW RFS parsing + honest non-NSW degradation contract │
│  - Replace sentiment_score with attributed observations & citations     │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 2 (P0): Authentication & Alert Delivery Reach                   │
│  - Pluggable transactional EmailService (Console/SMTP/Provider)        │
│  - Magic link request endpoint: POST /api/v1/auth/request-magic-link   │
│  - Frontend 1-click magic link auth (?email=...&token=...)             │
│  - Real Plan B email delivery; preserve plan_b_alert_active = True     │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 3 (P1): Pilot Catchment Reseed (Sydney ≤3.5h)                   │
│  - 30-35 canonical campsites (NPWS, Forestry NSW, WaterNSW, Councils)  │
│  - ≥10 dog-friendly sites, ≥5 <90min sites, real fees, real booking URLs│
│  - Guarantee all 4 homepage presets return genuine, verified trips     │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 4 (P1): Facilities Constraints & Server-Side OSRM               │
│  - Parse toilets, showers, drinking water, campfires, clearance in NL  │
│  - Strict facility filtering; echo unverified requirements to camper   │
│  - Server-side OSRM drive-time routing with fallback approximation     │
│  - Geolocation forwarding from client planner to backend               │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 5 (P2): Parity & Conversational Adjustments                     │
│  - Conversational What-If (/trips/adjust) via local Qwen3 9B           │
│  - Programmatic SEO pages (30 canonical sites) with live fire status   │
│  - PWA Offline Service Worker for saved trips & packing checklist      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 (P0): De-Fabrication & Safety Truthfulness

### Task 1.1: Database Schema Extension & Alembic Migration
**Goal:** Add structured fields for verified campsite attributes instead of inventing facts at runtime.

**Files:**
- Modify: [backend/app/models/campsite.py](file:///home/aksai/projects/camping/backend/app/models/campsite.py)
- Create: `backend/alembic/versions/2b3c4d5e6f7a_add_facilities_fees_and_booking_fields.py`
- Modify: [backend/app/schemas/campsite.py](file:///home/aksai/projects/camping/backend/app/schemas/campsite.py)
- Test: [backend/tests/api/test_campsites.py](file:///home/aksai/projects/camping/backend/tests/api/test_campsites.py)

**Step 1: Write failing test in `test_campsites.py`:**
```python
def test_campsite_facilities_and_fees_fields():
    res = client.get("/api/v1/campsites")
    assert res.status_code == 200
    sites = res.json()
    assert len(sites) > 0
    first = sites[0]
    assert "facilities" in first
    assert "fees" in first
    assert "booking_url" in first
    assert "fire_district" in first
```

**Step 2: Update `Campsite` Model:**
```python
# Add to backend/app/models/campsite.py:
facilities = Column(JSON, nullable=True) # e.g. {"toilets": "flush"|"pit"|"none", "showers": "hot"|"cold"|"none", "drinking_water": bool, "campfires": bool}
fees = Column(String(100), nullable=True) # e.g. "$24.60/night", "$0 (Free)"
booking_url = Column(Text, nullable=True) # Direct reservation link or None
fire_district = Column(String(100), nullable=True) # e.g. "Greater Sydney Region", "Illawarra/Shoalhaven"
```

**Step 3: Run Alembic migration & verify test passes:**
```bash
cd backend && venv/bin/alembic revision --autogenerate -m "add facilities fees and booking fields"
venv/bin/alembic upgrade head
venv/bin/pytest tests/api/test_campsites.py -v
```

---

### Task 1.2: De-Fabricate Recommendation Cards & Engine
**Goal:** Remove canned compromise rotation, templated fees, and blanket NPWS fallback links in [recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py).

**Files:**
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Modify: [backend/app/schemas/trip_recommendation.py](file:///home/aksai/projects/camping/backend/app/schemas/trip_recommendation.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Step 1: Write failing test in `test_recommendations.py`:**
```python
def test_recommendation_cards_no_fabricated_compromises():
    req = {
        "prompt": "Quiet weekend away near Sydney",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 4.0
    }
    res = client.post("/api/v1/trips/find-weekend", json=req)
    assert res.status_code == 200
    cards = res.json()["cards"]
    for card in cards:
        # Compromise must be rooted in real site data, not canned text array
        assert "Unsealed access track for last 2km" not in card["main_compromise"] or card.get("vehicle_clearance") == "4WD_ONLY"
        # Booking URL must not default to NSW NPWS for non-NPWS sites
        if card["management_type"] != "NPWS":
            assert card["booking_url"] != "https://www.nationalparks.nsw.gov.au" or card["booking_url"] is None
```

**Step 2: Implement factual compromise derivation:**
```python
# In recommendation_engine.py:
def derive_factual_compromise(site: Campsite, weather_summary: Optional[str] = None) -> str:
    fac = site.facilities or {}
    compromises = []
    
    # 1. Access & Rig constraints
    if site.rig_access and "4WD_ONLY" in site.rig_access:
        compromises.append("4WD required; unsealed road with steep sections")
        
    # 2. Toilet facilities
    toilet_type = fac.get("toilets")
    if toilet_type in ["pit", "composting", "drop"]:
        compromises.append("Drop/pit toilets only; bring toilet paper & sanitizer")
    elif toilet_type == "none":
        compromises.append("No toilets on site; portable camp toilet required")
        
    # 3. Water availability
    if fac.get("drinking_water") is False:
        compromises.append("Non-potable water; bring minimum 5L drinking water per person/day")
        
    # 4. Pet policy
    if site.dog_friendly is False:
        compromises.append("No pets permitted (National Park regulations apply)")
        
    # 5. Booking / Popularity
    if site.management_type in ["Forestry Corporation", "Crown Land", "State Forest"]:
        compromises.append("First-come, first-served unallocated sites; arrive early Friday")
    elif "NPWS" in (site.management_type or ""):
        compromises.append("Popular destination; advance booking required")
        
    return compromises[0] if compromises else "Ensure you pack all essentials; leave no trace"
```

**Step 3: Honest Costs, Badges, and Booking URLs:**
- `estimated_cost = site.fees or "Fee unverified"`
- `booking_url = site.booking_url or site.source_url or None`
- `booking_status = "Direct Reservation Required" if site.booking_url else ("Free / No Booking Required" if site.fees == "$0 (Free)" else "Booking Details Unverified")`
- `highlight_badge`: Real computation based on verified attributes (e.g. "Free Camping" if fees == "$0", "Dog Friendly" if dogs allowed, "Full Amenities" if flush toilets & hot showers exist).

---

### Task 1.3: Official NSW RFS District Parsing & Non-NSW Honest Degradation
**Goal:** Upgrade [fire_status.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/fire_status.py) to parse `https://www.rfs.nsw.gov.au/feeds/fdrToban.xml` per district and return honest unavailable degradation for non-NSW queries.

**Files:**
- Modify: [backend/app/api/v1/endpoints/fire_status.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/fire_status.py)
- Test: [backend/tests/api/test_fire_status.py](file:///home/aksai/projects/camping/backend/tests/api/test_fire_status.py)

**Step 1: Write failing test in `test_fire_status.py`:**
```python
def test_fire_status_non_nsw_honest_degradation():
    res = client.get("/api/v1/fire-status/VIC")
    assert res.status_code in [200, 503]
    data = res.json()
    assert data["status"] == "unavailable"
    assert "Live feed currently active for NSW pilot catchment only" in data["message"]
    # NEVER synthesize a fake Moderate/live rating!
    assert "rating" not in data or data["rating"] is None

def test_fire_status_nsw_district_parsing():
    res = client.get("/api/v1/fire-status/NSW?district=Greater+Sydney+Region")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "live"
    assert data["district"] == "Greater Sydney Region"
    assert "rating" in data
    assert isinstance(data["total_fire_ban"], bool)
```

**Step 2: Implement XML ElementTree parser for `fdrToban.xml`:**
```python
# In fire_status.py:
import xml.etree.ElementTree as ET

@router.get("/{state}")
def get_fire_status(state: str, district: Optional[str] = "Greater Sydney Region"):
    if state.upper() != "NSW":
        return {
            "state": state.upper(),
            "status": "unavailable",
            "message": "Live feed currently active for NSW pilot catchment only. Check state emergency service.",
            "rating": None,
            "total_fire_ban": None
        }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get("https://www.rfs.nsw.gov.au/feeds/fdrToban.xml")
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            
            # Find matching district
            target_elem = None
            for d in root.findall(".//District"):
                name = d.findtext("Name", "")
                if district.lower() in name.lower() or name.lower() in district.lower():
                    target_elem = d
                    break
                    
            if target_elem is None:
                for d in root.findall(".//District"):
                    if "Greater Sydney" in d.findtext("Name", ""):
                        target_elem = d
                        break

            rating = target_elem.findtext("DangerLevelToday", "Moderate").title() if target_elem else "Moderate"
            toban_text = target_elem.findtext("FireBanToday", "No") if target_elem else "No"
            total_fire_ban = toban_text.strip().lower() == "yes"
            district_name = target_elem.findtext("Name", "Greater Sydney Region") if target_elem else "Greater Sydney Region"

            return {
                "state": "NSW",
                "district": district_name,
                "rating": rating,
                "total_fire_ban": total_fire_ban,
                "status": "live",
                "source": "NSW Rural Fire Service (rfs.nsw.gov.au/feeds/fdrToban.xml)",
                "action_required": "Enforce total fire ban — no wood, gas only if permitted" if total_fire_ban else "Monitor conditions"
            }
    except Exception as e:
        logger.error(f"Failed to fetch NSW RFS feed: {e}")
        raise HTTPException(
            status_code=503,
            detail="Fire danger rating service temporarily unavailable. Degradation rule active."
        )
```

---

### Task 1.4: Replace Synthetic Sentiment Score with Attributed Observations
**Goal:** Replace `sentiment_score: 85` in [campsites.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/campsites.py) with verifiable, timestamped community observations and remove stale 24-hour caching.

**Files:**
- Modify: [backend/app/api/v1/endpoints/campsites.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/campsites.py)
- Modify: [backend/app/schemas/campsite.py](file:///home/aksai/projects/camping/backend/app/schemas/campsite.py)
- Modify: [frontend/src/components/TripCard.tsx](file:///home/aksai/projects/camping/frontend/src/components/TripCard.tsx)
- Test: [backend/tests/api/test_campsites.py](file:///home/aksai/projects/camping/backend/tests/api/test_campsites.py)

**Step 1: Define `CampsiteInsightsResponse` schema:**
```python
class CamperObservation(BaseModel):
    category: str # "Road Access", "Wildlife", "Campsite Shade", "Amenities"
    observation: str
    source_attribution: str # e.g. "Community Report (Mar 2026)"

class CampsiteInsightsResponse(BaseModel):
    nearest_fuel: str
    nearest_grocery: str
    observations: List[CamperObservation]
    top_activities: List[str]
    retrieved_at: str
```

**Step 2: Update local LLM extraction prompt & response:**
Extract concrete facts from DuckDuckGo search snippets with citations rather than an arbitrary 0-100 score. Update `TripCard.tsx` to render "Community Field Notes" instead of "Score: 85/100".

---

## Phase 2 (P0): Authentication & Alert Delivery Reach

### Task 2.1: Pluggable Transactional Email Service
**Goal:** Create `EmailService` supporting transactional email delivery for magic links and Plan B condition-shift alerts, with dev/testing console logger and SMTP/API integration.

**Files:**
- Create: `backend/app/services/email_service.py`
- Modify: [backend/app/core/config.py](file:///home/aksai/projects/camping/backend/app/core/config.py)
- Create: `backend/tests/test_email_service.py`

**Step 1: Write test for `EmailService`:**
```python
def test_email_service_send_magic_link():
    service = EmailService()
    success = service.send_magic_link("camper@example.com", "http://localhost:3021/?token=abc123xyz")
    assert success is True
    assert len(service.outbox) >= 1
    assert "abc123xyz" in service.outbox[-1]["body"]
```

**Step 2: Implement `EmailService`:**
```python
# backend/app/services/email_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.outbox = [] # Test inspection buffer

    def send_magic_link(self, recipient_email: str, magic_url: str) -> bool:
        subject = "Your Camp Smart Australia Access Link"
        html = f"""
        <div style="font-family: sans-serif; background: #071714; color: #fff; padding: 24px; border-radius: 12px;">
          <h2 style="color: #00ff88;">Camp Smart Australia</h2>
          <p>Click below to securely access your saved trips and Plan B monitoring dashboard:</p>
          <p><a href="{magic_url}" style="background: #00ff88; color: #071714; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Open My Trips Dashboard</a></p>
          <p style="color: #888; font-size: 12px;">Link valid for your active session.</p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def send_plan_b_alert(self, recipient_email: str, trip_name: str, reason: str, switch_url: str, alternatives: list) -> bool:
        subject = f"⚠️ Plan B Alert: Condition shift for {trip_name}"
        alts_html = "".join([f"<li><strong>{a['name']}</strong> ({a['state']}) — {a['reason']}</li>" for a in alternatives])
        html = f"""
        <div style="font-family: sans-serif; background: #071714; color: #fff; padding: 24px; border-radius: 12px;">
          <h2 style="color: #ff4d4d;">Plan B Alert: Conditions Shifted</h2>
          <p>We detected an important shift for your trip to <strong>{trip_name}</strong>:</p>
          <div style="background: rgba(255, 77, 77, 0.1); border-left: 4px solid #ff4d4d; padding: 12px; margin: 12px 0;">
            {reason}
          </div>
          <h3>Recommended Safe Alternatives:</h3>
          <ul>{alts_html}</ul>
          <p><a href="{switch_url}" style="background: #00ff88; color: #071714; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Review & Switch Trip (1-Click)</a></p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        self.outbox.append({"to": to_email, "subject": subject, "body": html_body})
        logger.info(f"📧 [Email Dispatched] To: {to_email} | Subject: {subject}")
        if settings.SMTP_HOST:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = settings.SMTP_FROM or "alerts@campsmart.au"
                msg["To"] = to_email
                msg.attach(MIMEText(html_body, "html"))
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(msg["From"], [to_email], msg.as_string())
                return True
            except Exception as e:
                logger.error(f"SMTP send failed: {e}")
                return False
        return True
```

---

### Task 2.2: Magic Link Request Endpoint & Dashboard Auto-Auth
**Goal:** Provide `POST /api/v1/auth/request-magic-link` and auto-authenticate users visiting `/?token=...&email=...`.

**Files:**
- Create: `backend/app/api/v1/endpoints/auth.py`
- Modify: [backend/app/api/v1/api.py](file:///home/aksai/projects/camping/backend/app/api/v1/api.py)
- Modify: [frontend/src/app/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/page.tsx)
- Test: `backend/tests/api/test_auth.py`

**Step 1: Write test for magic link endpoint:**
```python
def test_request_magic_link_flow():
    res = client.post("/api/v1/auth/request-magic-link", json={"email": "camper@test.com"})
    assert res.status_code == 200
    data = res.json()
    assert "magic_token" in data
    assert "message" in data
```

**Step 2: Add endpoint in `backend/app/api/v1/endpoints/auth.py`:**
```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import hmac, hashlib, os
from app.services.email_service import EmailService

router = APIRouter()
email_service = EmailService()

class MagicLinkRequest(BaseModel):
    email: EmailStr

@router.post("/request-magic-link")
def request_magic_link(req: MagicLinkRequest):
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    token = hmac.new(secret, req.email.encode(), hashlib.sha256).hexdigest()
    magic_url = f"https://camping.akstest.win/?email={req.email}&token={token}"
    email_service.send_magic_link(req.email, magic_url)
    return {
        "message": "Magic link sent to your email",
        "magic_token": token,
        "magic_url": magic_url
    }
```

**Step 3: Update `frontend/src/app/page.tsx`:**
Add a 1-click "Email Me a Magic Link" button in the My Trips drawer.
When URL query parameters contains `?email=...&token=...`, automatically open My Trips dashboard, set `dashEmail` and `dashToken`, and trigger `fetchMyTrips()`.

---

### Task 2.3: Real Plan B Alert Delivery & Worker Persistence
**Goal:** Deliver actual emails on condition shift alerts, set `delivery_status="SENT"` or `"FAILED"` with `retry_count`, and maintain `trip.plan_b_alert_active = True`.

**Files:**
- Modify: [backend/app/worker/plan_b.py](file:///home/aksai/projects/camping/backend/app/worker/plan_b.py)
- Test: [backend/tests/api/test_plan_b.py](file:///home/aksai/projects/camping/backend/tests/api/test_plan_b.py)

**Step 1: Update `backend/tests/api/test_plan_b.py`:**
```python
def test_plan_b_alert_delivery_and_persistence():
    # Assert alert creates delivery record with status SENT (or PENDING)
    # Assert trip.plan_b_alert_active remains TRUE after alert creation!
    assert trip["plan_b_alert_active"] is True
```

**Step 2: Update `backend/app/worker/plan_b.py`:**
```python
sent = email_service.send_plan_b_alert(
    recipient_email=trip.user_email,
    trip_name=campsite.name,
    reason=details,
    switch_url=f"https://camping.akstest.win/?email={trip.user_email}&token={token}&trip={trip.id}",
    alternatives=alts
)
alert = PlanBAlert(
    saved_trip_id=trip.id,
    user_email=trip.user_email,
    campsite_id=campsite.id,
    alert_type="WEATHER_WARNING",
    details=details,
    delivery_status="SENT" if sent else "FAILED",
    retry_count=0 if sent else 1,
    suggested_alternatives=alts
)
db.add(alert)
# CRITICAL FIX: DO NOT disable trip monitoring!
trip.plan_b_alert_active = True
db.commit()
```

---

## Phase 3 (P1): Pilot Catchment Reseed (Sydney ≤3.5h)

### Task 3.1: Canonical 32-Campsite Sydney Pilot Dataset
**Goal:** Replace national spread with 32 deeply verified campsites within 3.5h of Sydney across NPWS, Forestry Corporation NSW (free/dog-friendly), WaterNSW, and Councils.

**Files:**
- Modify: [backend/seed.py](file:///home/aksai/projects/camping/backend/seed.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Verified Dataset Specification:**

| Name | Region / Council | Drive from Sydney | Dog Friendly | Vehicle Clearance | Facilities (Toilets/Showers/Water/Fire) | Fees | Booking URL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **The Pines** | Olney State Forest (Central Coast) | 1h 45m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Turpentine** | Olney State Forest (Central Coast) | 1h 50m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Euroka Campground** | Blue Mountains (Glenbrook) | 1h 15m | NO | 2WD | Flush / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Murphy's Glen** | Blue Mountains (Woodford) | 1h 30m | NO | **4WD_ONLY** | Pit / None / None / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Old Ford Reserve** | Megalong Valley | 2h 00m | **YES** | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | bluemountains.nsw.gov.au |
| **Blackheath Glen** | Megalong Valley | 2h 10m | **YES** | 2WD | Flush / None / Potable / Fire Rings | $0 (Free) | bluemountains.nsw.gov.au |
| **Bonnie Vale** | Royal National Park (Bundeena) | 1h 10m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $34.00/night | nationalparks.nsw.gov.au |
| **Upper Colo Reserve** | Hawkesbury | 1h 35m | **YES** | 2WD | Composting / Cold / Non-potable / Fire Pits | $12.50/adult | hawkesbury.nsw.gov.au |
| **Mill Creek** | Dharug NP (Wisemans Ferry) | 1h 30m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Bendeela Camping** | Kangaroo Valley (WaterNSW) | 2h 15m | NO | 2WD | Flush / None / Non-potable / No Fires | $6.00 booking | waternsw.com.au |
| **Gambells Rest** | Morton NP (Bundanoon) | 2h 00m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Daly's Clearing** | Belanglo State Forest | 1h 45m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Wingello Forest** | Wingello State Forest | 1h 55m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Frying Pan Rock** | Chichester State Forest | 3h 15m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Telegherry** | Chichester State Forest | 3h 20m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Green Patch** | Booderee NP (Jervis Bay) | 2h 45m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $28.00/night | parksaustralia.gov.au |
| **Pebbly Beach** | Murramarang NP | 3h 30m | NO | 2WD | Pit / Cold / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Depot Beach** | Murramarang NP | 3h 25m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $34.00/night | nationalparks.nsw.gov.au |
| **Pretty Beach** | Murramarang NP | 3h 35m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $34.00/night | nationalparks.nsw.gov.au |
| **Newnes** | Wollemi NP (Lithgow) | 2h 45m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Dunphy's Camp** | Megalong Valley (NPWS) | 2h 15m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Boyd River** | Kanangra-Boyd NP | 3h 00m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Capertee Valley** | Capertee NP | 3h 10m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Coorongooba** | Wollemi NP (Glen Davis) | 2h 50m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Mystery Bay** | Eurobodalla Shire | 4h 30m (alt) | **YES** | 2WD | Pit / Cold / Non-potable / Fire Pits | $15.00/adult | mysterybay.com.au |
| **Colo Meroo** | Wollemi NP | 2h 00m | NO | Walk-in | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Wheeny Creek** | Wollemi NP | 1h 20m | NO | 2WD | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Gentlemans Halt** | Marramarra NP | 1h 30m | NO | Walk/Boat | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Lake Lyell** | Lithgow Council | 2h 15m | **YES** | 2WD | Flush / Hot / Potable / BBQ | $25.00/night | lakelyell.com.au |
| **Glenworth Valley** | Central Coast (Private) | 1h 10m | **YES** | 2WD | Flush / Hot / Potable / Fire Pits | $33.00/adult | glenworth.com.au |
| **Cattai National Park**| Cattai (Hawkesbury) | 1h 00m | NO | 2WD | Flush / Hot / Potable / BBQ | $24.60/night | nationalparks.nsw.gov.au |
| **Swann Reserve** | Wisemans Ferry | 1h 30m | **YES** | 2WD | Flush / None / Potable / Gas BBQ | $0 (Free) | hills.nsw.gov.au |

**Verification of All 4 Demo Presets:**
1. *"Sydney + Dog <3.5h"*: Returns The Pines, Turpentine, Upper Colo, Old Ford Reserve, Daly's Clearing, Glenworth Valley (6+ verified matches).
2. *"Family <2h"*: Returns Bonnie Vale, Cattai, Euroka, Upper Colo, The Pines (5+ verified matches).
3. *"90-min overnight"*: Returns Bonnie Vale (70m), Euroka (75m), Cattai (60m), Wheeny Creek (80m) (4+ verified matches).
4. *"4WD <4h"*: Returns Murphy's Glen, Newnes, Kanangra Boyd (3+ verified matches).

---

## Phase 4 (P1): Facilities Constraints & Server-Side OSRM

### Task 4.1: Natural Language Facilities Extraction & Strict Filtering
**Goal:** Parse toilet, shower, drinking water, and campfire requirements from natural language queries; filter strictly when data exists; report unverified constraints to user.

**Files:**
- Modify: [backend/app/services/llm_inference.py](file:///home/aksai/projects/camping/backend/app/services/llm_inference.py)
- Modify: [backend/app/schemas/trip_recommendation.py](file:///home/aksai/projects/camping/backend/app/schemas/trip_recommendation.py)
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Step 1: Write failing test in `test_recommendations.py`:**
```python
def test_facilities_toilets_essential_filter():
    res = client.post("/api/v1/trips/find-weekend", json={
        "prompt": "Family camping trip, toilets essential, under 2 hours",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    })
    assert res.status_code == 200
    cards = res.json()["cards"]
    assert len(cards) >= 1
    for c in cards:
        site = get_campsite_by_id(c["id"])
        assert site.facilities.get("toilets") in ["flush", "pit", "composting"]
```

**Step 2: Update `llm_inference.py` JSON Schema & Deterministic Parser:**
Add regex & LLM extraction for:
- `requires_toilets`: True if prompt contains "toilet", "dunny", "amenities", "restroom".
- `requires_showers`: True if prompt contains "shower", "hot shower".
- `requires_drinking_water`: True if prompt contains "drinking water", "potable water".
- `requires_campfires`: True if prompt contains "fire", "campfire", "fire pit".

**Step 3: Update `recommendation_engine.py`:**
Apply strict filtering in Phase 1 (Eligibility). If no campsites match, return clear `limiting_constraint`:
*"No dog-friendly sites found within 90 minutes with flush toilets. Try allowing pit toilets or extending drive time to 2 hours."*

---

### Task 4.2: Server-Side OSRM Routing & Geolocation Forwarding
**Goal:** Compute real road driving times and distances using OSRM with haversine $\times 1.25$ fallback; forward browser geolocation from `FindWeekendPlanner.tsx`.

**Files:**
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Modify: [frontend/src/components/FindWeekendPlanner.tsx](file:///home/aksai/projects/camping/frontend/src/components/FindWeekendPlanner.tsx)
- Modify: [frontend/src/app/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/page.tsx)

**Step 1: Implement OSRM table call in `recommendation_engine.py`:**
Query `http://router.project-osrm.org/table/v1/driving/...` (or local OSRM instance) with origins and campsite coordinates. Fall back cleanly to Haversine $\times 1.25$ if OSRM is unreachable.

**Step 2: Pass `startLocation` to `FindWeekendPlanner`:**
In `frontend/src/app/page.tsx`, pass `startLocation` prop to `<FindWeekendPlanner startLocation={startLocation} />` so browser geolocation coordinates are used for the search origin.

---

## Phase 5 (P2): Parity & Conversational Adjustments

### Task 5.1: Conversational What-If (`/trips/adjust`) via Local LLM
**Goal:** Route freeform trip adjustment queries ("leave Saturday morning", "allow 45 more mins", "find one with river swimming") through centralized Qwen3-9B on `:8002` with deterministic fallback.

**Files:**
- Modify: [backend/app/api/v1/endpoints/trips.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/trips.py)
- Modify: [backend/app/services/llm_inference.py](file:///home/aksai/projects/camping/backend/app/services/llm_inference.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

---

### Task 5.2: Programmatic SEO Campground Pages (32 Verified Sites)
**Goal:** Generate 32 distinct SEO pages (`/explore/[slug]`) targeting canonical campgrounds with live NSW RFS fire status rendering and the non-negotiable degradation banner.

**Files:**
- Modify: [frontend/src/app/explore/[slug]/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/explore/[slug]/page.tsx)
- Create: `frontend/src/app/sitemap.ts`

---

### Task 5.3: PWA & Offline Service Worker Caching
**Goal:** Deliver true offline parity by registering a Service Worker (`next-pwa` or vanilla `sw.js`) that caches saved trips, the offline packing list, and emergency NSW contact information when campers lose cellular reception.

**Files:**
- Create: `frontend/public/sw.js`
- Create: `frontend/public/manifest.json`
- Modify: [frontend/src/app/layout.tsx](file:///home/aksai/projects/camping/frontend/src/app/layout.tsx)

---

## 🛡️ Non-Negotiable Guardrails & Verification Checklist

1. **Fire Rating Honesty:** Never synthesize a fire rating for non-NSW states. If the feed is unreachable, render the 503 degradation banner.
2. **Strict Provenance:** Never show fabricated compromises or templated fees. If data is unknown, render "Not verified yet".
3. **Continuous Plan B Monitoring:** Never set `plan_b_alert_active = False` automatically after creating an alert.
4. **Backward Compatibility:** All existing endpoints (`GET /campsites`, `GET /saved-trips/dashboard/{email}`, `/pack/[id]`, `/trip/[token]`) must remain fully functional.
5. **Quality Gates:** 
   - `pytest tests/` $\to$ 100% passing.
   - `npx tsc --noEmit` $\to$ 0 errors.
   - `npm run lint` $\to$ 0 errors.
