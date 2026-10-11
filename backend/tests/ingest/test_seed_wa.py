import pytest
from app.ingest.seed_wa import (
    derive_source_id,
    build_record,
    DBCA_DOG_RULE_URL,
    DBCA_PARKSTAY_HUB_URL,
    DBCA_DATASET_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_uses_entity_id_and_fallback():
    # Authoritative entity_id from DBCA Explore Parks
    id_1 = derive_source_id(entity_id=159, name="Alexander Morrison National Park", latitude=-30.05, longitude=115.58)
    assert id_1 == "WA-DBCA-159"

    id_2 = derive_source_id(entity_id=2228, name="Alfred Cove Nature Reserve", latitude=-32.02, longitude=115.81)
    assert id_2 == "WA-DBCA-2228"

    # Fallback if entity_id is missing
    id_fallback = derive_source_id(entity_id=None, name="Remote Kimberley Camp", latitude=-16.12, longitude=125.45)
    assert id_fallback.startswith("WA-DBCA-")
    assert len(id_fallback) > 12


def test_build_record_dbca_statutory_facts_and_honest_nulls():
    attrs = {
        "OBJECTID": 1,
        "entity_id": 159,
        "name": "Alexander Morrison National Park",
        "lat": -30.050899505615,
        "lon": 115.58000183105,
        "url": "https://exploreparks.dbca.wa.gov.au/node/159",
        "source_map": "leaflet-map-view-places-places-parks-map-points",
    }

    rec = build_record(attrs)

    assert rec["name"] == "Alexander Morrison National Park"
    assert rec["state"] == "WA"
    assert rec["management_type"] == "DBCA"
    assert rec["latitude"] == pytest.approx(-30.0508995, rel=1e-5)
    assert rec["longitude"] == pytest.approx(115.5800018, rel=1e-5)

    # Statutory DBCA rules: domestic animals strictly banned due to 1080 baiting & wildlife protection
    assert rec["dog_friendly"] is False
    assert rec["booking_url"] == "https://exploreparks.dbca.wa.gov.au/node/159"
    assert rec["evidence_url"] == DBCA_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "WA-DBCA-159"
    assert rec["source_url"] == DBCA_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities and fees stay None (never guess flush toilets or exact fees)
    assert rec["facilities"] is None
    assert rec["fees"] is None
    assert rec["access_type"] == "National Park"
    assert "TENT" in rec["rig_access"]
