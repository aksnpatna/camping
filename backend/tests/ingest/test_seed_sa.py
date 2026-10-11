import pytest
from app.ingest.seed_sa import (
    derive_source_id,
    build_record,
    SA_DOG_RULE_URL,
    SA_BOOKING_HUB_URL,
    SA_DATASET_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_uses_park_id_and_fallback():
    # Authoritative park_id from South Australia DEW
    id_1 = derive_source_id(park_id=2, resname="Mount Remarkable", latitude=-32.78, longitude=138.08)
    assert id_1 == "SA-DEW-2"

    id_2 = derive_source_id(park_id=145, resname="Innes", latitude=-35.23, longitude=136.90)
    assert id_2 == "SA-DEW-145"

    # Fallback if park_id is missing
    id_fallback = derive_source_id(park_id=None, resname="Unnamed Conservation Park", latitude=-34.50, longitude=138.50)
    assert id_fallback.startswith("SA-DEW-")
    assert len(id_fallback) > 10


def test_build_record_dew_statutory_facts_and_honest_nulls():
    feature = {
        "type": "Feature",
        "properties": {
            "FID": 0,
            "PARK_ID": 2,
            "RESNAME": "Mount Remarkable",
            "RESTYPE": "NP",
            "RESCODE": 8,
            "RESNAMETYP": "Mount Remarkable (NP)",
            "NT_STATUS": "Mixed",
            "IUCN_CAT": "VI",
            "UNIQUEID": "NP     8",
            "REGION_ID": 7,
            "DISTRICT_I": 13,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [138.0, -32.8],
                    [138.2, -32.8],
                    [138.2, -32.7],
                    [138.0, -32.7],
                    [138.0, -32.8],
                ]
            ],
        },
    }

    rec = build_record(feature)

    assert rec["name"] == "Mount Remarkable (NP)"
    assert rec["state"] == "SA"
    assert rec["management_type"] == "NPWSA"
    assert rec["latitude"] == pytest.approx(-32.75, rel=1e-2)
    assert rec["longitude"] == pytest.approx(138.1, rel=1e-2)

    # Statutory DEW rules: domestic pets banned under National Parks and Wildlife Act 1972
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == SA_BOOKING_HUB_URL
    assert rec["evidence_url"] == SA_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "SA-DEW-2"
    assert rec["source_url"] == SA_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities and fees stay None (never guess flush toilets or exact fees)
    assert rec["facilities"] is None
    assert rec["fees"] is None
    assert rec["access_type"] == "National Park"
    assert "TENT" in rec["rig_access"]
