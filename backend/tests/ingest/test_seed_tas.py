import pytest
from app.ingest.seed_tas import (
    derive_source_id,
    build_record,
    TAS_DOG_RULE_URL,
    TAS_PARKS_PASS_URL,
    TAS_DATASET_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_uses_infra_id_and_fallback():
    # Authoritative INFRA_ID from The LIST Tasmania
    id_1 = derive_source_id(infra_id=18824, name="Patriarch Wildlife Sanctuary Campground", latitude=-39.99, longitude=148.20)
    assert id_1 == "TAS-LIST-18824"

    id_2 = derive_source_id(infra_id=18774, name="Camping at Bruny Island", latitude=-43.44, longitude=147.19)
    assert id_2 == "TAS-LIST-18774"

    # Fallback if INFRA_ID is missing
    id_fallback = derive_source_id(infra_id=None, name="Remote Southwest Bush Camp", latitude=-43.12, longitude=146.25)
    assert id_fallback.startswith("TAS-LIST-")
    assert len(id_fallback) > 12


def test_build_record_pws_statutory_facts_and_honest_nulls():
    feature = {
        "attributes": {
            "OBJECTID": 3,
            "INFRA_ID": 18824,
            "INFTY2_TXT": "Camping",
            "NOM_REG_NO": "48529Q",
            "NAME": "Patriarch Wildlife Sanctuary Campground",
            "DESCRIPT": None,
            "SHAPE.AREA": 2932.0,
        },
        "geometry": {
            "rings": [
                [
                    [148.2084, -39.9968],
                    [148.2090, -39.9968],
                    [148.2090, -39.9965],
                    [148.2084, -39.9965],
                    [148.2084, -39.9968],
                ]
            ]
        },
    }

    rec = build_record(feature)

    assert rec["name"] == "Patriarch Wildlife Sanctuary Campground"
    assert rec["state"] == "TAS"
    assert rec["management_type"] == "PWS"
    assert rec["latitude"] == pytest.approx(-39.99665, rel=1e-3)
    assert rec["longitude"] == pytest.approx(148.2087, rel=1e-3)

    # Statutory PWS rules: domestic pets banned under National Parks and Reserves Management Act 2002
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == TAS_PARKS_PASS_URL
    assert rec["evidence_url"] == TAS_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "TAS-LIST-18824"
    assert rec["source_url"] == TAS_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities and fees stay None (never guess flush toilets or exact per-site fees)
    assert rec["facilities"] is None
    assert rec["fees"] is None
    assert rec["access_type"] == "Camping Area"
    assert "TENT" in rec["rig_access"]
