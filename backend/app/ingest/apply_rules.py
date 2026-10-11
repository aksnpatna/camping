"""
Rule-based inference engine applying versioned land-manager policy rules.

Encodes authoritative land-manager policies (e.g. NPWS dog ban, Forestry Corp free camping)
as versioned rows in the `policy_rules` table and derives campsite facts idempotently.
"""

import logging
from datetime import date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.policy_rule import PolicyRule
from app.models.campsite import Campsite, DATA_STATUS_RULE_DERIVED, DATA_STATUS_VERIFIED

logger = logging.getLogger(__name__)

CANONICAL_RULES = [
    {
        "land_manager": "NPWS",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://www.nationalparks.nsw.gov.au/plan-your-visit/rules-and-regulations",
        "description": "Dogs are prohibited in NSW national parks and reserves under the National Parks and Wildlife Act.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "NPWS",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation",
        "description": "Online booking is required for all NPWS campgrounds prior to arrival.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Forestry Corporation",
        "field": "dog_friendly",
        "value": "True",
        "evidence_url": "https://www.forestrycorporation.com.au/visit/activities/dogs",
        "description": "Dogs are welcome in NSW State Forests under effective control.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Forestry Corporation",
        "field": "fees",
        "value": "$0 (Free)",
        "evidence_url": "https://www.forestrycorporation.com.au/visit/activities/camping",
        "description": "Camping in NSW State Forests is free and first-come, first-served with no booking required.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Parks Victoria",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://www.parks.vic.gov.au/things-to-do/dog-walking",
        "description": "Dogs are prohibited in Victorian national parks and state parks under the National Parks Act 1975.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Parks Victoria",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://www.parks.vic.gov.au/stay",
        "description": "Advance online booking is required for bookable campgrounds managed by Parks Victoria.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "DEECA State Forests",
        "field": "dog_friendly",
        "value": "True",
        "evidence_url": "https://www.exploreoutdoors.vic.gov.au/activities/dog-walking",
        "description": "Dogs are welcome in Victorian State Forests under effective control on leash.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "DEECA State Forests",
        "field": "fees",
        "value": "$0 (Free)",
        "evidence_url": "https://www.exploreoutdoors.vic.gov.au/activities/camping",
        "description": "Camping in Victorian State Forests is free statewide with no booking required.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "QPWS",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://parks.des.qld.gov.au/plan-your-visit/rules",
        "description": "Domestic dogs are prohibited in Queensland national parks under the Nature Conservation Act 1992.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "QPWS",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://parks.des.qld.gov.au/camping/booking-information",
        "description": "Camping permits must be secured and paid online prior to arrival for all QPWS parks.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "QPWS",
        "field": "fees",
        "value": "$7.75/person/night",
        "evidence_url": "https://parks.des.qld.gov.au/camping/fees",
        "description": "Standard QPWS camping fee is $7.75 per person per night ($31.00 per family per night).",
        "effective_from": date(2026, 7, 1),
    },
    {
        "land_manager": "DBCA",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://exploreparks.dbca.wa.gov.au/know-before-you-go/pets-parks",
        "description": "Domestic pets are strictly prohibited in Western Australia national parks due to native wildlife protection and 1080 baiting.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "DBCA",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://parkstay.dbca.wa.gov.au/",
        "description": "Advance booking via Park Stay WA is required for bookable DBCA campgrounds.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "NPWSA",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://www.parks.sa.gov.au/know-before-you-go/pets-in-parks",
        "description": "Dogs are prohibited in South Australian national parks and conservation reserves under the National Parks and Wildlife Act 1972.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "NPWSA",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://www.parks.sa.gov.au/booking",
        "description": "Advance online booking is required for all campgrounds managed by National Parks and Wildlife Service South Australia.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "PWS",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://parks.tas.gov.au/plan-your-visit/parks-pass/dogs-in-parks",
        "description": "Dogs are prohibited in Tasmanian national parks and reserves under the National Parks and Reserves Management Act 2002.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "PWS",
        "field": "booking_status",
        "value": "Parks Pass required",
        "evidence_url": "https://parks.tas.gov.au/passes-and-entry",
        "description": "A valid Tasmanian National Parks Pass is required for entry to all national parks in Tasmania.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "PWCNT",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://nt.gov.au/parks/find-a-park/rules-for-pets",
        "description": "Dogs and other pets are prohibited in Northern Territory national parks under the Territory Parks and Wildlife Conservation Act.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "PWCNT",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://parkbookings.nt.gov.au/",
        "description": "Advance online booking is mandatory for all campsites managed by Parks and Wildlife Commission of the NT.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "ACT PCS",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://www.parks.act.gov.au/before-you-go/dogs-in-parks",
        "description": "Dogs are prohibited in ACT national parks and nature reserves under the Nature Conservation Act 2014.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "ACT PCS",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://www.parks.act.gov.au/",
        "description": "Advance booking is required for campgrounds managed by ACT Parks and Conservation Service.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Parks Australia",
        "field": "dog_friendly",
        "value": "False",
        "evidence_url": "https://parksaustralia.gov.au/booderee/plan/rules/",
        "description": "Domestic pets are strictly prohibited in Commonwealth national parks including Booderee.",
        "effective_from": date(2020, 1, 1),
    },
    {
        "land_manager": "Parks Australia",
        "field": "booking_status",
        "value": "Booking required",
        "evidence_url": "https://parksaustralia.gov.au/booderee/camp/",
        "description": "Advance online booking is required for all campgrounds in Booderee National Park.",
        "effective_from": date(2020, 1, 1),
    },
]


