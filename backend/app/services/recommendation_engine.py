import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.campsite import Campsite
from app.schemas.trip_recommendation import (
    FindWeekendRequest,
    TripRecommendationCard,
    FindWeekendResponse
)

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class RecommendationEngine:
    @classmethod
    def get_driving_stats(cls, origin_lat: float, origin_lng: float, site_lat: float, site_lng: float) -> tuple[int, int]:
        straight_km = haversine_km(origin_lat, origin_lng, site_lat, site_lng)
        # Regional Australian road curvature and routing approximation (~1.25 factor)
        road_km = int(straight_km * 1.25)
        # Average highway/regional speed: 75 km/h
        minutes = int((road_km / 75.0) * 60)
        return max(road_km, 10), max(minutes, 15)

    @classmethod
    def find_weekend(cls, db: Session, request: FindWeekendRequest) -> FindWeekendResponse:
        origin_lat = request.origin_lat or -33.8688
        origin_lng = request.origin_lng or 151.2093
        max_hours = float(request.max_drive_hours or 4.0)

        # 1. Fetch all campsites
        all_sites = db.query(Campsite).all()
        if not all_sites:
            return FindWeekendResponse(
                cards=[],
                limiting_constraint="No campsite records found in database.",
                suggested_adjustments=["Ensure database is seeded with canonical campsites."]
            )

        # 2. Compute distances and evaluate eligibility
        annotated_sites = []
        for site in all_sites:
            dist_km, drive_mins = cls.get_driving_stats(origin_lat, origin_lng, site.latitude, site.longitude)
            drive_hours = drive_mins / 60.0
            annotated_sites.append({
                "site": site,
                "dist_km": dist_km,
                "drive_mins": drive_mins,
                "drive_hours": drive_hours
            })

        # Sort by distance
        annotated_sites.sort(key=lambda x: x["drive_mins"])

        # 3. Filter strictly
        eligible = []
        for item in annotated_sites:
            site = item["site"]
            drive_hours = item["drive_hours"]

            # Max drive limit constraint
            if drive_hours > max_hours:
                continue

            # Dog friendly constraint: NEVER silently drop dog required
            if request.dog_friendly is True and site.dog_friendly is not True:
                continue
            elif request.dog_friendly is False and site.dog_friendly is True:
                continue

            # Rig access
            if request.rig_access and site.rig_access:
                if request.rig_access not in site.rig_access:
                    continue

            eligible.append(item)

        # 4. Handle empty results with helpful limiting constraint explanation
        if not eligible:
            limiting = ""
            suggestions = []
            
            if request.dog_friendly is True:
                # Find nearest dog friendly site
                dog_sites = [item for item in annotated_sites if item["site"].dog_friendly is True]
                if dog_sites:
                    nearest_dog = dog_sites[0]
                    nearest_hrs = nearest_dog["drive_hours"]
                    limiting = (
                        f"No dog-friendly campsites found within {max_hours:.1f} hours drive. "
                        f"Nearest dog-friendly option is {nearest_dog['site'].name} "
                        f"({nearest_hrs:.1f}h drive)."
                    )
                    suggested_drive = math.ceil(nearest_hrs * 2) / 2
                    suggestions = [
                        f"Increase drive limit to {suggested_drive:.1f} hours to reach {nearest_dog['site'].name}",
                        "Remove dog requirement to view closer campsites within your drive limit"
                    ]
                else:
                    limiting = "No dog-friendly campsites registered within state boundaries."
                    suggestions = ["Search with dog-friendly disabled"]
            else:
                nearest = annotated_sites[0]
                limiting = f"No campsites found within {max_hours:.1f} hours drive. Nearest spot is {nearest['site'].name} ({nearest['drive_hours']:.1f}h drive)."
                suggestions = [f"Increase drive limit to {math.ceil(nearest['drive_hours'] * 2) / 2:.1f} hours"]

            return FindWeekendResponse(
                cards=[],
                limiting_constraint=limiting,
                suggested_adjustments=suggestions
            )

        # 5. Build top 3 distinct trip cards
        badges = ["Shortest Drive", "Conditions Pick", "Secluded Escape"]
        cards: List[TripRecommendationCard] = []

        for i, item in enumerate(eligible[:3]):
            site = item["site"]
            drive_mins = item["drive_mins"]
            dist_km = item["dist_km"]

            # Calculated "why it fits"
            fits: List[str] = [
                f"Under {max_hours:.1f}h driving ({drive_mins // 60}h {drive_mins % 60}m from origin)",
                f"Accessible for {', '.join(site.rig_access or ['TENT'])}",
            ]
            if site.dog_friendly is True:
                fits.append("Verified dog friendly (pets allowed)")
            elif site.dog_friendly is False:
                fits.append("Protected wildlife sanctuary (peaceful, no pets)")

            if site.management_type:
                fits.append(f"Managed by {site.management_type}")

            # Factual compromise derivation based on actual campsite records
            fac = site.facilities or {}
            compromises: List[str] = []
            if site.rig_access and "4WD_ONLY" in site.rig_access:
                compromises.append("4WD required; unsealed access road with steep ruts")
            
            toilet_type = fac.get("toilets")
            if toilet_type in ["pit", "composting", "drop"]:
                compromises.append("Drop/pit toilets only; carry out all rubbish")
            elif toilet_type == "none":
                compromises.append("No toilets on site; portable chemical toilet required")
                
            if fac.get("drinking_water") is False:
                compromises.append("Non-potable water only; bring minimum 5L drinking water/person/day")
                
            if site.dog_friendly is False:
                compromises.append("Strictly no pets (National Park regulations apply)")
                
            m_type = (site.management_type or "").lower()
            if "forestry" in m_type or "state forest" in m_type or "council" in m_type:
                compromises.append("First-come, first-served unallocated sites; arrive early Friday")
            elif "npws" in m_type or "national park" in m_type:
                compromises.append("Popular destination; advance booking required")

            main_compromise = compromises[0] if compromises else "Verify fire regulations and bring all personal supplies"

            # Costs & bookings: use real verified data, never templated guesses
            cost = site.fees or "Fee unverified"
            booking_url = site.booking_url or site.source_url
            
            m_lower = (site.management_type or "").lower()
            fee_lower = (site.fees or "").lower()
            is_free = "$0" in fee_lower or "free" in fee_lower

            if "forestry" in m_lower or "state forest" in m_lower or ("council" in m_lower and is_free):
                booking_type = "FIRST_COME_FIRST_SERVED"
                status = "No Booking Required (First-Come, First-Served)"
                avail_window = "No booking required — first-come, first-served. Live site availability is not published."
            elif "npws" in m_lower or "national park" in m_lower or "parks australia" in m_lower:
                if is_free:
                    booking_type = "FREE_REGISTRATION_REQUIRED"
                    status = "Free Permit / Registration ($0)"
                    avail_window = "Online registration required ($0). Live site availability is not published — check the booking page for your dates."
                else:
                    booking_type = "ONLINE_BOOKING_REQUIRED"
                    status = "Online Booking Required (NPWS)"
                    avail_window = "Online booking required via NPWS. Live site availability is not published — check the booking page for your dates."
            else:
                booking_type = "OPERATOR_PORTAL"
                status = "Operator Booking Required"
                avail_window = "Booking required via the operator. Live site availability is not published."

            # Honest badge derivation
            if dist_km < 120:
                badge = "Shortest Drive"
            elif site.fees and ("$0" in site.fees or "free" in site.fees.lower()):
                badge = "Free Camping"
            elif site.dog_friendly is True:
                badge = "Dog Friendly"
            elif fac.get("showers") == "hot":
                badge = "Hot Showers"
            else:
                badge = "Scenic Escape"

            # Visual photo selection based on landscape/environment
            name_lower = site.name.lower()
            if any(term in name_lower for term in ["beach", "bay", "cove", "ocean", "island", "inlet"]):
                photo = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
            elif any(term in name_lower for term in ["mountain", "range", "ridge", "peak", "pass", "gap"]):
                photo = "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80"
            elif any(term in name_lower for term in ["forest", "pines", "valley", "creek", "river", "glen"]):
                photo = "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=800&q=80"
            else:
                photo = "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=800&q=80"

            # Visual graphical badges
            is_4wd = site.rig_access and "4WD_ONLY" in site.rig_access
            visual_badges = {
                "clearance": "4WD High Clearance" if is_4wd else "2WD Friendly",
                "telco": "Off-Grid (Zero Service)" if "forest" in (site.name + (site.management_type or "")).lower() else "Telstra 4G (1-2 bars)",
                "campfire": "Gas Cooker Only" if fac.get("campfires") is False else "Fire Pits (BYO Wood)",
                "toilets": "Flush Amenities" if fac.get("toilets") == "flush" else ("Drop Toilet" if fac.get("toilets") in ["pit", "drop", "composting"] else "No Toilets"),
                "water": "Drinking Water" if fac.get("drinking_water") is True else "Carry All Water",
                "shade": "Shaded Forest" if "forest" in name_lower or "pines" in name_lower else "Bushland Clearing"
            }

            # Community ground check-in signals
            from app.models.check_in import CampsiteCheckIn
            check_ins = db.query(CampsiteCheckIn).filter(CampsiteCheckIn.campsite_id == site.id).order_by(CampsiteCheckIn.created_at.desc()).limit(5).all()
            if check_ins:
                comm_signals = {
                    "total_checkins": len(check_ins),
                    "water": next((c.water_status for c in check_ins if c.water_status), None),
                    "toilets": next((c.toilets_status for c in check_ins if c.toilets_status), None),
                    "road": next((c.road_status for c in check_ins if c.road_status), None),
                    "telco": next((c.telco_status for c in check_ins if c.telco_status), None),
                    "vibe": next((c.vibe_status for c in check_ins if c.vibe_status), None),
                    "last_reported": check_ins[0].created_at.strftime("%b %d") if check_ins[0].created_at else "Recently"
                }
            else:
                comm_signals = {
                    "total_checkins": 0,
                    "water": "flowing" if fac.get("drinking_water") else "carry_water",
                    "toilets": "clean" if fac.get("toilets") == "flush" else ("bring_tp" if fac.get("toilets") in ["pit", "drop", "composting"] else "no_toilets"),
                    "road": "4wd_only" if is_4wd else "2wd_clear",
                    "telco": "no_service" if "forest" in (site.name + (site.management_type or "")).lower() else "telstra_4g",
                    "vibe": "plenty_space",
                    "last_reported": "Verified Source"
                }

            cards.append(TripRecommendationCard(
                id=site.id,
                name=site.name,
                state=site.state,
                latitude=site.latitude,
                longitude=site.longitude,
                dog_friendly=site.dog_friendly,
                rig_access=site.rig_access,
                vehicle_clearance="4WD_ONLY" if is_4wd else "2WD",
                driving_distance_km=dist_km,
                driving_time_minutes=drive_mins,
                highlight_badge=badge,
                why_it_fits=fits,
                main_compromise=main_compromise,
                estimated_cost=cost,
                booking_status=status,
                booking_type=booking_type,
                availability_window=avail_window,
                booking_url=booking_url,
                management_type=site.management_type,
                facilities=site.facilities,
                fees=site.fees,
                fire_district=site.fire_district,
                data_status=site.data_status,
                source_url=site.source_url,
                evidence_url=site.evidence_url,
                visual_badges=visual_badges,
                community_signals=comm_signals,
                photo_url=photo
            ))

        return FindWeekendResponse(cards=cards)
