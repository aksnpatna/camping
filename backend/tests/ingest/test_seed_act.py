import pytest
from app.ingest.seed_act import (
    derive_source_id,
    build_reserve_record,
    build_campground_record,
    ACT_DOG_RULE_URL,
    ACT_BOOKING_HUB_URL,
    ACT_DATASET_URL,
    BOODEREE_BOOKING_URL,
    BOODEREE_RULES_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_act_and_jbt():
    id_1 = derive_source_id(objectid=1, name="Namadgi National Park", state="ACT")
    assert id_1 == "ACT-PCS-1"

    id_woods = derive_source_id(objectid=None, name="Woods Reserve Campground", state="ACT")
    assert id_woods == "ACT-PCS-woods-reserve-campground"

    id_jbt = derive_source_id(objectid=None, name="Green Patch Campground", state="JBT")
    assert id_jbt == "JBT-PA-green-patch-campground"


def test_build_reserve_record_act_statutory_facts():
    attrs = {
        "OBJECTID": 1,
        "TERRITORY_PLAN_OVERLAY": "National Park",
        "RESERVE_NAME": "Namadgi National Park",
        "GlobalID": "b0923f79-41a3-444b-8b74-e297810bb6a6",
    }
    rings = [
        [
            [148.98, -35.68],
            [149.02, -35.68],
            [149.02, -35.65],
            [148.98, -35.65],
            [148.98, -35.68],
        ]
    ]

    rec = build_reserve_record(attrs, rings)

    assert rec["name"] == "Namadgi National Park"
    assert rec["state"] == "ACT"
    assert rec["management_type"] == "ACT PCS"
    assert rec["latitude"] == pytest.approx(-35.665, rel=1e-2)
    assert rec["longitude"] == pytest.approx(149.0, rel=1e-2)

    # Statutory ACT PCS rules: domestic pets banned in national parks
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == ACT_BOOKING_HUB_URL
    assert rec["evidence_url"] == ACT_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "ACT-PCS-1"
    assert rec["source_url"] == ACT_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities and fees stay None
    assert rec["facilities"] is None
    assert rec["fees"] is None
    assert rec["access_type"] == "National Park"


def test_build_campground_record_woods_reserve_dog_friendly():
    rec = build_campground_record(
        name="Woods Reserve Campground",
        state="ACT",
        management_type="ACT PCS",
        latitude=-35.4981,
        longitude=148.9486,
        dog_friendly=True,
    )

    assert rec["name"] == "Woods Reserve Campground"
    assert rec["state"] == "ACT"
    assert rec["dog_friendly"] is True
    assert rec["source_id"] == "ACT-PCS-woods-reserve-campground"


def test_build_campground_record_jbt_booderee_carve_out():
    rec = build_campground_record(
        name="Green Patch Campground",
        state="JBT",
        management_type="Parks Australia",
        latitude=-35.1417,
        longitude=150.7250,
        dog_friendly=False,
    )

    # Fixes R11: Booderee MUST be JBT, NOT NSW
    assert rec["name"] == "Green Patch Campground"
    assert rec["state"] == "JBT"
    assert rec["management_type"] == "Parks Australia"
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == BOODEREE_BOOKING_URL
    assert rec["evidence_url"] == BOODEREE_RULES_URL
    assert rec["source_id"] == "JBT-PA-green-patch-campground"
