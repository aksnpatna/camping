from datetime import datetime, timezone
from typing import Optional, List
from app.models.campsite import Campsite, DATA_STATUS_VERIFIED
from app.models.check_in import CampsiteCheckIn
from app.schemas.facts import Fact, CampsiteFacts

class FactBuilder:
    @staticmethod
    def build_campsite_facts(
        site: Campsite,
        check_ins: Optional[List[CampsiteCheckIn]] = None,
        drive_minutes: Optional[int] = None,
    ) -> CampsiteFacts:
        as_of_str: Optional[str] = None
        if site.source_modified_at:
            as_of_str = site.source_modified_at.isoformat()
        elif site.verified_at:
            as_of_str = site.verified_at.strftime("%Y-%m-%d")

        is_site_verified = getattr(site, "data_status", None) == DATA_STATUS_VERIFIED

        # Community check-ins: truth decays after 14 days
        now = datetime.now(timezone.utc)
        def _to_utc(dt: datetime) -> datetime:
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

        fresh_check_ins = [
            c for c in (check_ins or [])
            if c.created_at and (now - _to_utc(c.created_at)).days <= 14
        ]
        latest_check_in = fresh_check_ins[0] if fresh_check_ins else None

        fac = site.facilities or {}

        # 1. DOG FRIENDLY
        if site.dog_friendly is None:
            dog_fact = Fact.unknown(note="Pet policy unconfirmed — check with local ranger")
        elif site.dog_friendly is False and site.state == "NSW" and (
            "National Park" in (site.management_type or "") or "NPWS" in (site.management_type or "")
        ):
            dog_fact = Fact(
                value=False,
                basis="rule",
                confidence=3,
                source="NSW National Parks and Wildlife Act 1974",
                url="https://www.nationalparks.nsw.gov.au/safety/pets-in-parks",
                note="Dogs not permitted in NSW National Parks (statutory policy)",
                as_of=as_of_str
            )
        elif site.dog_friendly is False and site.state == "VIC" and (
            "National Park" in (site.management_type or "") or "Parks Victoria" in (site.management_type or "")
        ):
            dog_fact = Fact(
                value=False,
                basis="rule",
                confidence=3,
                source="Parks Victoria Regulations",
                url="https://www.parks.vic.gov.au",
                note="Dogs not permitted in Victorian National Parks (statutory policy)",
                as_of=as_of_str
            )
        elif is_site_verified:
            dog_fact = Fact(
                value=site.dog_friendly,
                basis="verified",
                confidence=3,
                source=site.source_url or "Field Verified",
                url=site.source_url,
                note="Pet policy confirmed in verified dataset",
                as_of=as_of_str
            )
        else:
            dog_fact = Fact(
                value=site.dog_friendly,
                basis="official" if site.source_url else "rule",
                confidence=2,
                source=site.source_url or f"{site.management_type or 'Land manager'} record",
                url=site.source_url,
                note="Pet policy recorded in land manager database",
                as_of=as_of_str
            )

        # 2. CAMPFIRES
        cf = fac.get("campfires")
        if cf is None:
            campfire_fact = Fact.unknown(note="Campfire regulations unverified — check fire danger rating and park signs")
        elif is_site_verified:
            campfire_fact = Fact(
                value=bool(cf),
                basis="verified",
                confidence=3,
                source=site.source_url or "Field Verified",
                url=site.source_url,
                note="Campfire facilities verified",
                as_of=as_of_str
            )
        else:
            campfire_fact = Fact(
                value=bool(cf),
                basis="official" if site.source_url else "rule",
                confidence=2,
                source=site.source_url or "Park facilities record",
                url=site.source_url,
                note="Campfire allowance from park dataset",
                as_of=as_of_str
            )

        # 3. TOILETS
        t = fac.get("toilets")
        if t is not None:
            basis_val = "verified" if is_site_verified else "official"
            conf = 3 if is_site_verified else 2
            toilet_fact = Fact(
                value=str(t),
                basis=basis_val,
                confidence=conf,
                source=site.source_url or "Park facilities record",
                url=site.source_url,
                note=f"Toilet facilities: {t}",
                as_of=as_of_str
            )
        elif latest_check_in and latest_check_in.toilets_status:
            toilet_fact = Fact(
                value=str(latest_check_in.toilets_status),
                basis="community",
                confidence=2,
                source="Recent camper check-in",
                as_of=latest_check_in.created_at.strftime("%Y-%m-%d"),
                note=f"Recent report ({latest_check_in.toilets_status})"
            )
        else:
            toilet_fact = Fact.unknown(note="Toilet facilities unverified — carry necessary hygiene supplies")

        # 4. WATER
        dw = fac.get("drinking_water")
        if dw is not None:
            basis_val = "verified" if is_site_verified else "official"
            conf = 3 if is_site_verified else 2
            val = "drinking" if dw else "carry_in"
            water_fact = Fact(
                value=val,
                basis=basis_val,
                confidence=conf,
                source=site.source_url or "Park facilities record",
                url=site.source_url,
                note="Drinking water available" if dw else "Untreated or no water — carry all water",
                as_of=as_of_str
            )
        elif latest_check_in and latest_check_in.water_status:
            water_fact = Fact(
                value=str(latest_check_in.water_status),
                basis="community",
                confidence=2,
                source="Recent camper check-in",
                as_of=latest_check_in.created_at.strftime("%Y-%m-%d"),
                note=f"Recent water observation: {latest_check_in.water_status}"
            )
        else:
            water_fact = Fact.unknown(note="Water availability unverified — carry all drinking water")

        # 5. VEHICLE ACCESS
        vehicle_clearance = getattr(site, "vehicle_clearance", None)
        rig_access = site.rig_access or []
        if "4WD_ONLY" in rig_access or "4WD" in rig_access or vehicle_clearance == "4WD_ONLY":
            access_fact = Fact(
                value="4WD_ONLY",
                basis="official" if site.source_url else "rule",
                confidence=2,
                source=site.source_url or "Park access dataset",
                note="High clearance 4WD required"
            )
        elif rig_access:
            access_fact = Fact(
                value="2WD_ACCESSIBLE",
                basis="official" if site.source_url else "rule",
                confidence=2,
                source=site.source_url or "Park access dataset",
                note="Accessible by standard 2WD vehicles"
            )
        else:
            access_fact = Fact.unknown(note="Track clearance and access unverified")

        # 6. TELCO
        tel = fac.get("telco")
        if tel:
            telco_fact = Fact(
                value=str(tel),
                basis="official",
                confidence=2,
                source=site.source_url,
                note=f"Carrier coverage: {tel}"
            )
        elif latest_check_in and latest_check_in.telco_status:
            telco_fact = Fact(
                value=str(latest_check_in.telco_status),
                basis="community",
                confidence=2,
                source="Recent camper check-in",
                as_of=latest_check_in.created_at.strftime("%Y-%m-%d"),
                note=f"Reported carrier status: {latest_check_in.telco_status}"
            )
        else:
            telco_fact = Fact.unknown(note="Mobile reception unverified — download offline maps before travel")

        # 7. FEES
        if site.fees:
            basis_val = "verified" if is_site_verified else "official"
            conf = 3 if is_site_verified else 2
            fees_fact = Fact(
                value=site.fees,
                basis=basis_val,
                confidence=conf,
                source=site.source_url or "Park fee schedule",
                note=f"Camping fee: {site.fees}",
                as_of=as_of_str
            )
        else:
            fees_fact = Fact.unknown(note="Camping fees unverified — park entry permit may apply")

        # 8. FIRE STATUS / DISTRICT
        if site.fire_district:
            fire_fact = Fact(
                value=site.fire_district,
                basis="official",
                confidence=2,
                source="State Fire Service District Mapping",
                note=f"Official Fire District: {site.fire_district}"
            )
        else:
            fire_fact = Fact.unknown(note="Fire district unmapped — verify Total Fire Ban status independently")

        # 9. DRIVING TIME
        if drive_minutes is not None:
            drive_fact = Fact(
                value=drive_minutes,
                basis="estimate",
                confidence=1,
                note="Estimated driving duration from selected origin (haversine ~1.25x road factor)"
            )
        else:
            drive_fact = Fact.unknown(note="Drive time requires a selected departure location")

        return CampsiteFacts(
            dog_friendly=dog_fact,
            campfires=campfire_fact,
            toilets=toilet_fact,
            water=water_fact,
            vehicle_access=access_fact,
            telco=telco_fact,
            fees=fees_fact,
            fire_status=fire_fact,
            driving_time=drive_fact
        )
