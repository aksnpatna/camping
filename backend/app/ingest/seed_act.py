"""
Bulk ingest of ACT Public Land Reserves & Jervis Bay Territory (JBT) from official spatial data.

Sources:
  1. "ACT Public Land Reserves",
     published by the Australian Capital Territory Government (EPSDD / ACT Parks and Conservation Service)
     under Creative Commons Attribution 4.0 (CC-BY 4.0).
  2. Jervis Bay Territory (JBT) Booderee National Park,
     managed by Parks Australia / Wreck Bay Aboriginal Community under CC-BY 4.0.

Design rules:
  - Open Data Foundation: Authoritative spatial polygon layer from ACTmapi / ACT Geospatial.
  - Territorial Carve-Out (Fixes R11): Jervis Bay Territory sites (Green Patch, Bristol Point, Cave Beach)
    are strictly labelled as state="JBT", management_type="Parks Australia", never "NSW".
  - Honest nulls: Facilities stay None (never guess toilets or amenities).
  - Statutory policy rules: Domestic pets banned in ACT national parks and nature reserves;
    Woods Reserve and Kowen Forest designated dog-friendly on leash.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from shapely.geometry import Polygon
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campsite import (
    Campsite,
    DATA_STATUS_RULE_DERIVED,
    DATA_STATUS_VERIFIED,
)

logger = logging.getLogger(__name__)

# --- Provenance & Metadata ---------------------------------------------------
ACT_DATASET_URL = (
    "https://services1.arcgis.com/E5n4f1VY84i0xSjy/arcgis/rest/services/Public_Land_Reserves/FeatureServer/0"
)
ACT_QUERY_URL = f"{ACT_DATASET_URL}/query"
ACT_LICENCE = "CC-BY 4.0"
ACT_ATTRIBUTION = (
    "© Australian Capital Territory (Environment, Planning and Sustainable Development Directorate). "
    "Source: ACT Public Land Reserves."
)

# --- Statutory Policy Evidence ------------------------------------------------
ACT_DOG_RULE_URL = "https://www.parks.act.gov.au/before-you-go/dogs-in-parks"
ACT_BOOKING_HUB_URL = "https://www.parks.act.gov.au/"
WOODS_RESERVE_DOG_URL = "https://www.parks.act.gov.au/find-a-park/woods-reserve-recreation-area"

BOODEREE_BOOKING_URL = "https://parksaustralia.gov.au/booderee/camp/"
BOODEREE_RULES_URL = "https://parksaustralia.gov.au/booderee/plan/rules/"
BOODEREE_DATASET_URL = "https://parksaustralia.gov.au/booderee/"

# Canonical dedicated campgrounds in ACT & JBT
CANONICAL_ACT_CAMPGROUNDS = [
    {
        "name": "Orroral Campground",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.6811,
        "longitude": 148.9839,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": ACT_DOG_RULE_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Located in Namadgi National Park. Dogs prohibited.",
    },
    {
        "name": "Honeysuckle Campground",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.5833,
        "longitude": 149.0069,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": ACT_DOG_RULE_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Located in Namadgi National Park near historic tracking station. Dogs prohibited.",
    },
    {
        "name": "Mount Clear Campground",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.8833,
        "longitude": 149.0333,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": ACT_DOG_RULE_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Remote bush camping in southern Namadgi National Park. Dogs prohibited.",
    },
    {
        "name": "Woods Reserve Campground",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.4981,
        "longitude": 148.9486,
        "access_type": "Recreation Area",
        "dog_friendly": True,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": WOODS_RESERVE_DOG_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Designated dog-friendly camping area along Corin Road (dogs on leash).",
    },
    {
        "name": "Blue Range Hut Campground",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.2833,
        "longitude": 148.9000,
        "access_type": "Forest Reserve",
        "dog_friendly": True,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": ACT_DOG_RULE_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Located in Uriarra Forest near Blue Range Hut.",
    },
    {
        "name": "Kowen Forest Camp",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": -35.3167,
        "longitude": 149.3000,
        "access_type": "Forest Reserve",
        "dog_friendly": True,
        "booking_url": ACT_BOOKING_HUB_URL,
        "evidence_url": ACT_DOG_RULE_URL,
        "comments": "Managed by ACT Parks and Conservation Service. Public pine plantation forest camping area.",
    },
]

CANONICAL_JBT_CAMPGROUNDS = [
    {
        "name": "Green Patch Campground",
        "state": "JBT",
        "management_type": "Parks Australia",
        "latitude": -35.1417,
        "longitude": 150.7250,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": BOODEREE_BOOKING_URL,
        "evidence_url": BOODEREE_RULES_URL,
        "comments": "Managed by Parks Australia and Wreck Bay Aboriginal Community in Jervis Bay Territory (Commonwealth). Domestic animals strictly prohibited.",
    },
    {
        "name": "Bristol Point Campground",
        "state": "JBT",
        "management_type": "Parks Australia",
        "latitude": -35.1389,
        "longitude": 150.7306,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": BOODEREE_BOOKING_URL,
        "evidence_url": BOODEREE_RULES_URL,
        "comments": "Managed by Parks Australia in Jervis Bay Territory. Walk-in tent camping. Domestic animals strictly prohibited.",
    },
    {
        "name": "Cave Beach Campground",
        "state": "JBT",
        "management_type": "Parks Australia",
        "latitude": -35.1667,
        "longitude": 150.6833,
        "access_type": "National Park",
        "dog_friendly": False,
        "booking_url": BOODEREE_BOOKING_URL,
        "evidence_url": BOODEREE_RULES_URL,
        "comments": "Managed by Parks Australia in Jervis Bay Territory. Coastal surf-side camping. Domestic animals strictly prohibited.",
    },
]


def derive_source_id(
    objectid: Optional[Any],
    name: str,
    state: str = "ACT",
) -> str:
    """
    Generate authoritative deterministic natural key for ACT or JBT site.
    """
    if state == "JBT":
        cleaned = re.sub(r"[^\w\s-]", "", name).strip().lower()
        slug = re.sub(r"[\s_]+", "-", cleaned)
        return f"JBT-PA-{slug}"

    if objectid is not None and str(objectid).strip():
        return f"ACT-PCS-{str(objectid).strip()}"

    cleaned = re.sub(r"[^\w\s-]", "", name).strip().lower()
    slug = re.sub(r"[\s_]+", "-", cleaned)
    return f"ACT-PCS-{slug}"


def build_reserve_record(attrs: Dict[str, Any], rings: List[Any]) -> Dict[str, Any]:
    """Transform an ACT Public Land Reserve feature into a canonical campsite record dict."""
    name = (attrs.get("RESERVE_NAME") or "Unnamed ACT Reserve").strip()
    objectid = attrs.get("OBJECTID")
    overlay = str(attrs.get("TERRITORY_PLAN_OVERLAY") or "").strip()
    access_type = "National Park" if "National Park" in overlay else "Nature Reserve"

    if rings and len(rings[0]) >= 3:
        poly = Polygon(rings[0])
        centroid = poly.centroid
        lat = float(centroid.y)
        lon = float(centroid.x)
    else:
        lat = 0.0
        lon = 0.0

    source_id = derive_source_id(objectid, name, state="ACT")

    # Statutory rules: Nature Conservation Act 2014 bans domestic dogs in national parks & nature reserves
    dog_friendly = False
    evidence_url = ACT_DOG_RULE_URL

    comments = f"Managed by ACT Parks and Conservation Service (PCS). Territory Plan Overlay: {overlay}."

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "ACT",
        "management_type": "ACT PCS",
        "latitude": lat,
        "longitude": lon,
        "access_type": access_type,
        "lga": None,
        "npws_branch": "Australian Capital Territory",
        "asset_comments": comments,
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: facilities not captured on reserve boundary
        "fees": None,        # Honest null: fees vary across booking engine
        "booking_url": ACT_BOOKING_HUB_URL,
        "source_id": source_id,
        "source_url": ACT_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def build_campground_record(
    name: str,
    state: str,
    management_type: str,
    latitude: float,
    longitude: float,
    dog_friendly: bool,
    access_type: str = "Campground",
    booking_url: Optional[str] = None,
    evidence_url: Optional[str] = None,
    comments: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a canonical campsite record dict for a dedicated campground."""
    source_id = derive_source_id(None, name, state=state)
    b_url = booking_url or (BOODEREE_BOOKING_URL if state == "JBT" else ACT_BOOKING_HUB_URL)
    e_url = evidence_url or (BOODEREE_RULES_URL if state == "JBT" else (WOODS_RESERVE_DOG_URL if dog_friendly else ACT_DOG_RULE_URL))
    s_url = BOODEREE_DATASET_URL if state == "JBT" else ACT_DATASET_URL

    return {
        "name": name,
        "location": f"SRID=4326;POINT({longitude} {latitude})",
        "state": state,
        "management_type": management_type,
        "latitude": latitude,
        "longitude": longitude,
        "access_type": access_type,
        "lga": None,
        "npws_branch": "Jervis Bay Territory" if state == "JBT" else "Australian Capital Territory",
        "asset_comments": comments or f"Managed by {management_type}.",
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,
        "fees": None,
        "booking_url": b_url,
        "source_id": source_id,
        "source_url": s_url,
        "evidence_url": e_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def fetch_act_features(limit: Optional[int] = None, timeout: float = 30.0) -> List[Dict[str, Any]]:
    """Fetch Public Land Reserves from ACT ArcGIS FeatureServer."""
    logger.info("Fetching ACT Public Land Reserves from FeatureServer...")
    params = {
        "where": "1=1",
        "outFields": "*",
        "outSR": "4326",
        "returnGeometry": "true",
        "f": "json",
        "resultRecordCount": limit or 1000,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.get(ACT_QUERY_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("Retrieved %d features from ACT ArcGIS service", len(features))
        return features


def upsert_act_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Upsert canonical campsites idempotently by source_id.
    Guards against overwriting human-verified records.
    """
    inserted = 0
    updated = 0
    skipped_verified = 0

    for rec in records:
        source_id = rec["source_id"]
        existing = db.query(Campsite).filter(Campsite.source_id == source_id).first()

        # Build clean kwargs without computed lat/lon properties
        campsite_data = {k: v for k, v in rec.items() if k not in ("latitude", "longitude")}

        if not existing:
            campsite = Campsite(**campsite_data)
            db.add(campsite)
            inserted += 1
        else:
            if existing.data_status == DATA_STATUS_VERIFIED:
                skipped_verified += 1
                continue

            for k, v in campsite_data.items():
                setattr(existing, k, v)
            updated += 1

    db.commit()
    logger.info("ACT/JBT Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest ACT Public Land Reserves & JBT Campgrounds.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_act_features(limit=args.limit)

    records = []
    # 1. Reserves from spatial layer
    for f in features:
        attrs = f.get("attributes", {})
        geom = f.get("geometry", {})
        rings = geom.get("rings", [])
        if rings and attrs.get("RESERVE_NAME"):
            records.append(build_reserve_record(attrs, rings))

    # 2. Canonical ACT campgrounds
    for cg in CANONICAL_ACT_CAMPGROUNDS:
        records.append(build_campground_record(**cg))

    # 3. Canonical JBT campgrounds (fixes R11)
    for jbt in CANONICAL_JBT_CAMPGROUNDS:
        records.append(build_campground_record(**jbt))

    logger.info("Built %d total ACT & JBT campsite records", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_act_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
