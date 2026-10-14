from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx
import logging

from app.core.database import get_db
from app.schemas.campsite import (
    CampsiteCreate,
    CampsiteResponse,
    CampsitePlanBResponse,
    CampsitePlanBAlternative,
)
from app.models.campsite import Campsite
from app.crud import campsite as crud_campsite
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class AISummaryResponse(BaseModel):
    summary: str

class CamperObservation(BaseModel):
    category: str
    observation: str
    source_attribution: str

class CampsiteInsightsResponse(BaseModel):
    sentiment_score: Optional[int] = None
    nearest_fuel: str
    nearest_grocery: str
    top_activities: List[str]
    observations: List[CamperObservation] = []
    retrieved_at: str

import time
from datetime import datetime, timezone
INSIGHTS_CACHE = {}
CACHE_TTL = 600  # 10 minutes max cache (freshness first)

@router.post("", response_model=CampsiteResponse, status_code=201)
def create_campsite(campsite: CampsiteCreate, admin_key: str = Query(...), db: Session = Depends(get_db)):
    import os
    expected_key = os.environ.get("ADMIN_KEY")
    if not expected_key or admin_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return crud_campsite.create_campsite(db=db, campsite=campsite)

from typing import List, Optional
from fastapi import Query

@router.get("", response_model=List[CampsiteResponse])
def read_campsites(
    skip: int = 0, 
    limit: int = Query(5000, le=10000), 
    state: Optional[str] = None,
    dog_friendly: Optional[bool] = None,
    rig_access: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud_campsite.get_campsites(
        db, 
        skip=skip, 
        limit=limit, 
        state=state, 
        dog_friendly=dog_friendly, 
        rig_access=rig_access
    )

from app.schemas.check_in import CheckInCreate, CheckInResponse, CheckInSummary, CampsiteCheckInsListResponse

@router.post("/{campsite_id}/check-ins", response_model=CheckInResponse, status_code=201)
def submit_check_in(campsite_id: int, check_in: CheckInCreate, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
    return crud_campsite.create_check_in(db=db, campsite_id=campsite_id, check_in_in=check_in)

@router.get("/{campsite_id}/check-ins", response_model=CampsiteCheckInsListResponse)
def get_check_ins(campsite_id: int, limit: int = 20, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
    check_ins = crud_campsite.get_check_ins_for_campsite(db=db, campsite_id=campsite_id, limit=limit)
    
    summary = CheckInSummary()
    if check_ins:
        latest = check_ins[0]
        water = next((c.water_status for c in check_ins if c.water_status), None)
        toilets = next((c.toilets_status for c in check_ins if c.toilets_status), None)
        road = next((c.road_status for c in check_ins if c.road_status), None)
        vibe = next((c.vibe_status for c in check_ins if c.vibe_status), None)
        telco = next((c.telco_status for c in check_ins if c.telco_status), None)
        
        summary = CheckInSummary(
            water=water,
            toilets=toilets,
            road=road,
            vibe=vibe,
            telco=telco,
            last_updated=latest.created_at.isoformat() if latest.created_at else None
        )
        
    return CampsiteCheckInsListResponse(
        total_count=len(check_ins),
        summary=summary,
        recent_check_ins=check_ins
    )

import os

async def call_groq_fallback(prompt: str, is_json: bool = False):
    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_api_key:
        raise Exception("No GROQ_API_KEY set")
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {groq_api_key}"}
        payload = {
            "model": "llama3-8b-8192",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
        if is_json:
            payload["response_format"] = {"type": "json_object"}
        res = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"]
        raise Exception(f"Groq error: {res.text}")

@router.get("/{campsite_id}", response_model=CampsiteResponse)
def get_campsite(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
    from app.services.facts import FactBuilder
    from app.models.check_in import CampsiteCheckIn
    check_ins = db.query(CampsiteCheckIn).filter(CampsiteCheckIn.campsite_id == campsite.id).order_by(CampsiteCheckIn.created_at.desc()).limit(5).all()
    resp = CampsiteResponse.model_validate(campsite)
    resp.facts = FactBuilder.build_campsite_facts(campsite, check_ins=check_ins)
    return resp


@router.get("/{campsite_id}/plan-b", response_model=CampsitePlanBResponse)
def get_campsite_plan_b(
    campsite_id: int,
    limit: int = Query(2, ge=1, le=10),
    has_dog: Optional[bool] = Query(None),
    rig_access: Optional[str] = Query(None),
    origin_lat: Optional[float] = Query(None),
    origin_lng: Optional[float] = Query(None),
    max_drive_hours: Optional[float] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")

    from datetime import date, timedelta
    from app.models.saved_trip import SavedTrip
    from app.worker.plan_b import find_plan_b_alternatives
    from app.services.facts import FactBuilder
    from app.models.check_in import CampsiteCheckIn

    # Default to next weekend if unprovided
    d_start = date.today() + timedelta(days=3)
    d_end = d_start + timedelta(days=2)
    if start_date:
        try:
            d_start = date.fromisoformat(start_date)
        except ValueError:
            pass
    if end_date:
        try:
            d_end = date.fromisoformat(end_date)
        except ValueError:
            pass

    mock_trip = SavedTrip(
        campsite_id=campsite.id,
        user_email="plan-b-check@campsmart.au",
        start_date=d_start,
        end_date=d_end,
        has_dog=has_dog,
        rig_access=rig_access,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        max_drive_hours=max_drive_hours,
    )

    alts_raw = find_plan_b_alternatives(db, mock_trip, campsite, limit=limit)

    results = []
    for alt in alts_raw:
        alt_site = db.query(Campsite).filter(Campsite.id == alt["id"]).first()
        facts_obj = None
        lat = None
        lng = None
        if alt_site:
            lat = alt_site.latitude
            lng = alt_site.longitude
            check_ins = (
                db.query(CampsiteCheckIn)
                .filter(CampsiteCheckIn.campsite_id == alt_site.id)
                .order_by(CampsiteCheckIn.created_at.desc())
                .limit(5)
                .all()
            )
            facts_obj = FactBuilder.build_campsite_facts(alt_site, check_ins=check_ins)

        results.append(
            CampsitePlanBAlternative(
                id=alt["id"],
                name=alt["name"],
                state=alt["state"],
                management_type=alt.get("management_type"),
                dog_friendly=alt.get("dog_friendly"),
                driving_time_minutes=alt.get("driving_time_minutes"),
                conditions_verified=alt.get("conditions_verified", False),
                reason=alt.get("reason", ""),
                latitude=lat,
                longitude=lng,
                facts=facts_obj,
            )
        )

    return CampsitePlanBResponse(
        original_campsite_id=campsite.id,
        alternatives=results,
    )


AI_SUMMARY_CACHE = {}
AI_SUMMARY_CACHE_TTL = 86400  # 24 hours cache

@router.get("/{campsite_id}/ai-summary", response_model=AISummaryResponse)
async def get_ai_summary(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
        
    if campsite_id in AI_SUMMARY_CACHE:
        val, ts = AI_SUMMARY_CACHE[campsite_id]
        if time.time() - ts < AI_SUMMARY_CACHE_TTL:
            return {"summary": val}

    # 1. Resolve Ground Truth Context
    from app.services.town_locator import TownLocatorService
    locality = TownLocatorService.find_nearest_locality(db, campsite.longitude, campsite.latitude)
    town_text = f"near {locality.locality} (~{locality.distance_km:.1f} km away)" if locality else f"in {campsite.state}"

    mgmt_text = campsite.management_type or "Public park"
    rig_text = f"accessible for {', '.join(campsite.rig_access)}" if campsite.rig_access else "standard vehicle and tent access"

    if campsite.dog_friendly is True:
        pet_text = "dog-friendly (pets permitted on leash)"
    elif campsite.dog_friendly is False:
        pet_text = "pets strictly prohibited (wildlife conservation area)"
    else:
        pet_text = "pet status unverified"

    fac_parts = []
    if campsite.facilities and isinstance(campsite.facilities, dict):
        f = campsite.facilities
        if f.get("toilets") and f["toilets"] != "none":
            fac_parts.append(f"{f['toilets']} toilets")
        if f.get("showers") and f["showers"] != "none":
            fac_parts.append(f"{f['showers']} showers")
        if f.get("campfires") is True:
            fac_parts.append("campfires allowed in designated fire pits")
        elif f.get("campfires") is False:
            fac_parts.append("no open fires permitted")
        if f.get("drinking_water") is True:
            fac_parts.append("drinking water on tap")
        elif f.get("drinking_water") is False:
            fac_parts.append("no drinking water (bring all water)")

    facilities_text = ", ".join(fac_parts) if fac_parts else "unpowered bush camping with basic amenities"
    fees_text = f"Fees: {campsite.fees}" if campsite.fees else "Fees apply per booking regulations"

    # 2. Seasoned Australian Bush Camper Prompt (Zero Generic Clichés)
    prompt = f"""You are a seasoned Australian bush camper and trip planner.
Write a concise, vivid 2-sentence pitch for {campsite.name} in {campsite.state}.

Grounded facts:
- Managing Authority: {mgmt_text}
- Setting / Proximity: {town_text}
- Access: {rig_text}
- Pets: {pet_text}
- Facilities: {facilities_text}
- Fees: {fees_text}

Strict Writing Rules:
1. Do NOT use generic marketing clichés like 'unforgettable adventure', 'breathtaking beauty', 'idyllic getaway', 'outdoor enthusiasts', 'hidden gem', 'paradise', 'stunner'.
2. Highlight specific, tangible features of this campsite (real setting, practical amenity prep like BYO water/firewood, dog permissions, proximity to nearest town).
3. Sound like a knowledgeable local camper giving a direct, authentic tip.
4. Keep it strictly 2 natural sentences. Do not use emojis, quotation marks, or bullet points.
"""

    from app.services.llm_inference import LLMInferenceService
    import re

    summary = await LLMInferenceService.call_local_server(prompt)
    if not summary:
        summary = await LLMInferenceService.call_ollama(prompt, is_json=False)
    if not summary:
        summary = await LLMInferenceService.call_groq(prompt, is_json=False)

    if summary:
        clean_sum = summary.strip()
        clean_sum = re.sub(r"^```(?:markdown|text)?\s*", "", clean_sum)
        clean_sum = re.sub(r"\s*```$", "", clean_sum)
        clean_sum = clean_sum.strip('"\'')
        clean_sum = re.sub(r"\s+", " ", clean_sum).strip()
        AI_SUMMARY_CACHE[campsite_id] = (clean_sum, time.time())
        return {"summary": clean_sum}

    # Grounded factual fallback if LLM is offline
    fallback = (
        f"{campsite.name} is a {mgmt_text} campground in {campsite.state}, situated {town_text}. "
        f"It is {rig_text} and {pet_text}, offering {facilities_text} ({fees_text.lower()})."
    )
    AI_SUMMARY_CACHE[campsite_id] = (fallback, time.time())
    return {"summary": fallback}


@router.get("/{campsite_id}/insights", response_model=CampsiteInsightsResponse)
async def get_campsite_insights(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Not found")
        
    if campsite_id in INSIGHTS_CACHE:
        val, ts = INSIGHTS_CACHE[campsite_id]
        if time.time() - ts < CACHE_TTL:
            return val

    # 1. Authoritative Spatial Town Resolution (100% Nationwide PostGIS Coverage)
    from app.services.town_locator import TownLocatorService
    locality_info = TownLocatorService.find_nearest_locality(db, campsite.longitude, campsite.latitude)
    if locality_info:
        town_advisory = TownLocatorService.get_town_amenities_advisory(locality_info)
        default_fuel = town_advisory["nearest_fuel"]
        default_grocery = town_advisory["nearest_grocery"]
        town_obs = town_advisory["field_observation"]
        town_name = locality_info.locality
    else:
        default_fuel = f"Check fuel stations along approach route in {campsite.state}"
        default_grocery = f"Stock up on supplies and drinking water in {campsite.state} before departure"
        town_obs = f"Verify local park alerts and road conditions before travelling to {campsite.name}."
        town_name = campsite.state

    # 2. Gather Context via DuckDuckGo (Lite/HTML backends)
    context = ""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            query = f'"{campsite.name}" {town_name} camping'
            try:
                ddg_results = list(ddgs.text(query, backend="lite", max_results=3, safesearch="off"))
            except Exception:
                ddg_results = list(ddgs.text(query, backend="html", max_results=3, safesearch="off"))
            if ddg_results:
                context = str([r.get("body") for r in ddg_results if r.get("body")])
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")

    # 3. Extract Insights via Centralized Local LLM (Qwen3-9B)
    now_iso = datetime.now(timezone.utc).isoformat()
    dist_hint = f"approximately {locality_info.distance_km:.1f} km away" if locality_info else "distance unknown"
    prompt = f"""You are an Australian camping guide. Analyze this factual data about {campsite.name} in {campsite.state}.
Nearest town hub: {town_name} ({dist_hint}).
Search context: {context if context else 'No web snippets available.'}

Extract strict JSON matching this schema:
{{
  "nearest_fuel": "{default_fuel}",
  "nearest_grocery": "{default_grocery}",
  "top_activities": ["Hiking", "Relaxing", "Wildlife Spotting"],
  "observations": [
    {{"category": "Town Amenities", "observation": "{town_obs}", "source_attribution": "Camp Smart Spatial Index"}},
    {{"category": "Road Access", "observation": "Check track conditions before departure", "source_attribution": "Park Advisory"}}
  ]
}}
Never output placeholder text like 'Verify in nearest town'. If specific brand or shop is found, mention it; otherwise cite {town_name}. Output JSON only."""

    from app.services.llm_inference import LLMInferenceService
    ai_data = await LLMInferenceService.call_local_server(prompt)
    if not ai_data:
        ai_data = await LLMInferenceService.call_ollama(prompt, is_json=True)
    if not ai_data:
        ai_data = await LLMInferenceService.call_groq(prompt, is_json=True)

    if ai_data:
        try:
            import json
            import re
            clean_json = ai_data.strip()
            # Strip markdown code block fences if present
            if "```" in clean_json:
                match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_json)
                if match:
                    clean_json = match.group(1).strip()
                else:
                    clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json)
                    clean_json = re.sub(r"\s*```$", "", clean_json)

            raw_dict = json.loads(clean_json)

            # Ensure placeholders are replaced by authoritative spatial values
            if not raw_dict.get("nearest_fuel") or "Verify in nearest town" in raw_dict.get("nearest_fuel", ""):
                raw_dict["nearest_fuel"] = default_fuel
            if not raw_dict.get("nearest_grocery") or "Verify in nearest town" in raw_dict.get("nearest_grocery", ""):
                raw_dict["nearest_grocery"] = default_grocery

            # Ensure town observation is present
            observations = raw_dict.get("observations") or []
            if not any(obs.get("category") == "Town Amenities" for obs in observations if isinstance(obs, dict)):
                observations.insert(0, {
                    "category": "Town Amenities",
                    "observation": town_obs,
                    "source_attribution": "Camp Smart Spatial Index"
                })
            raw_dict["observations"] = observations
            raw_dict["retrieved_at"] = now_iso

            parsed = CampsiteInsightsResponse.model_validate(raw_dict)
            INSIGHTS_CACHE[campsite_id] = (parsed, time.time())
            return parsed
        except Exception as e:
            logger.warning(f"Failed to parse insights JSON from LLM: {e}")

    # Authoritative spatial fallback (guarantees zero generic placeholders)
    fallback = CampsiteInsightsResponse(
        sentiment_score=None,
        nearest_fuel=default_fuel,
        nearest_grocery=default_grocery,
        top_activities=["Hiking", "Relaxing", "Wildlife Spotting"],
        observations=[
            CamperObservation(
                category="Town Amenities",
                observation=town_obs,
                source_attribution="Camp Smart Spatial Index"
            ),
            CamperObservation(
                category="General",
                observation=f"Verify current park alerts and weather before heading to {campsite.name}.",
                source_attribution="Camp Smart Field Advisory"
            )
        ],
        retrieved_at=now_iso
    )
    INSIGHTS_CACHE[campsite_id] = (fallback, time.time())
    return fallback

