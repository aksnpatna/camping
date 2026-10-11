import pytest
from app.ingest.seed_vic import (
    derive_source_id,
    is_camping_eligible,
    build_record,
    DEECA_DOG_RULE_URL,
    DEECA_FREE_CAMPING_RULE_URL,
    DATAVIC_DATASET_URL,
    derive_rig_access,
)
from app.models.campsite import DATA_STATUS_RULE_DERIVED


def test_derive_source_id_uses_serial_no_and_fallback():
    # When serial_no is present
    id_1 = derive_source_id(serial_no="120031", name="Abbeyards", latitude=-36.915, longitude=146.708)
    assert id_1 == "VIC-DEECA-120031"

    # Distinct serial numbers produce distinct IDs
    id_2 = derive_source_id(serial_no="80006", name="Avondale Gardens", latitude=-36.238, longitude=147.526)
    assert id_2 == "VIC-DEECA-80006"

    # Fallback if serial_no is missing
    id_fallback = derive_source_id(serial_no=None, name="Remote Clearing", latitude=-37.123, longitude=145.456)
    assert id_fallback.startswith("VIC-DEECA-")
    assert len(id_fallback) > 12


def test_is_camping_eligible():
    # Eligible: camping='Y' and published='Y'
    assert is_camping_eligible({"camping": "Y", "published": "Y", "name": "Abbeyards"})
    # Case insensitivity
    assert is_camping_eligible({"camping": "y", "published": "y", "name": "Abbeyards"})

    # Ineligible: camping='N' or None (e.g. day-only picnic area)
    assert not is_camping_eligible({"camping": "N", "published": "Y", "name": "Day Picnic Area"})
    assert not is_camping_eligible({"camping": None, "published": "Y", "name": "Lookout"})
    # Ineligible: published='N'
    assert not is_camping_eligible({"camping": "Y", "published": "N", "name": "Draft Site"})


def test_derive_rig_access():
    # 2WD and camper trailer in access description
    rigs_1 = derive_rig_access(
        access_dsc="gravel suitable for 2WDs and camper trailers",
        campervanning="Y",
        campervan_type="CAMPER TRAILER",
    )
    assert "TENT" in rigs_1
    assert "CAR" in rigs_1
    assert "CAMPER_TRAILER" in rigs_1

    # 4WD only
    rigs_2 = derive_rig_access(
        access_dsc="Access via steep rough track, strictly 4WD high clearance only",
        campervanning=None,
        campervan_type=None,
    )
    assert "TENT" in rigs_2
    assert "4WD" in rigs_2
    assert "CARAVAN" not in rigs_2


def test_build_record_honest_nulls_and_statutory_rules():
    feature = {
        "type": "Feature",
        "id": "recweb_site.1",
        "geometry": {
            "type": "Point",
            "coordinates": [146.707992, -36.915164],
        },
        "properties": {
            "serial_no": "120031",
            "name": "Abbeyards",
            "site_class": "BASIC",
            "access_dsc": "From Myrtleford, travel 31km south... gravel suitable for 2WDs and camper trailers.",
            "comments": "Abbeyards is small site along the Buffalo River with campfire pits and picnic tables available for use.",
            "maintained_by": "OVENS",
            "camping": "Y",
            "published": "Y",
            "clos_stat": None,
            "bbq_pit": "3",
            "fee": None,
        },
    }

    rec = build_record(feature)

    assert rec["name"] == "Abbeyards"
    assert rec["state"] == "VIC"
    assert rec["management_type"] == "DEECA State Forests"
    assert rec["latitude"] == pytest.approx(-36.915164, rel=1e-5)
    assert rec["longitude"] == pytest.approx(146.707992, rel=1e-5)

    # Statutory rules for Victorian State Forests
    assert rec["dog_friendly"] is True
    assert rec["fees"] == "$0 (Free)"
    assert rec["booking_url"] == "https://www.exploreoutdoors.vic.gov.au/activities/camping"
    assert rec["evidence_url"] == DEECA_DOG_RULE_URL

    # Provenance
    assert rec["source_id"] == "VIC-DEECA-120031"
    assert rec["source_url"] == DATAVIC_DATASET_URL
    assert rec["data_status"] == DATA_STATUS_RULE_DERIVED

    # Rig access includes camper trailer & car based on access_dsc
    assert "TENT" in rec["rig_access"]
    assert "CAMPER_TRAILER" in rec["rig_access"]

    # Honest facilities: toilets/showers stay None unless verified, campfires True from comments/bbq_pit
    assert rec["facilities"]["campfires"] is True
    assert rec["facilities"]["toilets"] is None
    assert rec["facilities"]["showers"] is None
