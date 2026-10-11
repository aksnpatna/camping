from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import httpx
import logging

from app.core.database import get_db
from app.schemas.campsite import CampsiteCreate, CampsiteResponse
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
    limit: int = 100, 
    dog_friendly: Optional[bool] = None,
    rig_access: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud_campsite.get_campsites(db, skip=skip, limit=limit, dog_friendly=dog_friendly, rig_access=rig_access)

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
    return campsite

@router.get("/{campsite_id}/ai-summary", response_model=AISummaryResponse)
async def get_ai_summary(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
        
    pet_text = "It is pet friendly." if campsite.dog_friendly is True else ("Pets are not permitted." if campsite.dog_friendly is False else "Pet policy is unverified.")
    rig_text = f"accessible for {', '.join(campsite.rig_access)}" if campsite.rig_access else "a great spot"
    
    prompt = f"You are a helpful travel guide. Write exactly 2 short, enthusiastic sentences pitching a camping trip to {campsite.name} in {campsite.state}. Mention that it is {rig_text} and {pet_text}. Do not use emojis."
    
    from app.services.llm_inference import LLMInferenceService
    summary = await LLMInferenceService.call_local_server(prompt)
    if not summary:
        summary = await LLMInferenceService.call_ollama(prompt, is_json=False)
    if not summary:
        summary = await LLMInferenceService.call_groq(prompt, is_json=False)

    if summary:
        return {"summary": summary.strip()}
        
    # Fallback heuristic if AI is not running
    fallback = f"Discover the perfect getaway at {campsite.name} in {campsite.state}. {pet_text} It is {rig_text}, making it an ideal destination for your next trip."
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

    # 1. Gather Context via DuckDuckGo
    context = ""
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            query = f"{campsite.name} {campsite.state} camping reviews nearest town fuel grocery Australia"
            ddg_results = list(ddgs.text(query, max_results=3, safesearch="off"))
            context = str([r.get("body") for r in ddg_results])
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")

    # 2. Extract Insights via Centralized Local LLM (Qwen3-9B)
    now_iso = datetime.now(timezone.utc).isoformat()
    prompt = f"""Analyze this search data about {campsite.name} {campsite.state}: {context}.
Extract strict JSON:
{{
  "nearest_fuel": "e.g. 15 mins away in nearest town",
  "nearest_grocery": "e.g. 20 mins away in nearest town",
  "top_activities": ["swimming", "hiking", "fishing"],
  "observations": [
    {{"category": "Road Access", "observation": "Access road suitable for 2WD in dry conditions", "source_attribution": "Camper Field Note"}},
    {{"category": "Amenities", "observation": "Bring all drinking water and toilet paper", "source_attribution": "Park Advisory"}}
  ]
}}
Output strict JSON only.
"""

    from app.services.llm_inference import LLMInferenceService
    ai_data = await LLMInferenceService.call_local_server(prompt)
    if not ai_data:
        ai_data = await LLMInferenceService.call_ollama(prompt, is_json=True)
    if not ai_data:
        ai_data = await LLMInferenceService.call_groq(prompt, is_json=True)

    if ai_data:
        try:
            import json
            raw_dict = json.loads(ai_data.strip())
            raw_dict["retrieved_at"] = now_iso
            parsed = CampsiteInsightsResponse.model_validate(raw_dict)
            INSIGHTS_CACHE[campsite_id] = (parsed, time.time())
            return parsed
        except Exception as e:
            logger.warning(f"Failed to parse insights JSON from LLM: {e}")

    fallback = CampsiteInsightsResponse(
        sentiment_score=None,
        nearest_fuel="Verify in nearest town",
        nearest_grocery="Verify in nearest town",
        top_activities=["Hiking", "Relaxing", "Wildlife Spotting"],
        observations=[
            CamperObservation(
                category="General",
                observation=f"Verify current park alerts and weather before heading to {campsite.name}.",
                source_attribution="Camp Smart Field Advisory"
            )
        ],
        retrieved_at=now_iso
    )
    return fallback
