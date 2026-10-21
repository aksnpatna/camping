import pytest
from datetime import datetime, timedelta, timezone
from app.models.campsite import Campsite, DATA_STATUS_VERIFIED, DATA_STATUS_UNVERIFIED, DATA_STATUS_RULE_DERIVED
from app.models.check_in import CampsiteCheckIn
from app.schemas.facts import Fact, CampsiteFacts
from app.services.facts import FactBuilder

def test_fact_schema_serialization():
    f = Fact(
        value=True,
        basis="official",
        source="NSW NPWS Open Data",
        url="https://data.nsw.gov.au",
        as_of="2026-01-15",
        confidence=3,
        note="Verified in official NPWS gazette"
    )
    assert f.value is True
    assert f.basis == "official"
    assert f.confidence == 3
    assert f.as_of == "2026-01-15"

def test_fact_unknown_default():
    f = Fact.unknown(note="Information not confirmed by manager")
    assert f.value is None
    assert f.basis == "unknown"
    assert f.confidence == 0
    assert "not confirmed" in (f.note or "")

def test_non_verified_basis_cannot_claim_verified_words():
    for non_verified_basis in ["rule", "estimate", "model", "unknown"]:
        f = Fact(
            value="Some Value",
            basis=non_verified_basis,
            source="Estimation Model",
            confidence=1
        )
        # Representation or note must not claim verified / sourced
        assert "verified" not in f.basis.lower()
        if f.source:
            assert "verified" not in f.source.lower()
            assert "sourced" not in f.source.lower()

def test_fact_builder_npws_dog_policy_rule():
    site = Campsite(
        id=101,
        name="Blue Mountains Bush Site",
        state="NSW",
        management_type="National Park",
        dog_friendly=False,
        facilities={},
        data_status=DATA_STATUS_RULE_DERIVED
    )
    facts = FactBuilder.build_campsite_facts(site)
    assert facts.dog_friendly.value is False
    assert facts.dog_friendly.basis == "rule"
    assert facts.dog_friendly.confidence == 3
    assert "NSW National Parks" in (facts.dog_friendly.source or "")
    assert "Dogs not permitted" in (facts.dog_friendly.note or "")

def test_fact_builder_parks_vic_dog_policy_rule():
    site = Campsite(
        id=102,
        name="Wilsons Prom Camp",
        state="VIC",
        management_type="National Park",
        dog_friendly=False,
        facilities={},
        data_status=DATA_STATUS_RULE_DERIVED
    )
    facts = FactBuilder.build_campsite_facts(site)
    assert facts.dog_friendly.value is False
    assert facts.dog_friendly.basis == "rule"
    assert facts.dog_friendly.confidence == 3
    assert "Parks Victoria" in (facts.dog_friendly.source or "")

def test_fact_builder_unknown_facilities_stay_unknown():
    site = Campsite(
        id=103,
        name="Remote Creek Spot",
        state="NSW",
        management_type="Public Reserve",
        dog_friendly=None,
        facilities=None,
        data_status=DATA_STATUS_UNVERIFIED
    )
    facts = FactBuilder.build_campsite_facts(site)
    assert facts.dog_friendly.basis == "unknown"
    assert facts.dog_friendly.confidence == 0
    assert facts.campfires.basis == "unknown"
    assert facts.campfires.confidence == 0
    assert facts.water.basis == "unknown"
    assert facts.toilets.basis == "unknown"
    assert facts.telco.basis == "unknown"

def test_fact_builder_verified_facilities():
    site = Campsite(
        id=104,
        name="Euroka Campground",
        state="NSW",
        management_type="National Park",
        dog_friendly=False,
        facilities={
            "campfires": True,
            "toilets": "flush",
            "drinking_water": False
        },
        source_url="https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/euroka-campground",
        data_status=DATA_STATUS_VERIFIED,
        verified_at=datetime(2026, 2, 1, 10, 0, 0)
    )
    facts = FactBuilder.build_campsite_facts(site)
    assert facts.campfires.value is True
    assert facts.campfires.basis == "verified"
    assert facts.campfires.confidence == 3
    assert facts.toilets.value == "flush"
    assert facts.toilets.basis == "verified"
    assert facts.water.value == "none" or facts.water.value == "carry_in"
    assert facts.water.basis == "verified"

def test_fact_builder_recent_community_checkin():
    site = Campsite(
        id=105,
        name="Wombeyan Caves Reserve",
        state="NSW",
        management_type="Crown Land",
        facilities={},
        data_status=DATA_STATUS_UNVERIFIED
    )
    recent_check_in = CampsiteCheckIn(
        campsite_id=105,
        water_status="flowing",
        toilets_status="clean",
        vibe_status="plenty_space",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)
    )
    facts = FactBuilder.build_campsite_facts(site, check_ins=[recent_check_in])
    assert facts.water.basis == "community"
    assert facts.water.confidence == 2
    assert facts.water.value == "flowing"
    assert facts.toilets.basis == "community"
    assert facts.toilets.confidence == 2
    assert facts.toilets.value == "clean"

def test_fact_builder_decayed_community_checkin_ignored():
    site = Campsite(
        id=106,
        name="Old River Reserve",
        state="NSW",
        management_type="Crown Land",
        facilities={},
        data_status=DATA_STATUS_UNVERIFIED
    )
    # Check-in older than 14 days must decay and not be used as fresh community truth
    old_check_in = CampsiteCheckIn(
        campsite_id=106,
        water_status="flowing",
        toilets_status="clean",
        created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=20)
    )
    facts = FactBuilder.build_campsite_facts(site, check_ins=[old_check_in])
    assert facts.water.basis == "unknown"
    assert facts.toilets.basis == "unknown"

def test_campsite_facts_confidence_meter():
    site = Campsite(
        id=107,
        name="Partially Known Camp",
        state="NSW",
        management_type="National Park",
        dog_friendly=False,
        facilities={"campfires": True},
        data_status=DATA_STATUS_RULE_DERIVED
    )
    facts = FactBuilder.build_campsite_facts(site, drive_minutes=120)
    # dog_friendly (rule), campfires (official), driving_time (estimate) are known; water/toilets/telco/fees unknown
    assert facts.known_facts_count >= 3
    assert facts.total_facts_count == 9

    # Verify Pydantic v2 computed_fields serialize in dictionary/JSON
    dumped = facts.model_dump()
    assert "known_facts_count" in dumped
    assert "total_facts_count" in dumped
    assert "official_or_verified_count" in dumped
    assert dumped["known_facts_count"] == facts.known_facts_count
    assert dumped["total_facts_count"] == facts.total_facts_count
    assert dumped["official_or_verified_count"] == facts.official_or_verified_count

