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

        # 2. Forestry Corporation rules
        elif "Forestry" in mgmt or "State Forest" in mgmt:
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
