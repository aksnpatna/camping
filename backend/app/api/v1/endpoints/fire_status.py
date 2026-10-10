from fastapi import APIRouter, HTTPException
import random

router = APIRouter()

@router.get("/")
def get_fire_status(state: str = "NSW"):
    """
    Simulates a live fetch to the RFS / BOM feeds for fire danger ratings.
    MANDATORY rule: Do NOT cache and present stale fire rules.
    """
    # Simulate a 10% chance the feed is down (to test the Degradation Rule in UI)
    if random.random() < 0.10:
        raise HTTPException(status_code=503, detail="RFS/BOM feed is currently unavailable.")
        
    # Simulated live data
    ratings = ["Low-Moderate", "High", "Extreme", "Catastrophic"]
    
    # Weight towards normal conditions
    current_rating = random.choices(ratings, weights=[70, 20, 8, 2])[0]
    
    return {
        "state": state,
        "rating": current_rating,
        "status": "active",
        "last_updated": "live",
        "action_required": "Enforce total fire ban" if current_rating in ["Extreme", "Catastrophic"] else "Monitor conditions"
    }
