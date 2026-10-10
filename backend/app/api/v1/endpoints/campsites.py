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
    except Exception as e:
        logger.info(f"Ollama local AI unavailable, using fallback: {e}")
        pass
        
    # Fallback heuristic if local AI is not running
    fallback = f"Discover the perfect getaway at {campsite.name} in {campsite.state}. {pet_text} It is {rig_text}, making it an ideal destination for your next trip."
    return {"summary": fallback}

@router.get("/{campsite_id}/insights")
async def get_campsite_insights(campsite_id: int, db: Session = Depends(get_db)):
    campsite = db.query(Campsite).filter(Campsite.id == campsite_id).first()
    if not campsite:
        raise HTTPException(status_code=404, detail="Not found")

    import os
    tavily_key = os.environ.get("TAVILY_API_KEY", "")
    # Call Tavily
    async with httpx.AsyncClient() as client:
        try:
            tavily_res = await client.post("https://api.tavily.com/search", json={
                "api_key": tavily_key,
                "query": f"reviews amenities nearest town fuel grocery {campsite.name} camping {campsite.state} Australia",
                "search_depth": "basic",
                "max_results": 3
            })
            search_results = tavily_res.json()
            context = str(search_results.get("results", []))

            # Call Local Qwen LLM
            prompt = f"Analyze this search data about {campsite.name} {campsite.state}: {context}. Extract the following as strict JSON format (only output JSON): {{\"sentiment_score\": 85, \"nearest_fuel\": \"15 mins away in Huskisson\", \"nearest_grocery\": \"15 mins away\", \"top_activities\": [\"swimming\", \"hiking\", \"fishing\"]}}"

            local_res = await client.post("http://localhost:11434/api/generate", json={
                "model": "qwen2.5", 
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }, timeout=10.0)
            
            if local_res.status_code == 200:
                ai_data = local_res.json().get("response", "")
                import json
                parsed = json.loads(ai_data.strip())
                return parsed
            else:
                raise Exception("Local LLM returned non-200 status")
        except Exception as e:
            logger.error(f"Error getting insights: {e}")
            return {
                "sentiment_score": 80,
                "nearest_fuel": "Check local maps",
                "nearest_grocery": "Check local maps",
                "top_activities": ["Relaxing", "Local trails", "Stargazing"]
            }
