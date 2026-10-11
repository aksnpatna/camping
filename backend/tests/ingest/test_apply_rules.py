import pytest
from app.core.database import SessionLocal
from app.models.campsite import Campsite, DATA_STATUS_RULE_DERIVED, DATA_STATUS_VERIFIED
from app.models.policy_rule import PolicyRule
from app.ingest.apply_rules import seed_default_policy_rules, apply_policy_rules


def test_seed_default_policy_rules():
    with SessionLocal() as db:
        seed_default_policy_rules(db)
        rules = db.query(PolicyRule).all()
        assert len(rules) >= 4

        npws_dog = db.query(PolicyRule).filter(
            PolicyRule.land_manager == "NPWS",
            PolicyRule.field == "dog_friendly"
        ).first()
        assert npws_dog is not None
        assert npws_dog.value == "False"
        assert "nationalparks.nsw.gov.au" in npws_dog.evidence_url

        fc_fees = db.query(PolicyRule).filter(
            PolicyRule.land_manager == "Forestry Corporation",
            PolicyRule.field == "fees"
        ).first()
        assert fc_fees is not None
        assert fc_fees.value == "$0 (Free)"
        assert "forestrycorporation.com.au" in fc_fees.evidence_url


def test_apply_policy_rules_to_campsites():
    with SessionLocal() as db:
        # Create a test NPWS site and test Forestry site
        npws_site = Campsite(
            name="Rule Test NPWS Camp",
            location="SRID=4326;POINT(150.5 -33.5)",
            state="NSW",
            management_type="NPWS",
            dog_friendly=True, # Initially wrong
            data_status="unverified"
        )
        fc_site = Campsite(
            name="Rule Test Forestry Camp",
            location="SRID=4326;POINT(150.8 -33.8)",
            state="NSW",
            management_type="Forestry Corporation NSW",
            dog_friendly=False, # Initially wrong
            fees=None,
            data_status="unverified"
        )
        db.add_all([npws_site, fc_site])
        db.commit()

        # Apply rules
        summary = apply_policy_rules(db)
        assert summary["campsites_updated"] >= 2

        # Verify NPWS rule derivation
        db.refresh(npws_site)
        assert npws_site.dog_friendly is False
        assert npws_site.data_status == DATA_STATUS_RULE_DERIVED
        assert "nationalparks.nsw.gov.au" in npws_site.evidence_url

        # Verify Forestry Corporation rule derivation
        db.refresh(fc_site)
        assert fc_site.dog_friendly is True
        assert fc_site.fees == "$0 (Free)"
        assert fc_site.data_status == DATA_STATUS_RULE_DERIVED
        assert "forestrycorporation.com.au" in fc_site.evidence_url

        # Clean up test rows
        db.delete(npws_site)
        db.delete(fc_site)
        db.commit()
