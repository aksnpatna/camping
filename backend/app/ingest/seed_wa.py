"""
Bulk ingest of Western Australia Campgrounds & National Parks from official DBCA spatial layers.

Source: Department of Biodiversity, Conservation and Attractions (DBCA)
Creative Commons Attribution 4.0 International (CC-BY 4.0).
Dataset: DBCA Campgrounds & Explore Parks WA FeatureServer.

Design rules:
  - Open Data Foundation: Authoritative spatial data from DBCA.
  - Natural key: Authoritative entity ID formatted as "WA-DBCA-{entity_id}".
  - Honest nulls: Facilities stay None (never fabricate toilets/showers).
  - Statutory policy rules: Domestic pets strictly banned in DBCA National Parks
    and nature reserves due to intensive 1080 poison baiting to protect endangered marsupials.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campsite import (
    Campsite,
    DATA_STATUS_RULE_DERIVED,
    DATA_STATUS_VERIFIED,
)

logger = logging.getLogger(__name__)

# --- Provenance & Metadata ---------------------------------------------------
DBCA_DATASET_URL = (
    "https://services-ap1.arcgis.com/q0W772RwyxBPvFDi/arcgis/rest/services/DBCA_Campgrounds/FeatureServer/0"
)
DBCA_QUERY_URL = f"{DBCA_DATASET_URL}/query"
DBCA_LICENCE = "CC-BY 4.0"
DBCA_ATTRIBUTION = (
    "© State of Western Australia (Department of Biodiversity, Conservation and Attractions). "
    "Source: DBCA Explore Parks & Campgrounds."
)

# --- Statutory Policy Evidence ------------------------------------------------
DBCA_DOG_RULE_URL = "https://exploreparks.dbca.wa.gov.au/know-before-you-go/pets-parks"
DBCA_PARKSTAY_HUB_URL = "https://parkstay.dbca.wa.gov.au/"


def derive_source_id(
    entity_id: Optional[Any],
    name: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key.
    Uses DBCA Explore Parks entity_id when available, falling back to name/coordinate hash.
    """
    if entity_id is not None and str(entity_id).strip():
        return f"WA-DBCA-{str(entity_id).strip()}"
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"WA-DBCA-{digest[:12]}"


def build_record(attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a Western Australia DBCA feature attribute dict into a canonical campsite record dict."""
    name = (attrs.get("name") or "Unnamed WA Campground").strip()
    entity_id = attrs.get("entity_id")
    lat = float(attrs.get("lat") or attrs.get("latitude") or 0.0)
    lon = float(attrs.get("lon") or attrs.get("longitude") or 0.0)

    url = attrs.get("url") or (f"https://exploreparks.dbca.wa.gov.au/node/{entity_id}" if entity_id else DBCA_PARKSTAY_HUB_URL)
    source_id = derive_source_id(entity_id, name, lat, lon)

    # Statutory rules: 1080 poison baiting across WA national parks prohibits domestic animals
    dog_friendly = False
    evidence_url = DBCA_DOG_RULE_URL

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "WA",
        "management_type": "DBCA",
        "latitude": lat,
        "longitude": lon,
        "access_type": "National Park",
        "lga": None,
        "npws_branch": "Western Australia",
        "asset_comments": "Managed by Department of Biodiversity, Conservation and Attractions (DBCA). Pets prohibited due to 1080 baiting.",
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: amenity classes not verified on spatial feature node
        "fees": None,        # Honest null: fees vary by service tier ($11-$15 basic/serviced)
        "booking_url": url,
        "source_id": source_id,
        "source_url": DBCA_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def fetch_wa_features(limit: Optional[int] = None, timeout: float = 30.0) -> List[Dict[str, Any]]:
    """Fetch campgrounds from the Western Australia DBCA ArcGIS REST query endpoint."""
    logger.info("Fetching Western Australia campgrounds from DBCA ArcGIS REST...")
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "false",
        "f": "json",
        "resultRecordCount": limit or 1000,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.get(DBCA_QUERY_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("Retrieved %d features from DBCA ArcGIS service", len(features))
        return [f.get("attributes", {}) for f in features if f.get("attributes")]


def upsert_wa_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("WA Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Western Australia DBCA Campgrounds.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_wa_features(limit=args.limit)
    records = [build_record(attrs) for attrs in features if (attrs.get("lat") or attrs.get("latitude")) and (attrs.get("lon") or attrs.get("longitude"))]
    logger.info("Built %d Western Australia campsite records with valid coordinates", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_wa_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
