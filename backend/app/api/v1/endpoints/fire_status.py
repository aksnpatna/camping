from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
import httpx
import logging
import xml.etree.ElementTree as ET

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_RATINGS = ["No Rating", "Moderate", "High", "Extreme", "Catastrophic"]

STATE_EMERGENCY_AGENCIES: Dict[str, Dict[str, Any]] = {
    "NSW": {
        "agency": "NSW Rural Fire Service (RFS)",
        "url": "https://www.rfs.nsw.gov.au",
        "feed_type": "rfs_xml",
        "default_district": "Greater Sydney Region",
        "source_label": "NSW Rural Fire Service (RFS) (rfs.nsw.gov.au/feeds/fdrToban.xml)",
    },
    "ACT": {
        "agency": "ACT Emergency Services Agency (ESA)",
        "url": "https://esa.act.gov.au",
        "feed_type": "rfs_xml",
        "default_district": "ACT",
        "source_label": "ACT Emergency Services Agency (ESA) via AFDRS Feed",
    },
    "JBT": {
        "agency": "Parks Australia & NSW RFS (Illawarra/Shoalhaven District)",
        "url": "https://www.parksaustralia.gov.au/booderee/",
        "feed_type": "rfs_xml",
        "default_district": "Illawarra/Shoalhaven",
        "source_label": "Parks Australia & NSW RFS (Illawarra/Shoalhaven District)",
    },
    "VIC": {
        "agency": "Country Fire Authority (CFA) & VicEmergency",
        "url": "https://www.cfa.vic.gov.au/warnings-restrictions/total-fire-bans-fire-danger-ratings",
        "feed_type": "none",
        "default_district": "Central",
        "source_label": "Country Fire Authority (CFA) & VicEmergency",
    },
    "QLD": {
        "agency": "Queensland Fire Department (QFD)",
        "url": "https://www.fire.qld.gov.au/prepare/fire-danger-ratings",
        "feed_type": "none",
        "default_district": "South East",
        "source_label": "Queensland Fire Department (QFD)",
    },
    "WA": {
        "agency": "Department of Fire and Emergency Services (DFES) & Emergency WA",
        "url": "https://www.emergency.wa.gov.au",
        "feed_type": "none",
        "default_district": "Perth Metropolitan",
        "source_label": "Department of Fire and Emergency Services (DFES) & Emergency WA",
    },
    "SA": {
        "agency": "South Australian Country Fire Service (CFS)",
        "url": "https://www.cfs.sa.gov.au/warnings-restrictions/fire-danger-ratings/",
        "feed_type": "none",
        "default_district": "Mount Lofty Ranges",
        "source_label": "South Australian Country Fire Service (CFS)",
    },
    "TAS": {
        "agency": "Tasmania Fire Service (TFS)",
        "url": "https://www.fire.tas.gov.au/fire-danger-rating/",
        "feed_type": "none",
        "default_district": "Upper Derwent Valley",
        "source_label": "Tasmania Fire Service (TFS)",
    },
    "NT": {
        "agency": "Bushfires NT & NT Fire and Emergency Services (NTFES)",
        "url": "https://bushfires.nt.gov.au",
        "feed_type": "none",
        "default_district": "Darwin and Rural",
        "source_label": "Bushfires NT & NT Fire and Emergency Services (NTFES)",
    },
}


def fetch_live_rfs_status(state: str = "NSW", district: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetches live fire danger rating from official state fire feeds (e.g. NSW RFS).
    MANDATORY Safety Rule: Do NOT cache and present stale fire rules.
    If the feed is down, raise exception to trigger the Degradation Rule.
    For states where automated feeds are pending rollout, honestly return status 'unavailable'
    referencing the authoritative statutory emergency agency. Never output synthetic ratings.
    """
    state_key = state.upper().strip()
    agency = STATE_EMERGENCY_AGENCIES.get(state_key)

    if not agency:
        return {
            "state": state_key,
            "status": "unavailable",
            "message": f"Fire service information for jurisdiction '{state_key}' is unavailable.",
            "rating": None,
            "total_fire_ban": None,
            "district": district,
            "source": f"{state_key} Emergency Services",
            "action_required": "Check official local emergency service before travelling"
        }

    # For jurisdictions without a live automated XML feed parser, degrade honestly
    if agency.get("feed_type") != "rfs_xml":
        return {
            "state": state_key,
            "status": "unavailable",
            "message": (
                f"Live automated feed for {agency['agency']} is currently in rollout. "
                f"Check official {agency['agency']} channels at {agency['url']} before travelling."
            ),
            "rating": None,
            "total_fire_ban": None,
            "district": district or agency.get("default_district"),
            "source": agency["source_label"],
            "official_url": agency["url"],
            "action_required": f"Check official {agency['agency']} warnings before travelling"
        }

    # Attempt fetch from official NSW RFS FDR XML feed (covers NSW, ACT, and JBT/Shoalhaven)
    target_search = district or agency.get("default_district", "Greater Sydney Region")
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get("https://www.rfs.nsw.gov.au/feeds/fdrToban.xml")
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                target_district = None

                dist_nodes = root.findall(".//District")
                wanted = (target_search or "").strip().lower()

                def _name(node) -> str:
                    return (node.findtext("Name") or "").strip().lower()

                # Exact (case-insensitive) match first, then the requested name
                # contained in a feed name. Never fall back to a different
                # district: a rating for the wrong area is worse than none.
                for d in dist_nodes:
                    if wanted and _name(d) == wanted:
                        target_district = d
                        break
                if target_district is None and wanted:
                    for d in dist_nodes:
                        if wanted in _name(d):
                            target_district = d
                            break

                if target_district is None:
                    return {
                        "state": state_key,
                        "status": "unavailable",
                        "message": (
                            f"District '{target_search}' was not found in the live "
                            f"{agency['agency']} feed. Check the official source before travelling."
                        ),
                        "rating": None,
                        "total_fire_ban": None,
                        "district": target_search,
                        "source": agency["source_label"],
                        "official_url": agency["url"],
                        "action_required": f"Check official {agency['agency']} warnings before travelling",
                    }

                if target_district is not None:
                    dist_name = (target_district.findtext("Name") or "").strip() or None
                    raw_rating = (target_district.findtext("DangerLevelToday") or "").strip().title()
                    toban_text = (target_district.findtext("FireBanToday") or "").strip().lower()

                    # A declared ban is read from the feed. It is never inferred
                    # from the rating, and an absent element is not treated as "No".
                    if toban_text == "yes":
                        total_fire_ban = True
                    elif toban_text == "no":
                        total_fire_ban = False
                    else:
                        total_fire_ban = None

                    # Unknown is unknown. Never coerce a missing or unrecognised
                    # element into a substantive rating.
                    rating = raw_rating if raw_rating in VALID_RATINGS else "No Rating"

                    if total_fire_ban:
                        action_required = "Enforce total fire ban — no wood, gas only if permitted"
                    elif rating == "No Rating":
                        action_required = (
                            f"Rating unavailable for this district — check the official "
                            f"{agency['agency']} source before travelling"
                        )
                    else:
                        action_required = "Monitor conditions"

                    return {
                        "state": state_key,
                        "district": dist_name,
                        "rating": rating,
                        "total_fire_ban": total_fire_ban,
                        "status": "live",
                        "source": agency["source_label"],
                        "action_required": action_required
                    }
                else:
                    raise Exception("No district data found in RFS feed")
            else:
                raise Exception(f"RFS feed returned HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"Live fire feed fetch failed for {state_key}: {e}")
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
