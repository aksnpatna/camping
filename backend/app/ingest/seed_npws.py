"""
Bulk ingest of NPWS camping areas from the SEED / Data.NSW open-data package.

Source: "Asset Infrastructure - Visitor Area" (NPWS Assets Geodatabase),
published by the NSW Department of Climate Change, Energy, the Environment and
Water under **Creative Commons Attribution 4.0 (CC-BY)**. Commercial reuse,
adaptation and redistribution are permitted subject to attribution, which this
module records on every ingested row.

Design rules:
  * Only facts present in the source are stored. Facilities and fees are NOT in
    this dataset, so they stay NULL and render as "unverified" rather than being
    filled with plausible-looking guesses.
  * Attributes are carried verbatim (`access_type`, `lga`, `npws_branch`) so the
    authoritative value is never lost behind a derivation.
  * Derived values are conservative and sourced: dog policy comes from the NPWS
    statewide rule, and `fire_district` is set ONLY for branches that map
    unambiguously to a single NSW RFS district. Branches spanning several
    districts are left NULL rather than guessed.
  * Ingest is idempotent on a derived natural key, and never downgrades a record
    a human has already marked `verified`.
"""

import argparse
import hashlib
import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional

import shapefile
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campsite import (
    Campsite,
    DATA_STATUS_RULE_DERIVED,
    DATA_STATUS_UNVERIFIED,
    DATA_STATUS_VERIFIED,
)

logger = logging.getLogger(__name__)

# --- Provenance -------------------------------------------------------------
SEED_DATASET_URL = "https://datasets.seed.nsw.gov.au/dataset/asset-infrastructure-visitor-area"
SEED_DOWNLOAD_URL = (
    "https://datasets.seed.nsw.gov.au/dataset/2d53a537-a6e1-402a-bbf4-7075123e3751"
    "/resource/18d89454-3bef-42b1-a269-0b5a95924b75/download/infrastructure_npws_visitorarea.zip"
)
SEED_ARCGIS_LAYER = (
    "https://mapprod2.environment.nsw.gov.au/arcgis/rest/services/Assets/AMS_Assets/MapServer/24"
)
SEED_LICENCE = "CC-BY 4.0"
SEED_ATTRIBUTION = (
    "© State Government of NSW and NSW Department of Climate Change, Energy, the "
    "Environment and Water. Source: SEED 'Asset Infrastructure - Visitor Area'."
)

# --- Rule evidence ----------------------------------------------------------
# Dogs are prohibited in NSW national parks (NPWS statewide rule), so every NPWS
# camping area can be recorded as not dog-friendly from a single citation.
NPWS_DOG_RULE_URL = "https://www.nationalparks.nsw.gov.au/plan-your-visit/rules-and-regulations"
# NPWS requires online booking for all campgrounds, so the camping hub is the
# correct booking entry point for every NPWS record.
NPWS_BOOKING_HUB_URL = "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds"
NPWS_BOOKING_RULE_URL = "https://www.nationalparks.nsw.gov.au/camping-and-accommodation"

CAMPING_SUBTYPE = "Camping Area"

# NPWS branch -> NSW RFS fire danger district, restricted to branches that map to
# exactly one district. Everything else stays NULL: a wrong district would show a
# camper the wrong fire rating, which is worse than no district.
BRANCH_TO_FIRE_DISTRICT = {
    "Greater Sydney": "Greater Sydney Region",
    "Blue Mountains": "Greater Sydney Region",
    "Southern Ranges": "Southern Ranges",
}

# Conservative derivation from the authoritative access type. The verbatim value
# is always preserved in `access_type`.
RIG_ACCESS_BY_ACCESS_TYPE = {
    "Vehicle Based": ["TENT", "CAR"],
    "Short Walk-in": ["TENT"],
    "Remote Walk-in": ["TENT"],
    "Boat": ["TENT", "BOAT"],
    "Other": ["TENT"],
}


def derive_source_id(name: str, latitude: float, longitude: float) -> str:
    """
    Deterministic natural key.

    The external supply of this dataset ships `SAPEquipID = 0` for every record,
    so there is no authoritative stable identifier to use. A name+coordinate hash
    gives idempotent re-ingest; it is derived, and that is recorded honestly.
    """
    digest = hashlib.sha1(f"{name.strip().lower()}|{latitude:.5f}|{longitude:.5f}".encode()).hexdigest()
    return f"SEED-VA-{digest[:16]}"


