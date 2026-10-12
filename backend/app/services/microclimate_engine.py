import math
import logging
from datetime import date
from typing import Optional, List, Dict
import httpx

from app.schemas.weather import MicroclimateResponse, PhaseTelemetry

logger = logging.getLogger(__name__)

class MicroclimateEngine:
    """
    Microclimate Physics & Climatology Engine for Australian Campgrounds.
    Combines:
    1. Numerical weather forecasts (<=15 days) & Historical Climatology Normals (>15 days).
    2. Environmental Lapse Rate (-6.5°C per 1,000m elevation gain).
    3. Katabatic Cold-Air Valley Pooling (temperature inversion on valley bottoms).
    4. Maritime Coastal Moderation (<15km from ocean).
    5. 4-Phase Camping Diurnal Telemetry (Dawn, Midday, Dusk, Night) with equipment & fire safety derivations.
    """

    @staticmethod
    def is_sheltered_valley(name: Optional[str] = None, elevation_m: float = 0.0, lat: float = -33.8) -> bool:
        """
        Detects if a campsite is in a known sheltered mountain valley, gorge, or depression
        prone to nighttime katabatic drainage and cold-air pooling.
        """
        if not name:
            return elevation_m >= 350.0 and lat < -31.0

        valley_keywords = [
            "valley", "clearing", "hollow", "creek", "river", "glen", "basin", 
            "flats", "capertee", "megalong", "colo", "kangaroo", "bendeela"
        ]
        name_lower = name.lower()
        has_valley_kw = any(kw in name_lower for kw in valley_keywords)
        return has_valley_kw or (elevation_m >= 400.0)

    @staticmethod
    def calculate_distance_to_coast_km(longitude: float, latitude: float) -> float:
        """
        Approximates distance to eastern Australian coastline based on coastal coordinate bounds.
        """
        # Coastline longitude rough projection for NSW (-28 to -37 latitude)
        # At lat -28 (Tweed Heads): lon ~153.5
        # At lat -34 (Sydney): lon ~151.25
        # At lat -37 (Eden): lon ~149.9
        coast_lon = 153.5 - ((latitude - (-28.0)) / (-37.0 - (-28.0))) * (153.5 - 149.9)
        lon_diff = max(0.0, coast_lon - longitude)
        # 1 degree of longitude at ~33°S is approx 93 km
        return lon_diff * 93.0

    @classmethod
    def compute_microclimate(
        cls,
        latitude: float,
        longitude: float,
        target_date: date,
        elevation_m: float = 0.0,
        campsite_name: Optional[str] = None,
        campsite_id: Optional[int] = None,
        temp_max_base: float = 22.0,
        temp_min_base: float = 14.0,
        rain_prob_base: int = 15,
        expected_rain_base: float = 0.0,
        wind_speed_base: float = 16.0,
        uv_index_base: int = 6,
        forecast_type: str = "climatological_physics",
    ) -> MicroclimateResponse:
        """
        Applies atmospheric physics, terrain downscaling, and diurnal modeling
        to baseline meteorological figures.
        """
        day_of_year = target_date.timetuple().tm_yday
        dist_to_coast_km = cls.calculate_distance_to_coast_km(longitude, latitude)
        is_valley = cls.is_sheltered_valley(campsite_name, elevation_m, latitude)
        terrain_notes: List[str] = []

        # 1. Environmental Lapse Rate Correction
        # Temperature decreases ~6.5°C per 1,000m above sea level
        lapse_correction = 0.0
        if elevation_m > 30.0:
            lapse_correction = -1.0 * (elevation_m / 1000.0) * 6.5
            terrain_notes.append(
                f"Elevation Lapse Rate ({int(elevation_m)}m ASL): {lapse_correction:.1f}°C ambient cooling applied."
            )

        # 2. Maritime vs Continental Diurnal Range Adjustment
        diurnal_spread_mod = 0.0
        if dist_to_coast_km <= 15.0:
            diurnal_spread_mod = -1.5  # Maritime moderation: smaller day/night swing
            terrain_notes.append("Maritime Coastal Zone: Diurnal temperature swing buffered by ocean airflow.")
        elif dist_to_coast_km > 60.0:
            diurnal_spread_mod = 1.8   # Continental inland: wider day/night swing
            terrain_notes.append("Inland Continental Zone: Rapid radiational cooling after dusk.")

        # 3. Valley Inversion / Cold-Air Pooling Adjustment
        inversion_drop = 0.0
        if is_valley and (dist_to_coast_km > 10.0 or elevation_m > 200.0):
            inversion_drop = 2.5
            terrain_notes.append(
                "Valley Inversion / Katabatic Drainage: Sheltered topography traps nocturnal cold-air pool (+2.5°C chill at night)."
            )

        # Calculate final adjusted daily max and min
        adjusted_temp_max = round(temp_max_base + lapse_correction + (diurnal_spread_mod * 0.5), 1)
        adjusted_temp_min = round(temp_min_base + lapse_correction - (diurnal_spread_mod * 0.5) - inversion_drop, 1)

        # Ensure sensible physical bounds
        if adjusted_temp_max <= adjusted_temp_min:
            adjusted_temp_max = round(adjusted_temp_min + 4.0, 1)

        # 4. Diurnal 4-Phase Calculations
        # Phase 1: Dawn (06:00)
        dawn_temp = round(adjusted_temp_min + 0.3, 1)
        dawn_feels = round(dawn_temp - (1.5 if wind_speed_base > 15 else 0.5), 1)
        if dawn_temp <= 2.0:
            dawn_dew = "Severe Frost Risk"
            dawn_tip = "Ground frozen. Double-insulate tent floor; keep water and footwear inside tent."
        elif dawn_temp <= 8.0:
            dawn_dew = "Heavy Morning Dew"
            dawn_tip = "High condensation. Use groundsheet under tent floor and wipe down fly before packing."
        else:
            dawn_dew = "Mild Condensation"
            dawn_tip = "Normal moisture. Standard tent setup adequate."

        # Phase 2: Midday (13:00)
        midday_temp = adjusted_temp_max
        midday_wind = round(wind_speed_base * 1.15, 1)
        midday_feels = round(midday_temp + (1.5 if uv_index_base >= 8 else 0.0), 1)
        midday_tip = f"Peak solar intensity (UV {uv_index_base}). Minimum 4-5L water per person recommended. Pitch shade tarp."

        # Phase 3: Dusk (18:30)
        dusk_temp = round(adjusted_temp_min + 0.38 * (adjusted_temp_max - adjusted_temp_min), 1)
        dusk_wind = round(wind_speed_base * 0.85, 1)
        dusk_feels = round(dusk_temp - (1.0 if dusk_wind > 15 else 0.0), 1)
        if dusk_wind > 25.0:
            dusk_tip = "Brisk evening gusts. Maintain strict campfire clearance or use gas stove."
        else:
            dusk_tip = "Calm evening settling. Ideal conditions for camp dinner and quiet campfire."

        # Phase 4: Night (23:00)
        night_temp = round(adjusted_temp_min + (0.5 if not is_valley else -0.5), 1)
        night_wind = round(wind_speed_base * 0.6, 1)
        night_feels = round(night_temp - (1.5 if night_wind > 12 else 0.0), 1)
        night_tip = f"Overnight base chill ({night_temp}°C). Zip inner tent vents partially to balance airflow and heat retention."

        phases: Dict[str, PhaseTelemetry] = {
            "dawn": PhaseTelemetry(
                temperature=dawn_temp,
                feels_like=dawn_feels,
                wind_speed=round(wind_speed_base * 0.5, 1),
                humidity_or_dew=dawn_dew,
                condition_description="Dawn Chill & Ground Moisture",
                camper_tip=dawn_tip,
            ),
            "midday": PhaseTelemetry(
                temperature=midday_temp,
                feels_like=midday_feels,
                wind_speed=midday_wind,
                humidity_or_dew=f"Solar Peak (UV {uv_index_base})",
                condition_description="Solar Max & Thermal Peak",
                camper_tip=midday_tip,
            ),
            "dusk": PhaseTelemetry(
                temperature=dusk_temp,
                feels_like=dusk_feels,
                wind_speed=dusk_wind,
                humidity_or_dew="Rapid Radiative Cooling",
                condition_description="Twilight & Camp Transition",
                camper_tip=dusk_tip,
            ),
            "night": PhaseTelemetry(
                temperature=night_temp,
                feels_like=night_feels,
                wind_speed=night_wind,
                humidity_or_dew="Nocturnal Thermal Minimum",
                condition_description="Overnight Sleep Window",
                camper_tip=night_tip,
            ),
        }

        # 5. Equipment & Safety Derivations
        # Sleeping Bag Rating
        if adjusted_temp_min <= 0.0:
            sleeping_bag_rating = "-5°C Extreme Alpine Bag"
            mat_r = 4.5
        elif adjusted_temp_min <= 5.0:
            sleeping_bag_rating = "0°C Comfort-Rated Sleeping Bag"
            mat_r = 3.5
        elif adjusted_temp_min <= 11.0:
            sleeping_bag_rating = "5°C 3-Season Sleeping Bag"
            mat_r = 2.2
        else:
            sleeping_bag_rating = "15°C Summer Quilt / Light Bag"
            mat_r = 1.2

        # Dew & Frost Index
        if adjusted_temp_min <= 2.0:
            dew_frost_index = "Extreme Frost Risk — Frozen Ground Barrier Needed"
        elif adjusted_temp_min <= 8.0:
            dew_frost_index = "Heavy Condensation — Groundsheet & Fly Guying Essential"
        else:
            dew_frost_index = "Low Condensation — Standard Setup Adequate"

        # Campfire Wind Risk
        if wind_speed_base > 35.0:
            campfire_wind_risk = "Severe Hazard (>35 km/h) — No Open Flames (Embers carry 500m+)"
        elif wind_speed_base > 20.0:
            campfire_wind_risk = "Caution (20-35 km/h gusts) — Low fire only, clear 3m radius"
        else:
            campfire_wind_risk = "Low Wind Risk (<20 km/h) — Safe for Campfire (Check Park/TFB Rules)"

        # Peg Strain Factor
        if wind_speed_base > 35.0:
            peg_strain_factor = "High Peg Strain — Heavy-duty steel rock spikes & double guy-lines required"
        elif wind_speed_base > 20.0:
            peg_strain_factor = "Moderate Strain — Angle standard alloy pegs 45° away with taut lines"
        else:
            peg_strain_factor = "Low Strain — Standard tent pegs sufficient"

        from app.services.llm_inference import LLMInferenceService
        telemetry_summary_dict = {
            "campsite_name": campsite_name,
            "temp_max": adjusted_temp_max,
            "temp_min": adjusted_temp_min,
            "rain_probability": rain_prob_base,
            "expected_rainfall_mm": expected_rain_base,
            "wind_max_kmh": wind_speed_base,
            "sleeping_bag_rating": sleeping_bag_rating,
            "valley_inversion_active": bool(inversion_drop > 0),
            "campfire_wind_risk": campfire_wind_risk,
        }
        deterministic_ai_summary = LLMInferenceService.synthesize_weather_condition_summary_deterministic(telemetry_summary_dict)

        return MicroclimateResponse(
            latitude=latitude,
            longitude=longitude,
            date=target_date.isoformat(),
            day_of_year=day_of_year,
            elevation_m=elevation_m,
            campsite_id=campsite_id,
            campsite_name=campsite_name,
            forecast_type=forecast_type,
            temp_max=adjusted_temp_max,
            temp_min=adjusted_temp_min,
            rain_probability=rain_prob_base,
            expected_rainfall_mm=round(expected_rain_base, 1),
            wind_max_kmh=round(wind_speed_base, 1),
            uv_index_max=uv_index_base,
            phases=phases,
            sleeping_bag_rating=sleeping_bag_rating,
            recommended_mat_r_value=mat_r,
            dew_frost_index=dew_frost_index,
            campfire_wind_risk=campfire_wind_risk,
            peg_strain_factor=peg_strain_factor,
            valley_inversion_active=bool(inversion_drop > 0),
            terrain_notes=terrain_notes,
            ai_condition_summary=deterministic_ai_summary,
        )


    @classmethod
    def get_climatological_baseline(cls, latitude: float, longitude: float, target_date: date) -> Dict[str, float]:
        """
        Analytical climatological baseline model for Australia.
        Calculates seasonal temperature cycles and median precipitation expectations
        by day-of-year and latitude.
        """
        doy = target_date.timetuple().tm_yday
        # Southern Hemisphere solar cycle: peak heating ~DOY 15 (Jan 15), coldest ~DOY 196 (Jul 15)
        solar_angle = 2.0 * math.pi * (doy - 15) / 365.25
        cos_solar = math.cos(solar_angle)

        # Baseline mean temperature by latitude:
        # Tropics (-12° lat) ~ 28°C; Subtropics (-28° lat) ~ 21°C; Temperate (-34° lat) ~ 17°C; Alpine/Tas (-42° lat) ~ 11°C
        lat_clamped = min(-10.0, max(-44.0, latitude))
        annual_mean_temp = 28.0 - (abs(lat_clamped) - 10.0) * 0.52

        # Seasonal amplitude increases with latitude (equator has low amplitude, southern NSW/Vic/Tas has large amplitude)
        seasonal_amplitude = 3.5 + (abs(lat_clamped) - 10.0) * 0.22

        daily_mean = annual_mean_temp + seasonal_amplitude * cos_solar
        diurnal_half_range = 5.0 + (abs(lat_clamped) - 20.0) * 0.08

        temp_max = round(daily_mean + diurnal_half_range, 1)
        temp_min = round(daily_mean - diurnal_half_range, 1)

        # Rain likelihood: in southern/coastal NSW, late summer/autumn has higher rain frequency
        rain_prob = int(20 + 15 * max(0.0, cos_solar))
        expected_rain = round(1.5 + (rain_prob / 30.0), 1) if rain_prob > 25 else 0.0

        # Wind & UV Index seasonal distribution
        wind_speed = round(14.0 + 4.0 * max(0.0, cos_solar), 1)
        uv_index = max(2, min(12, int(6 + 5 * cos_solar)))

        return {
            "temp_max": temp_max,
            "temp_min": temp_min,
            "rain_prob": rain_prob,
            "expected_rain": expected_rain,
            "wind_speed": wind_speed,
            "uv_index": uv_index,
        }

    @classmethod
    def get_forecast(
        cls,
        latitude: float,
        longitude: float,
        target_date: date,
        elevation_m: Optional[float] = None,
        campsite_name: Optional[str] = None,
        campsite_id: Optional[int] = None,
        timeout: float = 3.5,
    ) -> MicroclimateResponse:
        """
        Fetches live numerical weather prediction (if within 16-day window)
        or calculates high-precision climatology (if > 15 days out),
        then applies microclimate physics downscaling.
        """
        today = date.today()
        diff_days = (target_date - today).days

        # Default elevation estimation if not passed
        elev = elevation_m if elevation_m is not None else 80.0

        # 1. Check if within 16-day numerical weather prediction window
        if 0 <= diff_days <= 15:
            try:
                url = (
                    f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}"
                    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
                    f"precipitation_sum,windspeed_10m_max,uv_index_max&forecast_days=16&timezone=auto"
                )
                with httpx.Client(timeout=timeout) as client:
                    resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json().get("daily", {})
                    times = data.get("time", [])
                    if diff_days < len(times):
                        t_max = data.get("temperature_2m_max", [])[diff_days]
                        t_min = data.get("temperature_2m_min", [])[diff_days]
                        r_prob = data.get("precipitation_probability_max", [])[diff_days] or 0
                        r_sum = data.get("precipitation_sum", [])[diff_days] or 0.0
                        w_speed = data.get("windspeed_10m_max", [])[diff_days] or 15.0
                        uv = data.get("uv_index_max", [])[diff_days] or 6

                        if t_max is not None and t_min is not None:
                            return cls.compute_microclimate(
                                latitude=latitude,
                                longitude=longitude,
                                target_date=target_date,
                                elevation_m=elev,
                                campsite_name=campsite_name,
                                campsite_id=campsite_id,
                                temp_max_base=float(t_max),
                                temp_min_base=float(t_min),
                                rain_prob_base=int(r_prob),
                                expected_rain_base=float(r_sum),
                                wind_speed_base=float(w_speed),
                                uv_index_base=int(uv),
                                forecast_type="numerical_ensemble",
                            )
            except Exception as e:
                logger.warning("Open-Meteo live numerical query failed: %s. Using climatology.", e)

        # 2. Beyond 16 days OR fallback: Climatological distribution
        baseline = cls.get_climatological_baseline(latitude, longitude, target_date)
        return cls.compute_microclimate(
            latitude=latitude,
            longitude=longitude,
            target_date=target_date,
            elevation_m=elev,
            campsite_name=campsite_name,
            campsite_id=campsite_id,
            temp_max_base=baseline["temp_max"],
            temp_min_base=baseline["temp_min"],
            rain_prob_base=int(baseline["rain_prob"]),
            expected_rain_base=baseline["expected_rain"],
            wind_speed_base=baseline["wind_speed"],
            uv_index_base=int(baseline["uv_index"]),
            forecast_type="climatological_physics",
        )

    @classmethod
    async def get_forecast_async(
        cls,
        latitude: float,
        longitude: float,
        target_date: date,
        elevation_m: Optional[float] = None,
        campsite_name: Optional[str] = None,
        campsite_id: Optional[int] = None,
        timeout: float = 3.5,
    ) -> MicroclimateResponse:
        """
        Asynchronously fetches microclimate forecast and enhances with Qwen3-9B AI camping synthesis.
        """
        forecast = cls.get_forecast(
            latitude=latitude,
            longitude=longitude,
            target_date=target_date,
            elevation_m=elevation_m,
            campsite_name=campsite_name,
            campsite_id=campsite_id,
            timeout=timeout,
        )

        from app.services.llm_inference import LLMInferenceService
        telemetry = {
            "campsite_name": forecast.campsite_name,
            "temp_max": forecast.temp_max,
            "temp_min": forecast.temp_min,
            "rain_probability": forecast.rain_probability,
            "expected_rainfall_mm": forecast.expected_rainfall_mm,
            "wind_max_kmh": forecast.wind_max_kmh,
            "sleeping_bag_rating": forecast.sleeping_bag_rating,
            "valley_inversion_active": forecast.valley_inversion_active,
            "campfire_wind_risk": forecast.campfire_wind_risk,
        }
        ai_briefing = await LLMInferenceService.synthesize_weather_condition_summary(telemetry)
        if ai_briefing:
            forecast.ai_condition_summary = ai_briefing

        return forecast

