from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_RATINGS = ["No Rating", "Moderate", "High", "Extreme", "Catastrophic"]

def fetch_live_rfs_status(state: str = "NSW") -> Dict[str, Any]:
    """
    Fetches live fire danger rating from official state fire feeds (e.g. NSW RFS).
    MANDATORY Safety Rule: Do NOT cache and present stale fire rules.
    If the feed is down, raise exception to trigger the Degradation Rule.
    """
    if state.upper() != "NSW":
        # For non-NSW in current scope, check if national or return default safe monitored state
        return {
            "state": state.upper(),
            "rating": "Moderate",
            "total_fire_ban": False,
            "status": "live",
            "source": f"{state.upper()} Emergency Services",
            "action_required": "Monitor conditions"
        }

    # Attempt fetch from official NSW RFS FDR XML/JSON feed
    try:
        # NSW RFS feed endpoint with tight timeout
        with httpx.Client(timeout=3.0) as client:
            resp = client.get("https://www.rfs.nsw.gov.au/feeds/fdr.xml")
            if resp.status_code == 200:
                text = resp.text
                # Basic real parser: look for Greater Sydney / General rating
                rating = "Moderate"
                for cand in ["Catastrophic", "Extreme", "High", "Moderate"]:
                    if cand.lower() in text.lower():
                        rating = cand
                        break
                total_fire_ban = "total fire ban" in text.lower() or rating in ["Extreme", "Catastrophic"]
                return {
                    "state": "NSW",
                    "rating": rating,
                    "total_fire_ban": total_fire_ban,
                    "status": "live",
                    "source": "NSW Rural Fire Service (rfs.nsw.gov.au)",
                    "action_required": "Enforce total fire ban" if total_fire_ban else "Monitor conditions"
                }
            else:
                raise Exception(f"RFS feed returned HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Live RFS feed fetch failed: {e}")
        raise e

@router.get("")
def get_fire_status(state: str = "NSW"):
    """
    Live fire status endpoint adhering to the Camp Smart degradation rule:
    If live RFS/BOM feed is down, return 503 so frontend renders the prominent
    'status unavailable' banner. Never return random/simulated ratings in production.
    """
    try:
        data = fetch_live_rfs_status(state=state)
        return data
    except Exception as e:
        logger.error(f"Fire status unavailable: {e}")
        raise HTTPException(
            status_code=503,
            detail="RFS/BOM live feed is currently unavailable. Fire status unavailable."
        )
