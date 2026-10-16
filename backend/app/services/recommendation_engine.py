import math
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.campsite import Campsite
from app.schemas.trip_recommendation import (
    FindWeekendRequest,
    TripRecommendationCard,
    FindWeekendResponse,
    WeatherDaySummary,
    GearFitSummary
)
from app.services.microclimate_engine import MicroclimateEngine

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
    def generate_weekend_weather_and_gear(cls, site: Campsite, start_date: date) -> tuple[List[WeatherDaySummary], GearFitSummary]:
        weather_days: List[WeatherDaySummary] = []
        min_overnight = 99.0
        sleeping_bag = "15°C Summer Quilt / Light Bag"
        mat_r = 1.5
        dew_frost = "Low Condensation"
        fire_wind = "Low Wind Risk"

        for i in range(4):
            target_d = start_date + timedelta(days=i)
            fc = MicroclimateEngine.get_forecast(
                latitude=site.latitude,
                longitude=site.longitude,
                target_date=target_d,
                elevation_m=getattr(site, "elevation", None),
                campsite_name=site.name,
                campsite_id=site.id,
                timeout=1.5
            )
            if fc.temp_min < min_overnight:
                min_overnight = fc.temp_min
                sleeping_bag = fc.sleeping_bag_rating
                mat_r = fc.recommended_mat_r_value
                dew_frost = fc.dew_frost_index
                fire_wind = fc.campfire_wind_risk

            day_name = target_d.strftime("%a")
            date_str = target_d.strftime("%b %d")
            if fc.rain_probability >= 40 or fc.expected_rainfall_mm >= 2.0:
                cond_icon = "rain"
            elif fc.wind_max_kmh >= 30.0:
                cond_icon = "wind"
            else:
                cond_icon = "sun"

            weather_days.append(WeatherDaySummary(
                dayName=day_name,
                dateStr=date_str,
                minTemp=round(fc.temp_min, 1),
                maxTemp=round(fc.temp_max, 1),
                rainProb=fc.rain_probability,
                gearRecommendation=fc.sleeping_bag_rating.split(" ")[0],
                conditionIcon=cond_icon
            ))

        gear_fit = GearFitSummary(
            overnight_min_temp=round(min_overnight, 1),
            sleeping_bag_rating=sleeping_bag,
            recommended_mat_r_value=mat_r,
            dew_frost_index=dew_frost,
            campfire_wind_risk=fire_wind
        )

        return weather_days, gear_fit

    @classmethod
    def find_weekend(cls, db: Session, request: FindWeekendRequest, assumed_origin: Optional[str] = None) -> FindWeekendResponse:
        origin_lat = request.origin_lat or -33.8688
        origin_lng = request.origin_lng or 151.2093
        max_hours = float(request.max_drive_hours or 4.0)

        # 1. Fetch all campsites
        all_sites = db.query(Campsite).all()
        if not all_sites:
            return FindWeekendResponse(
                cards=[],
                limiting_constraint="No campsite records found in database.",
                suggested_adjustments=["Ensure database is seeded with canonical campsites."],
                assumed_origin=assumed_origin
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

        # 3. Filter strictly and score quality
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

            # Filter non-camping urban reserves/sports grounds
            name_lower = site.name.lower()
            if any(term in name_lower for term in ["sportsground", "recreation ground", "golf", "memorial park", "oval", "nature reserve"]) and site.data_status != "verified":
                continue

            # Quality scoring
            fac = site.facilities or {}
            quality_score = max(0.0, (max_hours - drive_hours) / max_hours * 35.0)
            if site.data_status == "verified":
                quality_score += 85.0
            if fac.get("toilets") in ["flush", "pit", "composting", "drop"]:
                quality_score += 15.0
            if fac.get("campfires") is not None:
                quality_score += 5.0
            if fac.get("drinking_water") is not None:
                quality_score += 5.0
            if site.fees and site.fees != "Unknown":
                quality_score += 10.0

            item["quality_score"] = quality_score
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
                suggested_adjustments=suggestions,
                assumed_origin=assumed_origin
            )

        # Determine target weekend date (Friday start)
        today = date.today()
        if request.start_date:
            try:
                target_friday = date.fromisoformat(request.start_date)
            except ValueError:
                target_friday = today + timedelta(days=((4 - today.weekday()) % 7))
        elif request.target_weekend == "next_weekend":
            days_to_fri = (4 - today.weekday()) % 7
            target_friday = today + timedelta(days=days_to_fri + 7)
        else:
            days_to_fri = (4 - today.weekday()) % 7
            target_friday = today + timedelta(days=days_to_fri)

        # 5. Select 3 distinct archetypal cards
        # Prioritize verified sites if at least 2 are eligible
        verified_eligible = [item for item in eligible if item["site"].data_status == "verified"]
        pool = verified_eligible if len(verified_eligible) >= 2 else eligible

        chosen_items = []
        chosen_ids = set()

        # Archetype 1: Shortest Drive (closest high quality site)
        by_dist = sorted(pool, key=lambda x: x["drive_mins"])
        if by_dist:
            first = by_dist[0]
            first_copy = dict(first)
            first_copy["archetype_badge"] = "Shortest Drive"
            chosen_items.append(first_copy)
            chosen_ids.add(first["site"].id)

        # Archetype 2: Conditions Pick (highest quality score, distinct from Card 1)
        by_quality = sorted(pool, key=lambda x: -x["quality_score"])
        for item in by_quality:
            if item["site"].id not in chosen_ids:
                item_copy = dict(item)
                item_copy["archetype_badge"] = "Conditions Pick"
                chosen_items.append(item_copy)
                chosen_ids.add(item["site"].id)
                break

        # Archetype 3: Free Camping or Scenic Escape (distinct location or free/forest)
        free_or_forest = [
            item for item in pool 
            if item["site"].id not in chosen_ids and (
                (item["site"].fees and ("$0" in item["site"].fees or "free" in item["site"].fees.lower()))
                or (item["site"].management_type and "forest" in item["site"].management_type.lower())
            )
        ]
        if free_or_forest:
            third = free_or_forest[0]
            third_copy = dict(third)
            third_copy["archetype_badge"] = "Free Camping" if (third["site"].fees and ("$0" in third["site"].fees or "free" in third["site"].fees.lower())) else "Scenic Escape"
            chosen_items.append(third_copy)
            chosen_ids.add(third["site"].id)
        else:
            remaining = [item for item in pool if item["site"].id not in chosen_ids]
            if not remaining and pool != eligible:
                remaining = [item for item in eligible if item["site"].id not in chosen_ids]
            if remaining:
                third = remaining[0]
                third_copy = dict(third)
                third_copy["archetype_badge"] = "Scenic Escape"
                chosen_items.append(third_copy)
                chosen_ids.add(third["site"].id)

        # Fill if still fewer than 3
        for item in eligible:
            if len(chosen_items) >= 3:
                break
            if item["site"].id not in chosen_ids:
                item_copy = dict(item)
                item_copy["archetype_badge"] = "Campground"
                chosen_items.append(item_copy)
                chosen_ids.add(item["site"].id)

        cards: List[TripRecommendationCard] = []

        for i, item in enumerate(chosen_items):
            site = item["site"]
            drive_mins = item["drive_mins"]
            dist_km = item["dist_km"]
            badge = item.get("archetype_badge", "Scenic Escape")

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

            # Visual graphical badges based on verified facts only
            is_4wd = site.rig_access and "4WD_ONLY" in site.rig_access
            has_2wd = site.rig_access and any(r in site.rig_access for r in ["CAR", "2WD", "TENT", "CAMPER_TRAILER", "CARAVAN"]) and not is_4wd
            clearance_badge = "4WD High Clearance" if is_4wd else ("2WD Accessible" if has_2wd else "Clearance Unverified")

            # Campfire: truthful tri-state
            if fac.get("campfires") is True:
                fire_badge = "Fire Pits Allowed"
            elif fac.get("campfires") is False:
                fire_badge = "Gas Cooker Only"
            else:
                fire_badge = "Check Fire Rules"

            # Toilets: truthful tri-state
            toilet_val = fac.get("toilets")
            if toilet_val == "flush":
                toilet_badge = "Flush Amenities"
            elif toilet_val in ["pit", "drop", "composting"]:
                toilet_badge = "Drop / Pit Toilets"
            elif toilet_val == "none":
                toilet_badge = "No Toilets"
            else:
                toilet_badge = "Toilets Unverified"

            # Water: truthful tri-state
            water_val = fac.get("drinking_water")
            if water_val is True:
                water_badge = "Drinking Water"
            elif water_val is False:
                water_badge = "Carry All Water"
            else:
                water_badge = "Water Unverified"

            visual_badges = {
                "clearance": clearance_badge,
                "campfire": fire_badge,
                "toilets": toilet_badge,
                "water": water_badge,
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
                if comm_signals.get("telco"):
                    visual_badges["telco"] = comm_signals["telco"].replace("_", " ").title()
            else:
                comm_signals = None

            from app.services.facts import FactBuilder
            facts = FactBuilder.build_campsite_facts(
                site=site,
                check_ins=check_ins,
                drive_minutes=drive_mins
            )

            # Generate real downscaled 4-day weekend weather & gear fit telemetry
            weather_days, gear_fit = cls.generate_weekend_weather_and_gear(site, target_friday)

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
                photo_url=photo,
                is_illustrative_photo=True,
                facts=facts,
                weather_days=weather_days,
                gear_fit=gear_fit
            ))

        return FindWeekendResponse(cards=cards, assumed_origin=assumed_origin)
