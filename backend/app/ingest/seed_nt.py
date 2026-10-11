"""
Bulk ingest of Northern Territory Parks and Reserves from official DEPWS spatial data.

Source: "NT Parks and Reserves",
published by the Northern Territory Government (Department of Environment, Parks and Water Security - DEPWS)
under Creative Commons Attribution 4.0 (CC-BY 4.0).

Design rules:
  - Open Data Foundation: Authoritative spatial layer from Data NT / DEPWS.
  - Natural key: Authoritative slug formatted as "NT-DEPWS-{slug}".
  - Honest nulls: Facilities stay None (never guess toilets or Category A/B tier).
  - Statutory policy rules: Domestic pets banned in NT national parks and nature reserves;
    online booking mandatory via parkbookings.nt.gov.au; Crocodile safety advisory applied.
  - Idempotent: Never overwrites human-verified records.
"""

import argparse
import hashlib
import io
import logging
import re
import xml.etree.ElementTree as ET
import zipfile
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
NT_DATASET_URL = (
    "https://data.nt.gov.au/dataset/natural-resource-maps---nt-parks-and-reserves"
)
NT_ZIP_DOWNLOAD_URL = (
    "https://ftp-dlrm.nt.gov.au/main.html?download&weblink=d4ceb3403ce21662e3a32efbf9df0018&realfilename=NT_Parks_and_Reserves.zip"
)
NT_LICENCE = "CC-BY 4.0"
NT_ATTRIBUTION = (
    "© Northern Territory Government (Department of Environment, Parks and Water Security). "
    "Source: NT Parks and Reserves."
)

# --- Statutory Policy Evidence ------------------------------------------------
NT_DOG_RULE_URL = "https://nt.gov.au/parks/find-a-park/rules-for-pets"
NT_BOOKING_HUB_URL = "https://parkbookings.nt.gov.au/"
NT_FEE_SCHEDULE_URL = "https://nt.gov.au/parks/camping/camping-fees"


def derive_source_id(
    name: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Generate authoritative deterministic natural key from park name slug.
    """
    cleaned = re.sub(r"[^\w\s-]", "", name).strip().lower()
    slug = re.sub(r"[\s_]+", "-", cleaned)
    if slug:
        return f"NT-DEPWS-{slug}"
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"NT-DEPWS-{digest[:12]}"


def build_record(
    name: str,
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """Transform a Northern Territory park name and coordinates into a canonical campsite record dict."""
    clean_name = name.strip()
    source_id = derive_source_id(clean_name, latitude, longitude)

    access_type = "National Park" if "National Park" in clean_name else "Conservation Reserve"

    # Statutory rules: Pets banned in NT national parks under Parks and Wildlife Commission Act
    dog_friendly = False
    evidence_url = NT_DOG_RULE_URL

    comments = (
        "Managed by Parks and Wildlife Commission of the NT (PWCNT / DEPWS). "
        "Online booking mandatory via parkbookings.nt.gov.au. "
        "Be Crocwise: Saltwater and freshwater crocodiles inhabit Top End waterways."
    )

    return {
        "name": clean_name,
        "location": f"SRID=4326;POINT({longitude} {latitude})",
        "state": "NT",
        "management_type": "PWCNT",
        "latitude": latitude,
        "longitude": longitude,
        "access_type": access_type,
        "lga": None,
        "npws_branch": "Northern Territory",
        "asset_comments": comments,
        "fire_district": None,
        "dog_friendly": dog_friendly,
        "rig_access": ["TENT", "CAR"],
        "facilities": None,  # Honest null: Category A/B facilities not determined on boundary node
        "fees": None,        # Honest null: fees vary by Category A ($15) vs Category B ($10) tier
        "booking_url": NT_BOOKING_HUB_URL,
        "source_id": source_id,
        "source_url": NT_DATASET_URL,
        "evidence_url": evidence_url,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.now(timezone.utc),
    }


def fetch_nt_features(limit: Optional[int] = None, timeout: float = 45.0) -> List[Dict[str, Any]]:
    """Fetch park placemarks from Northern Territory DLRM/DEPWS download portal."""
    logger.info("Downloading NT Parks and Reserves zip...")
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(NT_ZIP_DOWNLOAD_URL, follow_redirects=True)
        resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        kmz_bytes = z.read("Data/KML/NT Parks and Reserves.kmz")

    with zipfile.ZipFile(io.BytesIO(kmz_bytes)) as z_kmz:
        kml_content = z_kmz.read("doc.kml")

    root = ET.fromstring(kml_content)
    ns = {"kml": "http://www.opengis.net/kml/2.2"}

    parks: Dict[str, Dict[str, Any]] = {}
    for pm in root.findall(".//kml:Placemark", ns):
        name_el = pm.find("{http://www.opengis.net/kml/2.2}name")
        name = name_el.text.strip() if name_el is not None and name_el.text else None
        if not name:
            continue
        coords_el = pm.find(".//kml:coordinates", ns)
        if coords_el is not None and coords_el.text:
            parts = coords_el.text.strip().split(",")
            if len(parts) >= 2:
                lon = float(parts[0])
                lat = float(parts[1])
                if name not in parks:
                    parks[name] = {"name": name, "latitude": lat, "longitude": lon}

    records_list = list(parks.values())
    logger.info("Parsed %d unique NT parks with coordinates", len(records_list))
    if limit:
        records_list = records_list[:limit]
    return records_list


def upsert_nt_records(db: Session, records: List[Dict[str, Any]]) -> Dict[str, int]:
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
    logger.info("NT Ingest complete: %d inserted, %d updated, %d skipped", inserted, updated, skipped_verified)
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped_verified": skipped_verified,
        "total": len(records),
    }


def main():
    parser = argparse.ArgumentParser(description="Ingest Northern Territory Parks & Reserves.")
    parser.add_argument("--dry-run", action="store_true", help="Parse features without saving to database.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of features to fetch.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    features = fetch_nt_features(limit=args.limit)
    records = [build_record(f["name"], f["latitude"], f["longitude"]) for f in features]
    logger.info("Built %d Northern Territory campsite records with valid coordinates", len(records))

    if args.dry_run:
        print(f"Dry run complete. Built {len(records)} records.")
        if records:
            print("Sample record:", records[0])
        return

    with SessionLocal() as db:
        stats = upsert_nt_records(db, records)
        print("Upsert result:", stats)


if __name__ == "__main__":
    main()
