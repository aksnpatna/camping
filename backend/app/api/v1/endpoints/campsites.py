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

@router.post("", response_model=CampsiteResponse)
def create_campsite(campsite: CampsiteCreate, db: Session = Depends(get_db)):
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

@router.get("/{campsite_id}/ai-summary", response_model=AISummaryResponse)
async def get_ai_summary(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Campsite not found")
        
    pet_text = "It is pet friendly." if campsite.dog_friendly else "Leave the pets at home."
    rig_text = f"accessible for {', '.join(campsite.rig_access)}" if campsite.rig_access else "a great spot"
    
    prompt = f"You are a helpful travel guide. Write exactly 2 short, enthusiastic sentences pitching a camping trip to {campsite.name} in {campsite.state}. Mention that it is {rig_text} and {pet_text}. Do not use emojis."
    
    # Try Ollama (Local-First AI Engine per AGENTS.md)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.post("http://localhost:11434/api/generate", json={
                "model": "qwen2", 
                "prompt": prompt,
                "stream": False
            })
            if res.status_code == 200:
                data = res.json()
                return {"summary": data.get("response", "").strip()}
            else:
                raise Exception("Ollama returned non-200")
    except Exception as e:
        logger.info(f"Ollama local AI unavailable, trying Groq fallback: {e}")
        try:
            summary = await call_groq_fallback(prompt)
            return {"summary": summary.strip()}
        except Exception as e2:
            logger.info(f"Groq fallback failed: {e2}")
        
    # Fallback heuristic if local AI is not running
    fallback = f"Discover the perfect getaway at {campsite.name} in {campsite.state}. {pet_text} It is {rig_text}, making it an ideal destination for your next trip."
    return {"summary": fallback}

@router.get("/{campsite_id}/insights")
async def get_campsite_insights(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Not found")

    import json
    
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

    # 2. Extract Insights via AI Engine
    prompt = f"Analyze this search data about {campsite.name} {campsite.state}: {context}. Extract the following as strict JSON format (only output JSON): {{\"sentiment_score\": 85, \"nearest_fuel\": \"15 mins away in Huskisson\", \"nearest_grocery\": \"15 mins away\", \"top_activities\": [\"swimming\", \"hiking\", \"fishing\"]}}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            local_res = await client.post("http://localhost:11434/api/generate", json={
                "model": "qwen2.5", 
                "prompt": prompt,
                "stream": False,
                "format": "json"
            })
            if local_res.status_code == 200:
                ai_data = local_res.json().get("response", "")
                return json.loads(ai_data.strip())
            else:
                raise Exception("Local LLM returned non-200 status")
    except Exception as e:
        logger.error(f"Error getting insights from Ollama: {e}")
        try:
            groq_prompt = prompt + "\nProvide the JSON only without any markdown blocks or backticks."
            ai_data = await call_groq_fallback(groq_prompt, is_json=True)
            return json.loads(ai_data.strip())
        except Exception as e2:
            logger.error(f"Error getting insights from Groq: {e2}")
            return {
                "sentiment_score": 80,
                "nearest_fuel": "Check local maps",
                "nearest_grocery": "Check local maps",
                "top_activities": ["Relaxing", "Local trails", "Stargazing"]
            }
