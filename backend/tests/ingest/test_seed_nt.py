import pytest
from app.ingest.seed_nt import (
    derive_source_id,
    build_record,
    NT_DOG_RULE_URL,
    NT_BOOKING_HUB_URL,
    NT_DATASET_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_deterministic_slug():
    id_1 = derive_source_id("Barranyi (North Island) National Park", latitude=-15.56, longitude=136.86)
    assert id_1 == "NT-DEPWS-barranyi-north-island-national-park"

    id_2 = derive_source_id("Litchfield National Park", latitude=-13.05, longitude=130.90)
    assert id_2 == "NT-DEPWS-litchfield-national-park"

    # Special characters handled cleanly
    id_3 = derive_source_id("Anna's Reservoir Conservation Reserve", latitude=-22.58, longitude=133.14)
    assert id_3 == "NT-DEPWS-annas-reservoir-conservation-reserve"


def test_build_record_pwcnt_statutory_facts_and_honest_nulls():
    rec = build_record(
        name="Barranyi (North Island) National Park",
        latitude=-15.5623,
        longitude=136.8679,
    )

    assert rec["name"] == "Barranyi (North Island) National Park"
    assert rec["state"] == "NT"
    assert rec["management_type"] == "PWCNT"
    assert rec["latitude"] == pytest.approx(-15.5623, rel=1e-3)
    assert rec["longitude"] == pytest.approx(136.8679, rel=1e-3)

    # Statutory PWCNT rules: domestic pets banned in national parks
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == NT_BOOKING_HUB_URL
    assert rec["evidence_url"] == NT_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "NT-DEPWS-barranyi-north-island-national-park"
    assert rec["source_url"] == NT_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities and fees stay None (never guess category A/B tier)
    assert rec["facilities"] is None
    assert rec["fees"] is None
    assert rec["access_type"] == "National Park"
    assert "TENT" in rec["rig_access"]
    assert "Be Crocwise" in rec["asset_comments"]
