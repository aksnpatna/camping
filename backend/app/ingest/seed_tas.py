"""
Bulk ingest of Tasmania Camping Areas from The LIST spatial services.

Source: "Topography and Relief - Camping Area (Layer 79)",
published by the State of Tasmania (Department of Natural Resources and Environment Tasmania - NRE Tas)
via Land Information System Tasmania (The LIST) under Creative Commons Attribution 4.0 (CC-BY 4.0).

Design rules:
  - Open Data Foundation: Authoritative spatial polygon layer from The LIST.
  - Natural key: Authoritative infrastructure ID formatted as "TAS-LIST-{infra_id}".
  - Honest nulls: Facilities stay None (never guess toilets or fire pits).
  - Statutory policy rules: Domestic pets banned in National Parks under National Parks and
    Reserves Management Act 2002; Tasmanian National Parks Pass required for park entry.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import logging
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
TAS_DATASET_URL = (
    "https://services.thelist.tas.gov.au/arcgis/rest/services/Public/TopographyAndRelief/MapServer/79"
)
TAS_QUERY_URL = f"{TAS_DATASET_URL}/query"
TAS_LICENCE = "CC-BY 4.0"
TAS_ATTRIBUTION = (
    "© State of Tasmania (Department of Natural Resources and Environment Tasmania). "
    "Source: The LIST (Land Information System Tasmania) Topography and Relief."
)

# --- Statutory Policy Evidence ------------------------------------------------
TAS_DOG_RULE_URL = "https://parks.tas.gov.au/plan-your-visit/parks-pass/dogs-in-parks"
TAS_PARKS_PASS_URL = "https://parks.tas.gov.au/passes-and-entry"


def derive_source_id(
    infra_id: Optional[Any],
    name: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key.
    Uses The LIST INFRA_ID when available, falling back to name/coordinate hash.
    """
    if infra_id is not None and str(infra_id).strip():
        return f"TAS-LIST-{str(infra_id).strip()}"
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"TAS-LIST-{digest[:12]}"


def build_record(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a Tasmania The LIST feature into a canonical campsite record dict."""
    attrs = feature.get("attributes", {})
    name = (attrs.get("NAME") or "Unnamed Tasmania Campsite").strip()
    infra_id = attrs.get("INFRA_ID")
    nom_reg_no = attrs.get("NOM_REG_NO")

    # Compute centroid from geometry rings (EPSG:4326)
    rings = feature.get("geometry", {}).get("rings", [])
    if rings and len(rings[0]) >= 3:
        poly = Polygon(rings[0])
        centroid = poly.centroid
        lat = float(centroid.y)
        lon = float(centroid.x)
    else:
        lat = 0.0
        lon = 0.0

    source_id = derive_source_id(infra_id, name, lat, lon)

    # Statutory rules: National Parks and Reserves Management Act 2002 bans domestic dogs in national parks
    dog_friendly = False
    evidence_url = TAS_DOG_RULE_URL

    comments = (
        f"Managed by Tasmania Parks and Wildlife Service (PWS) / NRE Tas. "
        f"The LIST Infrastructure ID: {infra_id}. Register No: {nom_reg_no or 'N/A'}. "
        f"Tasmanian National Parks Pass required for entry."
    )

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "TAS",
        "management_type": "PWS",
        "latitude": lat,
        "longitude": lon,
        "access_type": "Camping Area",
        "lga": None,
        "npws_branch": "Tasmania",
        "asset_comments": comments,
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: amenity details not provided on polygon boundary
        "fees": None,        # Honest null: fees vary (parks pass required for entry)
        "booking_url": TAS_PARKS_PASS_URL,
        "source_id": source_id,
        "source_url": TAS_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def fetch_tas_features(limit: Optional[int] = None, timeout: float = 30.0) -> List[Dict[str, Any]]:
    """Fetch named camping areas from Tasmania The LIST ArcGIS REST query endpoint."""
    logger.info("Fetching Tasmania camping areas from The LIST REST endpoint...")
    params = {
        "where": "NAME IS NOT NULL",
        "outFields": "*",
        "outSR": "4326",
        "returnGeometry": "true",
        "f": "json",
        "resultRecordCount": limit or 1000,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.get(TAS_QUERY_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("Retrieved %d features from The LIST ArcGIS service", len(features))
        return features


def upsert_tas_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("TAS Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Tasmania The LIST Camping Areas.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_tas_features(limit=args.limit)
    records = [
        build_record(f)
        for f in features
        if f.get("geometry", {}).get("rings") and f.get("attributes", {}).get("NAME")
    ]
    logger.info("Built %d Tasmania campsite records with valid geometry", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_tas_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
