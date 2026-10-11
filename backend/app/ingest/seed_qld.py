"""
Bulk ingest of Queensland National Parks and Forests from official Queensland Spatial Data.

Source: "Protected areas and forests of Queensland" (Layer 10),
published by the State of Queensland (Department of Environment and Science)
under Creative Commons Attribution 4.0 International (CC-BY 4.0).

Design rules:
  - Open Data Foundation: CC-BY 4.0 spatial data directly from Queensland Government spatial-gis.
  - Natural key: Authoritative system internal code formatted as "QLD-QPWS-{sysintcode}".
  - Honest nulls: Facilities stay None (never guess flush toilets).
  - Statutory policy rules: Flat $7.75/night/person QPWS fee, mandatory advance permit, dog ban in NPs.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campsite import (
    Campsite,
    DATA_STATUS_RULE_DERIVED,
    DATA_STATUS_VERIFIED,
)

logger = logging.getLogger(__name__)

# --- Provenance & Metadata ---------------------------------------------------
QLD_DATASET_URL = "https://www.data.qld.gov.au/dataset/parks-and-forests-of-queensland"
QLD_ARCGIS_QUERY_URL = (
    "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Environment/"
    "ParksTerrestrialProtectedAreas/MapServer/10/query"
)
QPWS_LICENCE = "CC-BY 4.0"
QPWS_ATTRIBUTION = (
    "© State of Queensland (Department of Environment and Science). "
    "Source: Protected Areas and Forests of Queensland."
)

# --- Statutory Policy Evidence ------------------------------------------------
QPWS_DOG_RULE_URL = "https://parks.des.qld.gov.au/plan-your-visit/rules"
QPWS_BOOKING_HUB_URL = "https://parks.des.qld.gov.au/camping"
QPWS_FEE_URL = "https://parks.des.qld.gov.au/camping/fees"


def derive_source_id(
    sysintcode: Optional[str],
    name: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key.
    Uses QPWS sysintcode when available, falling back to name/coordinate hash.
    """
    if sysintcode and str(sysintcode).strip():
        return f"QLD-QPWS-{str(sysintcode).strip()}"
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"QLD-QPWS-{digest[:12]}"


def build_record(attrs: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a Queensland spatial feature attribute dict into a canonical campsite record dict."""
    name = (attrs.get("estatename") or attrs.get("nameabbrev") or "Unnamed Queensland Park").strip()
    sysintcode = attrs.get("sysintcode")
    lat = float(attrs.get("latitude") or 0.0)
    lon = float(attrs.get("longitude") or 0.0)

    esttype = str(attrs.get("esttype") or "").strip().upper()
    access_type = "National Park" if esttype == "NP" else ("Conservation Park" if esttype == "CP" else "State Forest")
    qpwsreg = attrs.get("qpwsreg")
    legislated = attrs.get("legislated")

    source_id = derive_source_id(sysintcode, name, lat, lon)

    # Statutory rules: Nature Conservation Act 1992 bans domestic dogs in national parks
    dog_friendly = False if esttype == "NP" else None
    evidence_url = QPWS_DOG_RULE_URL if dog_friendly is False else QPWS_BOOKING_HUB_URL

    comments = f"Gazetted under {legislated or 'Nature Conservation Act'}. QPWS Region: {qpwsreg or 'Queensland'}."

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "QLD",
        "management_type": "QPWS",
        "latitude": lat,
        "longitude": lon,
        "access_type": access_type,
        "lga": qpwsreg,
        "npws_branch": qpwsreg,
        "asset_comments": comments,
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: facilities absent from spatial boundary layer
        "fees": "$7.75/person/night",
        "booking_url": QPWS_BOOKING_HUB_URL,
        "source_id": source_id,
        "source_url": QLD_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.utcnow(),
    }


def fetch_qld_features(limit: Optional[int] = None, timeout: float = 30.0) -> List[Dict[str, Any]]:
    """Fetch protected areas from the Queensland ArcGIS REST query endpoint."""
    logger.info("Fetching Queensland protected areas from ArcGIS REST...")
    params = {
        "where": "1=1",
        "outFields": "objectid,sysintcode,estatename,nameabbrev,esttype,legislated,qpwsreg,latitude,longitude",
        "returnGeometry": "false",
        "f": "json",
        "resultRecordCount": limit or 1000,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.get(QLD_ARCGIS_QUERY_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("Retrieved %d features from Queensland spatial ArcGIS service", len(features))
        return [f.get("attributes", {}) for f in features if f.get("attributes")]


def upsert_qld_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("QLD Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Queensland National Parks and Forests from spatial-gis.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_qld_features(limit=args.limit)
    records = [build_record(attrs) for attrs in features if attrs.get("latitude") and attrs.get("longitude")]
    logger.info("Built %d Queensland campsite records with valid coordinates", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_qld_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
