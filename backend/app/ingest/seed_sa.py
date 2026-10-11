"""
Bulk ingest of South Australia National Parks & Conservation Reserves from official DEW spatial data.

Source: "Conservation Reserve Boundaries",
published by the State of South Australia (Department for Environment and Water - DEW)
under Creative Commons Attribution 4.0 Australia (CC-BY 4.0 AU).

Design rules:
  - Open Data Foundation: Authoritative spatial polygon layer from South Australia DEW.
  - Natural key: Authoritative DEW PARK_ID formatted as "SA-DEW-{park_id}".
  - Honest nulls: Facilities stay None (never guess toilets or amenities).
  - Statutory policy rules: Domestic pets strictly banned in SA National Parks and
    Conservation Parks under the National Parks and Wildlife Act 1972.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from shapely.geometry import shape
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campsite import (
    Campsite,
    DATA_STATUS_RULE_DERIVED,
    DATA_STATUS_VERIFIED,
)

logger = logging.getLogger(__name__)

# --- Provenance & Metadata ---------------------------------------------------
SA_DATASET_URL = "https://data.sa.gov.au/data/dataset/conservation-reserve-boundaries"
SA_GEOJSON_ZIP_URL = (
    "https://www.waterconnect.sa.gov.au/Content/Downloads/DEWNR/CONSERVATION_NpwsaReserves_geojson.zip"
)
DEW_LICENCE = "CC-BY 4.0 AU"
DEW_ATTRIBUTION = (
    "© State of South Australia (Department for Environment and Water). "
    "Source: Conservation Reserve Boundaries."
)

# --- Statutory Policy Evidence ------------------------------------------------
SA_DOG_RULE_URL = "https://www.parks.sa.gov.au/know-before-you-go/pets-in-parks"
SA_BOOKING_HUB_URL = "https://www.parks.sa.gov.au/booking"

RESTYPE_MAP = {
    "NP": "National Park",
    "CP": "Conservation Park",
    "GR": "Game Reserve",
    "WPA": "Wilderness Protection Area",
    "RP": "Recreation Park",
    "CPK": "Conservation Reserve",
}


def derive_source_id(
    park_id: Optional[Any],
    resname: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key.
    Uses DEW PARK_ID when available, falling back to name/coordinate hash.
    """
    if park_id is not None and str(park_id).strip():
        return f"SA-DEW-{str(park_id).strip()}"
    digest = hashlib.sha1(f"{resname.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"SA-DEW-{digest[:12]}"


def build_record(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a South Australia DEW GeoJSON feature into a canonical campsite record dict."""
    props = feature.get("properties", {})
    name = (props.get("RESNAMETYP") or props.get("RESNAME") or "Unnamed SA Park").strip()
    park_id = props.get("PARK_ID")
    restype = str(props.get("RESTYPE") or "").strip().upper()
    access_type = RESTYPE_MAP.get(restype, "Conservation Reserve")

    geom = shape(feature["geometry"])
    centroid = geom.centroid
    lat = float(centroid.y)
    lon = float(centroid.x)

    source_id = derive_source_id(park_id, name, lat, lon)

    # Statutory rules: National Parks and Wildlife Act 1972 prohibits domestic dogs in reserves
    dog_friendly = False
    evidence_url = SA_DOG_RULE_URL

    unique_id = props.get("UNIQUEID") or ""
    region_id = props.get("REGION_ID")
    comments = f"Managed by National Parks and Wildlife Service South Australia (NPWSA / DEW). Gazetted Reserve ID: {unique_id}. Region: {region_id}."

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "SA",
        "management_type": "NPWSA",
        "latitude": lat,
        "longitude": lon,
        "access_type": access_type,
        "lga": None,
        "npws_branch": f"Region {region_id}" if region_id else "South Australia",
        "asset_comments": comments,
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: amenity classes not verified on spatial boundary layer
        "fees": None,        # Honest null: fees vary across NPWSA booking system
        "booking_url": SA_BOOKING_HUB_URL,
        "source_id": source_id,
        "source_url": SA_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def fetch_sa_features(limit: Optional[int] = None, timeout: float = 45.0) -> List[Dict[str, Any]]:
    """Fetch conservation reserves GeoJSON from South Australia WaterConnect / DEW download portal."""
    logger.info("Downloading South Australia Conservation Reserve Boundaries zip...")
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(SA_GEOJSON_ZIP_URL, follow_redirects=True)
        resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        target_name = None
        for fname in z.namelist():
            if fname.endswith("GDA2020.geojson"):
                target_name = fname
                break
            elif fname.endswith(".geojson"):
                target_name = fname

        if not target_name:
            raise FileNotFoundError("No GeoJSON file found in SA reserves zip")

        logger.info("Extracting %s from zip...", target_name)
        data = json.loads(z.read(target_name))
        features = data.get("features", [])
        logger.info("Retrieved %d features from South Australia DEW dataset", len(features))
        if limit:
            features = features[:limit]
        return features


def upsert_sa_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("SA Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest South Australia National Parks & Conservation Reserves.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_sa_features(limit=args.limit)
    records = [build_record(f) for f in features if f.get("geometry")]
    logger.info("Built %d South Australia campsite records with valid geometry", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_sa_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