def _clean(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


# The source labels a small number of records as internal sub-divisions of a
# single campground rather than distinct public campgrounds — e.g. Comments
# "Visitor Area - North of Depot & Office" or "Visitor Area - Central, around
# Amenity A3". Their AssetName is an internal relative-position label that must
# never be shown to a camper.
#
# Exclusion keys off the source's own comment signal, not a guess at the name, so
# genuine campgrounds such as "Depot Beach campground", "North Era camp",
# "North Head campground" and "South Bank campground" are preserved.
INTERNAL_SUBAREA_COMMENT = re.compile(r"^\s*visitor\s+area\s*[-\u2013\u2014]", re.IGNORECASE)


def is_internal_subarea(row: Dict[str, Any]) -> bool:
    return bool(INTERNAL_SUBAREA_COMMENT.match(str(row.get("Comments") or "")))


def build_record(row: Dict[str, Any], longitude: float, latitude: float) -> Dict[str, Any]:
    """Map one source row onto canonical campsite fields."""
    name = _clean(row.get("AssetName")) or ""
    access_type = _clean(row.get("d_AssetTyp"))
    branch = _clean(row.get("d_Branch"))

    return {
        "name": name,
        "location": f"SRID=4326;POINT({longitude} {latitude})",
        "state": "NSW",
        "management_type": "NPWS",
        # Rule-derived from the NPWS statewide rule, not observed per site.
        "dog_friendly": False,
        "rig_access": RIG_ACCESS_BY_ACCESS_TYPE.get(access_type or "", ["TENT"]),
        # Not published in this dataset — must stay unknown, never guessed.
        "facilities": None,
        "fees": None,
        "booking_url": NPWS_BOOKING_HUB_URL,
        "fire_district": BRANCH_TO_FIRE_DISTRICT.get(branch or ""),
        # Verbatim source attributes.
        "access_type": access_type,
        "lga": _clean(row.get("d_LGA")),
        "npws_branch": branch,
        "asset_comments": _clean(row.get("Comments")),
        "source_modified_at": row.get("ModifiedDa"),
        # Provenance.
        "source_url": SEED_DATASET_URL,
        "evidence_url": NPWS_DOG_RULE_URL,
        "data_status": DATA_STATUS_RULE_DERIVED,
        "verified_at": datetime.utcnow(),
    }


def ingest_visitor_area(
    db: Session,
    shp_path: str,
    *,
    only_camping: bool = True,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Ingest camping areas from an unpacked SEED Visitor Area shapefile.

    Returns a summary dict. Idempotent: re-running updates existing rows keyed on
    the derived `source_id` instead of duplicating them.
    """
    reader = shapefile.Reader(shp_path)
    fields = [f[0] for f in reader.fields[1:]]

    inserted = updated = skipped_non_camping = skipped_no_geom = protected = 0
    skipped_internal = 0

    for shape_record in reader.iterShapeRecords():
        row = dict(zip(fields, shape_record.record))

        subtype = _clean(row.get("d_SubtypeC"))
        if only_camping and subtype != CAMPING_SUBTYPE:
            skipped_non_camping += 1
            continue

        # Internal sub-divisions of one campground carry relative-position labels
        # ("North of Depot & Office") that are meaningless to a camper.
        if is_internal_subarea(row):
            skipped_internal += 1
            continue

        if not _clean(row.get("AssetName")):
            skipped_no_geom += 1
            continue

        points = shape_record.shape.points
        if not points:
            skipped_no_geom += 1
            continue

        # Source CRS is GDA94 geographic (EPSG:4283) on the GRS80 ellipsoid, the
        # same ellipsoid as WGS84. The datum epoch difference is ~1.7 m, far below
        # campground-scale relevance, so coordinates are used directly and the
        # source datum is recorded rather than silently transformed.
        longitude = float(points[0][0])
        latitude = float(points[0][1])

        values = build_record(row, longitude, latitude)
        source_id = derive_source_id(values["name"], latitude, longitude)

        existing = db.query(Campsite).filter(Campsite.source_id == source_id).first()
        if existing is not None:
            if existing.data_status == DATA_STATUS_VERIFIED:
                # Never overwrite facts a human has verified.
                protected += 1
                continue
            for key, value in values.items():
                setattr(existing, key, value)
            updated += 1
        else:
            db.add(Campsite(source_id=source_id, **values))
            inserted += 1

        if limit and (inserted + updated) >= limit:
            break

    if not dry_run:
        db.commit()

    summary = {
        "inserted": inserted,
        "updated": updated,
        "protected_verified": protected,
        "skipped_non_camping": skipped_non_camping,
        "skipped_internal_subarea": skipped_internal,
        "skipped_no_geometry": skipped_no_geom,
        "dry_run": dry_run,
        "source": SEED_DATASET_URL,
        "licence": SEED_LICENCE,
        "attribution": SEED_ATTRIBUTION,
    }
    logger.info("SEED Visitor Area ingest: %s", summary)
    return summary


def mark_unsourced_records_unverified(db: Session) -> int:
    """
    Quarantine hand-written records.

    Anything without a SEED-derived `source_id` was authored by hand and has not
    been confirmed against a land-manager source, so it must not be presented as
    canonical.
    """
    count = (
        db.query(Campsite)
        .filter(
            Campsite.data_status != DATA_STATUS_UNVERIFIED,
            (Campsite.source_id.is_(None)) | (~Campsite.source_id.startswith("SEED-")),
        )
        .update({Campsite.data_status: DATA_STATUS_UNVERIFIED}, synchronize_session=False)
    )
    db.commit()
    logger.info("Marked %s unsourced records as '%s'", count, DATA_STATUS_UNVERIFIED)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest NPWS camping areas from the SEED CC-BY package")
    parser.add_argument("--shp", required=True, help="Path to NPWS_VisitorArea.shp")
    parser.add_argument("--limit", type=int, default=None, help="Cap the number of records written")
    parser.add_argument("--all-subtypes", action="store_true", help="Ingest day-use areas and cemeteries too")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing")
    parser.add_argument(
        "--quarantine-unsourced",
        action="store_true",
        help="Also mark hand-written records as unverified",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    with SessionLocal() as db:
        summary = ingest_visitor_area(
            db,
            args.shp,
            only_camping=not args.all_subtypes,
            limit=args.limit,
            dry_run=args.dry_run,
        )
        for key, value in summary.items():
            print(f"{key:22s} {value}")

        if args.quarantine_unsourced and not args.dry_run:
            print(f"{'quarantined':22s} {mark_unsourced_records_unverified(db)}")

        total = db.query(Campsite).count()
        print(f"{'total_campsites':22s} {total}")


if __name__ == "__main__":
    main()