def seed_default_policy_rules(db: Session) -> int:
    """Upsert the canonical land-manager rules into the policy_rules table."""
    count = 0
    for r in CANONICAL_RULES:
        existing = (
            db.query(PolicyRule)
            .filter(
                PolicyRule.land_manager == r["land_manager"],
                PolicyRule.field == r["field"],
            )
            .first()
        )
        if existing:
            existing.value = r["value"]
            existing.evidence_url = r["evidence_url"]
            existing.description = r["description"]
            existing.effective_from = r["effective_from"]
            existing.is_active = True
        else:
            db.add(PolicyRule(**r, is_active=True))
            count += 1
    db.commit()
    logger.info("Seeded %s new policy rules", count)
    return count


def apply_policy_rules(db: Session, overwrite_verified: bool = False) -> Dict[str, int]:
    """
    Apply active land-manager rules across all campsites.

    Idempotent. Does not downgrade manually 'verified' records unless
    explicitly told to do so.
    """
    # Ensure rules are seeded
    seed_default_policy_rules(db)

    active_rules = db.query(PolicyRule).filter(PolicyRule.is_active == True).all()
    rules_by_manager: Dict[str, Dict[str, PolicyRule]] = {}
    for r in active_rules:
        rules_by_manager.setdefault(r.land_manager, {})[r.field] = r

    updated_count = 0
    campsites = db.query(Campsite).all()

    for site in campsites:
        # Never downgrade human verified facts
        if site.data_status == DATA_STATUS_VERIFIED and not overwrite_verified:
            continue

        changed = False
        mgmt = (site.management_type or "").strip()

        # 1. NPWS rules
        if "NPWS" in mgmt or mgmt == "NPWS":
            npws_rules = rules_by_manager.get("NPWS", {})
            if "dog_friendly" in npws_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = npws_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds"
                changed = True

        # 2. NSW Forestry Corporation rules
        elif ("Forestry" in mgmt or "State Forest" in mgmt) and site.state == "NSW":
            fc_rules = rules_by_manager.get("Forestry Corporation", {})
            if "dog_friendly" in fc_rules and site.dog_friendly != True:
                site.dog_friendly = True
                site.evidence_url = fc_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if "fees" in fc_rules and (not site.fees or site.data_status != DATA_STATUS_VERIFIED):
                site.fees = fc_rules["fees"].value
                site.evidence_url = fc_rules["fees"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.forestrycorporation.com.au/visit/activities/camping"
                changed = True

        # 3. Victorian DEECA State Forests
        elif ("DEECA" in mgmt or "State Forest" in mgmt) and site.state == "VIC":
            deeca_rules = rules_by_manager.get("DEECA State Forests", {})
            if "dog_friendly" in deeca_rules and site.dog_friendly != True:
                site.dog_friendly = True
                site.evidence_url = deeca_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if "fees" in deeca_rules and (not site.fees or site.data_status != DATA_STATUS_VERIFIED):
                site.fees = deeca_rules["fees"].value
                site.evidence_url = deeca_rules["fees"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.exploreoutdoors.vic.gov.au/activities/camping"
                changed = True

        # 4. Parks Victoria
        elif "Parks Victoria" in mgmt or (site.state == "VIC" and "National Park" in mgmt):
            pv_rules = rules_by_manager.get("Parks Victoria", {})
            if "dog_friendly" in pv_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = pv_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.parks.vic.gov.au/stay"
                changed = True

        # 5. QPWS Queensland rules
        elif "QPWS" in mgmt or site.state == "QLD":
            qpws_rules = rules_by_manager.get("QPWS", {})
            if "dog_friendly" in qpws_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = qpws_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if "fees" in qpws_rules and (not site.fees or site.data_status != DATA_STATUS_VERIFIED):
                site.fees = qpws_rules["fees"].value
                site.evidence_url = qpws_rules["fees"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://parks.des.qld.gov.au/camping"
                changed = True

        # 6. DBCA Western Australia rules
        elif "DBCA" in mgmt or site.state == "WA":
            dbca_rules = rules_by_manager.get("DBCA", {})
            if "dog_friendly" in dbca_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = dbca_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://parkstay.dbca.wa.gov.au/"
                changed = True

        # 7. NPWSA South Australia rules
        elif "NPWSA" in mgmt or "DEW" in mgmt or site.state == "SA":
            sa_rules = rules_by_manager.get("NPWSA", {})
            if "dog_friendly" in sa_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = sa_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.parks.sa.gov.au/booking"
                changed = True

        # 8. PWS Tasmania rules
        elif "PWS" in mgmt or site.state == "TAS":
            tas_rules = rules_by_manager.get("PWS", {})
            if "dog_friendly" in tas_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = tas_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://parks.tas.gov.au/passes-and-entry"
                changed = True

        # 9. PWCNT Northern Territory rules
        elif "PWCNT" in mgmt or "DEPWS" in mgmt or site.state == "NT":
            nt_rules = rules_by_manager.get("PWCNT", {})
            if "dog_friendly" in nt_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = nt_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://parkbookings.nt.gov.au/"
                changed = True

        # 10. ACT PCS rules
        elif "ACT" in mgmt or site.state == "ACT":
            act_rules = rules_by_manager.get("ACT PCS", {})
            if site.dog_friendly is None and "dog_friendly" in act_rules:
                site.dog_friendly = False
                site.evidence_url = act_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://www.parks.act.gov.au/"
                changed = True

        # 11. Parks Australia (JBT Booderee)
        elif "Parks Australia" in mgmt or site.state == "JBT":
            pa_rules = rules_by_manager.get("Parks Australia", {})
            if "dog_friendly" in pa_rules and site.dog_friendly != False:
                site.dog_friendly = False
                site.evidence_url = pa_rules["dog_friendly"].evidence_url
                site.data_status = DATA_STATUS_RULE_DERIVED
                changed = True
            if not site.booking_url:
                site.booking_url = "https://parksaustralia.gov.au/booderee/camp/"
                changed = True

        if changed:
            updated_count += 1

    db.commit()
    summary = {
        "campsites_evaluated": len(campsites),
        "campsites_updated": updated_count,
        "active_rules_count": len(active_rules),
    }
    logger.info("Policy rules applied: %s", summary)
    return summary


def main():
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db:
        summary = apply_policy_rules(db)
        print(summary)


if __name__ == "__main__":
    main()
