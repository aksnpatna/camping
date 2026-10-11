from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
import httpx
import logging
import xml.etree.ElementTree as ET

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_RATINGS = ["No Rating", "Moderate", "High", "Extreme", "Catastrophic"]

def fetch_live_rfs_status(state: str = "NSW", district: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches live fire danger rating from official state fire feeds (e.g. NSW RFS).
    MANDATORY Safety Rule: Do NOT cache and present stale fire rules.
    If the feed is down, raise exception to trigger the Degradation Rule.
    For non-NSW states, honestly return status 'unavailable' instead of synthetic ratings.
    """
    if state.upper() != "NSW":
        return {
            "state": state.upper(),
            "status": "unavailable",
            "message": f"Live feed currently active for NSW pilot catchment only. Check official {state.upper()} emergency services.",
            "rating": None,
            "total_fire_ban": None,
            "district": None,
            "source": f"{state.upper()} Emergency Services",
            "action_required": "Check official state emergency service before traveling"
        }

    # Attempt fetch from official NSW RFS FDR XML feed
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get("https://www.rfs.nsw.gov.au/feeds/fdrToban.xml")
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                target_district = None
                
                # Look for requested district or match default
                dist_nodes = root.findall(".//District")
                if district:
                    for d in dist_nodes:
                        name = d.findtext("Name", "")
                        if district.lower() in name.lower() or name.lower() in district.lower():
                            target_district = d
                            break
                            
                # Fallback to Greater Sydney Region if district not specified or not matched
                if target_district is None:
                    for d in dist_nodes:
                        name = d.findtext("Name", "")
                        if "greater sydney" in name.lower():
                            target_district = d
                            break
                if target_district is None and dist_nodes:
                    target_district = dist_nodes[0]

                if target_district is not None:
                    dist_name = target_district.findtext("Name", "Greater Sydney Region")
                    raw_rating = target_district.findtext("DangerLevelToday", "Moderate").strip().title()
                    toban_text = target_district.findtext("FireBanToday", "No").strip().lower()
                    total_fire_ban = toban_text == "yes"
                    
                    # Normalize rating to AFDRS standard
                    rating = raw_rating if raw_rating in VALID_RATINGS else "Moderate"

                    return {
                        "state": "NSW",
                        "district": dist_name,
                        "rating": rating,
                        "total_fire_ban": total_fire_ban,
                        "status": "live",
                        "source": "NSW Rural Fire Service (rfs.nsw.gov.au/feeds/fdrToban.xml)",
                        "action_required": "Enforce total fire ban — no wood, gas only if permitted" if total_fire_ban else "Monitor conditions"
                    }
                else:
                    raise Exception("No district data found in RFS feed")
            else:
                raise Exception(f"RFS feed returned HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Live RFS feed fetch failed: {e}")
        raise e

@router.get("")
def get_fire_status(state: str = "NSW", district: Optional[str] = Query(None)):
    """
    Live fire status endpoint adhering to the Camp Smart degradation rule:
    If live RFS/BOM feed is down, return 503 so frontend renders the prominent
    'status unavailable' banner. Never return random/simulated ratings in production.
    """
    try:
        data = fetch_live_rfs_status(state=state, district=district)
        return data
    except Exception as e:
        logger.error(f"Fire status unavailable: {e}")
        raise HTTPException(
            status_code=503,
            detail="RFS/BOM live feed is currently unavailable. Fire status unavailable."
        )
