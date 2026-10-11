"""
Bulk ingest of Victorian State Forest recreation & camping sites from DataVic.

Source: "Recreation Sites", published by the Victorian Department of Energy,
Environment and Climate Action (DEECA) on DataVic under Creative Commons
Attribution 4.0 International (CC-BY 4.0).

Design rules:
  - Open Data Foundation: CC-BY 4.0 spatial data directly from Victorian Government GeoServer.
  - Natural key: Stable authoritative serial_no formatted as "VIC-DEECA-{serial_no}".
  - Honest nulls: Facilities not documented in source remain None (never fabricate flush toilets).
  - Statutory policy rules: Free camping statewide ($0) with no booking required and dogs welcome under control.
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
DATAVIC_DATASET_URL = "https://discover.data.vic.gov.au/dataset/recreation-sites"
DATAVIC_WFS_URL = (
    "https://opendata.maps.vic.gov.au/geoserver/wfs"
    "?service=WFS&version=2.0.0&request=GetFeature"
    "&typeName=open-data-platform:recweb_site&outputFormat=application/json"
)
DEECA_LICENCE = "CC-BY 4.0"
DEECA_ATTRIBUTION = (
    "© State Government of Victoria, Department of Energy, Environment and Climate Action. "
    "Source: DataVic 'Recreation Sites'."
)

# --- Statutory Policy Evidence ------------------------------------------------
DEECA_DOG_RULE_URL = "https://www.exploreoutdoors.vic.gov.au/activities/dog-walking"
DEECA_FREE_CAMPING_RULE_URL = "https://www.exploreoutdoors.vic.gov.au/activities/camping"


def derive_source_id(
    serial_no: Optional[str],
    name: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key.
    Uses DEECA serial_no when available, falling back to name/coordinate hash.
    """
    if serial_no and str(serial_no).strip():
        return f"VIC-DEECA-{str(serial_no).strip()}"
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"VIC-DEECA-{digest[:12]}"


def is_camping_eligible(properties: Dict[str, Any]) -> bool:
    """Check if the recreation site has camping enabled and is published."""
    camping = str(properties.get("camping") or "").strip().upper()
    published = str(properties.get("published") or "").strip().upper()
    return camping == "Y" and published == "Y"


def derive_rig_access(
    access_dsc: Optional[str] = None,
    campervanning: Optional[str] = None,
    campervan_type: Optional[str] = None,
) -> List[str]:
    """Derive vehicle rig access conservatively from authoritative description."""
    rigs = ["TENT"]
    text = (access_dsc or "").lower()
    c_type = (campervan_type or "").upper()
    c_van = str(campervanning or "").upper() == "Y"

    is_strict_4wd = "4wd" in text and ("only" in text or "strictly" in text or "high clearance" in text)

    if is_strict_4wd:
        rigs.append("4WD")
    else:
        rigs.append("CAR")
        if "camper trailer" in text or "CAMPER TRAILER" in c_type or c_van:
            rigs.append("CAMPER_TRAILER")
        if "caravan" in text or "CARAVAN" in c_type:
            rigs.append("CARAVAN")
        if "4wd" in text:
            rigs.append("4WD")

    return rigs


def derive_facilities(properties: Dict[str, Any]) -> Dict[str, Any]:
    """
    Derive facilities honestly.
    Only assert campfires/toilets when positively documented in source attributes.
    """
    facilities: Dict[str, Any] = {
        "toilets": None,
        "showers": None,
        "drinking_water": None,
        "campfires": None,
    }

    comments = (properties.get("comments") or "").lower()
    camping_c = (properties.get("camping_c") or "").lower()
    bbq_pit = properties.get("bbq_pit")
    bbq_wood = properties.get("bbq_wood")

    if bbq_pit or bbq_wood or "campfire" in comments or "fire pit" in comments or "fire pit" in camping_c:
        facilities["campfires"] = True

    if "toilet" in comments or "toilet" in camping_c or properties.get("pct_aframe") or properties.get("pct_pedest"):
        facilities["toilets"] = True

    return facilities


def build_record(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a DataVic GeoServer feature into a canonical campsite record dict."""
    props = feature.get("properties", {})
    geom = feature.get("geometry", {})
    coords = geom.get("coordinates", [0.0, 0.0])
    lon, lat = float(coords[0]), float(coords[1])

    name = (props.get("name") or props.get("label") or "Unnamed Recreation Site").strip()
    serial_no = props.get("serial_no")
    access_dsc = props.get("access_dsc")
    campervanning = props.get("campervanning")
    campervan_type = props.get("campervan_type")

    source_id = derive_source_id(serial_no, name, lat, lon)
    rig_access = derive_rig_access(access_dsc, campervanning, campervan_type)
    facilities = derive_facilities(props)

    closure_desc = props.get("clos_desc")
    closure_stat = props.get("clos_stat")
    comments = props.get("comments") or ""
    if closure_stat and closure_stat != "NONE":
        comments = f"[{closure_stat}: {closure_desc or 'Notice'}] {comments}".strip()

    return {
        "name": name,
        "location": f"SRID=4326;POINT({lon} {lat})",
        "state": "VIC",
        "management_type": "DEECA State Forests",
        "latitude": lat,
        "longitude": lon,
        "access_type": props.get("site_class") or "State Forest",
        "lga": props.get("maintained_by"),
        "npws_branch": props.get("maintained_by"),
        "asset_comments": comments or None,
        "fire_district": None,  # Mapped via CFA district boundaries in WP-8
        "dog_friendly": True,
        "rig_access": rig_access,
        "facilities": facilities,
        "fees": "$0 (Free)",
        "booking_url": DEECA_FREE_CAMPING_RULE_URL,
        "source_id": source_id,
        "source_url": DATAVIC_DATASET_URL,
        "evidence_url": DEECA_DOG_RULE_URL,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.utcnow(),
    }


def fetch_wfs_features(timeout: float = 30.0) -> List[Dict[str, Any]]:
    """Fetch all features from the DataVic WFS GeoServer endpoint."""
    logger.info("Fetching DEECA recreation sites from DataVic WFS...")
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(DATAVIC_WFS_URL)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        logger.info("Retrieved %d raw features from DataVic WFS", len(features))
        return features


def upsert_vic_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("VIC Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Victorian State Forest camping sites from DataVic.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_wfs_features()
    eligible = [f for f in features if is_camping_eligible(f.get("properties", {}))]
    logger.info("Found %d camping-eligible sites out of %d features", len(eligible), len(features))

    records = [build_record(f) for f in eligible]

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_vic_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
