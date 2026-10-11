import pytest
from app.ingest.seed_qld import (
    derive_source_id,
    build_record,
    QPWS_DOG_RULE_URL,
    QPWS_BOOKING_HUB_URL,
    QPWS_FEE_URL,
    QLD_DATASET_URL,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_uses_sysintcode_and_fallback():
    # Authoritative stable system internal code
    id_1 = derive_source_id(sysintcode="0659WEL001", name="Welford National Park", latitude=-24.985, longitude=143.339)
    assert id_1 == "QLD-QPWS-0659WEL001"

    # Distinct sysintcodes produce distinct IDs
    id_2 = derive_source_id(sysintcode="0300MLD001", name="Malanda Falls Conservation Park", latitude=-17.357, longitude=145.587)
    assert id_2 == "QLD-QPWS-0300MLD001"

    # Fallback if sysintcode is missing
    id_fallback = derive_source_id(sysintcode=None, name="Moreton Island Camp", latitude=-27.123, longitude=153.456)
    assert id_fallback.startswith("QLD-QPWS-")
    assert len(id_fallback) > 12


def test_build_record_qpws_statutory_facts_and_honest_nulls():
    attrs = {
        "objectid": 2,
        "sysintcode": "0659WEL001",
        "estatename": "Welford National Park",
        "nameabbrev": "Welford NP",
        "esttype": "NP",
        "legislated": "Nature Conservation Act 1992",
        "qpwsreg": "Central",
        "latitude": -24.98533458,
        "longitude": 143.33944559,
    }

    rec = build_record(attrs)

    assert rec["name"] == "Welford National Park"
    assert rec["state"] == "QLD"
    assert rec["management_type"] == "QPWS"
    assert rec["latitude"] == pytest.approx(-24.98533458, rel=1e-5)
    assert rec["longitude"] == pytest.approx(143.33944559, rel=1e-5)

    # Statutory QPWS facts
    assert rec["dog_friendly"] is False
    assert rec["fees"] == "$7.75/person/night"
    assert rec["booking_url"] == QPWS_BOOKING_HUB_URL
    assert rec["evidence_url"] == QPWS_DOG_RULE_URL

    # Provenance & Metadata
    assert rec["source_id"] == "QLD-QPWS-0659WEL001"
    assert rec["source_url"] == QLD_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Honest nulls: facilities stay None as they are not published in this boundary layer
    assert rec["facilities"] is None
    assert rec["access_type"] == "National Park"
    assert rec["npws_branch"] == "Central"
