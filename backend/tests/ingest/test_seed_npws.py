import pytest
from app.core.database import SessionLocal
from app.ingest.seed_npws import (
    derive_source_id,
    is_internal_subarea,
    build_record,
    NPWS_DOG_RULE_URL,
    NPWS_BOOKING_HUB_URL,
    SEED_DATASET_URL,
)
from app.models.campsite import Campsite, DATA_STATUS_RULE_DERIVED


def test_derive_source_id_deterministic_and_distinct():
    id_1 = derive_source_id("Booderee Camp", -35.12345, 150.71234)
    id_2 = derive_source_id("Booderee Camp", -35.12345, 150.71234)
    assert id_1 == id_2
    assert id_1.startswith("SEED-VA-")

    # Distinct coordinates produce distinct IDs
    id_diff_coords = derive_source_id("Booderee Camp", -35.22345, 150.71234)
    assert id_1 != id_diff_coords

    # Distinct names produce distinct IDs
    id_diff_name = derive_source_id("Another Camp", -35.12345, 150.71234)
    assert id_1 != id_diff_name


def test_is_internal_subarea_exclusions_and_preservations():
    # Exclude internal sub-divisions
    assert is_internal_subarea({"Comments": "Visitor Area - North of Depot & Office"})
    assert is_internal_subarea({"Comments": "Visitor Area — Central, around Amenity A3"})
    assert is_internal_subarea({"Comments": "Visitor Area - South of Shed"})

    # Preserve genuine campgrounds with similar names or ordinary comments
    assert not is_internal_subarea({"AssetName": "Depot Beach campground", "Comments": "Beachside camping"})
    assert not is_internal_subarea({"AssetName": "North Era camp", "Comments": None})
    assert not is_internal_subarea({"AssetName": "North Head campground", "Comments": "Coastal headland"})
    assert not is_internal_subarea({"AssetName": "South Bank campground", "Comments": ""})
    assert not is_internal_subarea({"AssetName": "Euroka Campground", "Comments": "Camping area"})


def test_build_record_honest_nulls_and_rules():
    row = {
        "AssetName": "Euroka Clearing",
        "d_AssetTyp": "Vehicle Based",
        "d_Branch": "Blue Mountains",
        "d_LGA": "Blue Mountains",
        "Comments": "Open grassy clearing",
        "ModifiedDa": "2026-08-10",
    }
    rec = build_record(row, longitude=150.62, latitude=-33.78)

    assert rec["name"] == "Euroka Clearing"
    # Never guess facilities or fees — they are absent from the SEED dataset
    assert rec["facilities"] is None
    assert rec["fees"] is None
    # Derived from statewide NPWS dog prohibition rule
    assert rec["dog_friendly"] is False
    assert rec["evidence_url"] == NPWS_DOG_RULE_URL
    assert rec["source_url"] == SEED_DATASET_URL
    assert rec["booking_url"] == NPWS_BOOKING_HUB_URL
    # Fire district mapped from unambiguous branch
    assert rec["fire_district"] == "Greater Sydney Region"
    assert rec["rig_access"] == ["TENT", "CAR"]
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED
    assert rec["access_type"] == "Vehicle Based"
    assert rec["lga"] == "Blue Mountains"
    assert rec["npws_branch"] == "Blue Mountains"


def test_build_record_unmapped_branch_leaves_fire_district_none():
    row = {
        "AssetName": "Far North Camp",
        "d_AssetTyp": "Remote Walk-in",
        "d_Branch": "North Coast",
    }
    rec = build_record(row, longitude=153.1, latitude=-28.5)
    # A branch that does not map 1:1 to an RFS district must stay None (never guess)
    assert rec["fire_district"] is None
    assert rec["rig_access"] == ["TENT"]


def test_db_state_seed_records_honesty():
    with SessionLocal() as db:
        seed_records = (
            db.query(Campsite)
            .filter(Campsite.source_id.like("SEED-%"))
            .all()
        )
        assert len(seed_records) >= 700, f"Expected ~715 SEED records, found {len(seed_records)}"

        for site in seed_records:
            # Provenance must be intact
            assert site.evidence_url == NPWS_DOG_RULE_URL
            assert site.source_url == SEED_DATASET_URL
            assert site.data_status == DATA_STATUS_RULE_DERIVED
            # Honesty: never synthesize fees or facilities
            assert site.facilities is None
            assert site.fees is None
            assert site.dog_friendly is False
            assert site.state == "NSW"
