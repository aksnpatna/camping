"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  MapPin, 
  X, 
  Dog, 
  Car, 
  ExternalLink, 
  Navigation, 
  Compass,
  Shuffle,
  Flame,
  Droplets,
  Layers,
  Wifi
} from "lucide-react";
import type { Campsite } from "./Map";
import { getApiUrl } from "@/config";
import FuturisticWeatherHUD, { type WeatherHUDData } from "./FuturisticWeatherHUD";
import GroundCheckInModal from "./GroundCheckInModal";
import ConfidenceMeter from "./trust/ConfidenceMeter";
import FactChip from "./trust/FactChip";
import FireStrip from "./trust/FireStrip";
import SourceSheet from "./trust/SourceSheet";
import WhyItFitsRadar from "./graphics/WhyItFitsRadar";
import WeekendWeatherRibbon from "./graphics/WeekendWeatherRibbon";
import PlanBModal from "./trust/PlanBModal";
import { CampsiteFacts, Fact } from "@/types/facts";
import { TripCardData } from "./FindWeekendPlanner";

type WeatherData = WeatherHUDData;

interface CamperObservation {
  category: string;
  observation: string;
  source_attribution: string;
}

interface InsightsData {
  sentiment_score?: number | null;
  nearest_fuel: string;
  nearest_grocery: string;
  top_activities: string[];
  observations?: CamperObservation[];
  retrieved_at?: string;
}

interface FullCampsiteResponse {
  id: number;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  dog_friendly: boolean | null;
  rig_access: string[] | null;
  facilities: Record<string, unknown> | null;
  fees: string | null;
  booking_url: string | null;
  fire_district: string | null;
  data_status: string | null;
  facts?: CampsiteFacts | null;
}

export default function TripCard({ 
  campsite, 
  onClose, 
  routeDistance,
  startLocation 
}: { 
  campsite: Campsite | null; 
  onClose: () => void; 
  routeDistance?: number | null;
  startLocation?: { latitude?: number; longitude?: number; city?: string; state?: string } | null;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Plan B form state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [futureWeather, setFutureWeather] = useState<WeatherData | null>(null);
  const [loadingFutureWeather, setLoadingFutureWeather] = useState(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Phase 1-4 Trust Lens & Visual States
  const [fullDetails, setFullDetails] = useState<FullCampsiteResponse | null>(null);
  const [perspective, setPerspective] = useState<"glance" | "radar" | "weather" | "telemetry">("glance");
  const [showPlanBModal, setShowPlanBModal] = useState(false);
  const [inspectFact, setInspectFact] = useState<{ fact: Fact; label: string; campsiteName: string } | null>(null);

  // Fetch verified provenance facts
  useEffect(() => {
    if (!campsite) return;
    let isMounted = true;
    fetch(`${getApiUrl()}/campsites/${campsite.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data) {
          setFullDetails(data);
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [campsite]);

  // Construct structured TripCardData for radar and comparison
  const cardData: TripCardData = useMemo(() => {
    if (!campsite) {
      return {
        id: 0,
        name: "",
        state: "NSW",
        latitude: -33.8,
        longitude: 151.2,
        dog_friendly: null,
        rig_access: null,
        vehicle_clearance: "2WD",
        driving_distance_km: 100,
        driving_time_minutes: 80,
        highlight_badge: "Site Overview",
        why_it_fits: [],
        main_compromise: "Check local fire rules",
        estimated_cost: "Check fees",
        booking_status: "FIRST_COME_FIRST_SERVED",
        booking_url: null,
        management_type: null
      };
    }

    const driveKm = routeDistance ? Math.round(routeDistance / 1000) : 120;
    const driveMins = routeDistance ? Math.round((routeDistance / 1000) / 75 * 60) : 90;

    return {
      id: campsite.id,
      name: campsite.name,
      state: campsite.state,
      latitude: campsite.latitude,
      longitude: campsite.longitude,
      dog_friendly: fullDetails?.dog_friendly ?? campsite.dog_friendly ?? null,
      rig_access: fullDetails?.rig_access ?? campsite.rig_access ?? null,
      vehicle_clearance: (campsite.rig_access?.includes("4WD_ONLY") || fullDetails?.rig_access?.includes("4WD_ONLY")) ? "4WD_ONLY" : "2WD",
      driving_distance_km: driveKm,
      driving_time_minutes: driveMins,
      highlight_badge: "Interactive Map Pick",
      why_it_fits: ["Verified Location"],
      main_compromise: fullDetails?.fees ? `Camping fee: ${fullDetails.fees}` : "Check current fire regulations and weather before traveling",
      estimated_cost: fullDetails?.fees || campsite.fees || "Free / Unspecified",
      booking_status: campsite.booking_url ? "ONLINE_BOOKING_REQUIRED" : "FIRST_COME_FIRST_SERVED",
      booking_url: campsite.booking_url || null,
      management_type: campsite.management_type || "Public Reserve",
      facilities: fullDetails?.facilities || campsite.facilities,
      fees: fullDetails?.fees || campsite.fees,
      fire_district: fullDetails?.fire_district,
      data_status: fullDetails?.data_status,
      facts: fullDetails?.facts,
    };
  }, [campsite, fullDetails, routeDistance]);

  useEffect(() => {
    if (!campsite) return;
    
    let isMounted = true;
    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        try {
          const microRes = await fetch(`${getApiUrl()}/weather/microclimate?campsite_id=${campsite.id}&date=${todayStr}&latitude=${campsite.latitude}&longitude=${campsite.longitude}`);
          if (microRes.ok) {
            const data = await microRes.json();
            if (isMounted) {
              setWeather({
                tempMax: Math.round(data.temp_max),
                tempMin: Math.round(data.temp_min),
                precipProb: data.rain_probability,
                windSpeed: Math.round(data.wind_max_kmh),
                uvIndex: data.uv_index_max,
                description: "Live Radar Sync",
                sleepingBagRating: data.sleeping_bag_rating,
                matRValue: data.recommended_mat_r_value,
                dewFrostIndex: data.dew_frost_index,
                campfireWindRisk: data.campfire_wind_risk,
                pegStrainFactor: data.peg_strain_factor,
                valleyInversionActive: data.valley_inversion_active,
                terrainNotes: data.terrain_notes,
                forecastType: data.forecast_type,
                aiConditionSummary: data.ai_condition_summary,
              });
              return;
            }
          }
        } catch {
          // Graceful fallback
        }

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${campsite.latitude}&longitude=${campsite.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max&timezone=auto`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.daily) {
            const code = data.daily.weathercode[0];
            let desc = "Clear";
            if (code > 3) desc = "Overcast";
            if (code >= 51) desc = "Rain / Showers";
            if (code >= 95) desc = "Thunderstorm";

            setWeather({
              tempMax: Math.round(data.daily.temperature_2m_max[0]),
              tempMin: Math.round(data.daily.temperature_2m_min[0]),
              precipProb: data.daily.precipitation_probability_max[0] || 0,
              windSpeed: Math.round(data.daily.windspeed_10m_max[0]),
              uvIndex: Math.round(data.daily.uv_index_max[0] || 5),
              description: desc
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch live weather", err);
      } finally {
        if (isMounted) setLoadingWeather(false);
      }
    };

    const fetchAiSummary = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/campsites/${campsite.id}/ai-summary`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setAiSummary(data.summary);
        }
      } catch {
        // AI Pitch optional
      }
    };

    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const res = await fetch(`${getApiUrl()}/campsites/${campsite.id}/insights`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setInsights(data);
        }
      } catch {
        // Insights optional
      } finally {
        if (isMounted) setLoadingInsights(false);
      }
    };

    fetchWeather();
    fetchAiSummary();
    fetchInsights();

    return () => { isMounted = false; };
  }, [campsite]);

  // Climatology future weather
  useEffect(() => {
    if (!campsite || !startDate) {
      return;
    }

    let isMounted = true;
    const fetchFutureWeather = async () => {
      setLoadingFutureWeather(true);
      try {
        try {
          const microRes = await fetch(`${getApiUrl()}/weather/microclimate?campsite_id=${campsite.id}&date=${startDate}&latitude=${campsite.latitude}&longitude=${campsite.longitude}`);
          if (microRes.ok) {
            const data = await microRes.json();
            if (isMounted) {
              setFutureWeather({
                tempMax: Math.round(data.temp_max),
                tempMin: Math.round(data.temp_min),
                precipProb: data.rain_probability,
                windSpeed: Math.round(data.wind_max_kmh),
                uvIndex: data.uv_index_max,
                description: data.forecast_type === "climatology_analog" ? "P10-P90 Climatology Analog" : "Numerical Synoptic Model",
                sleepingBagRating: data.sleeping_bag_rating,
                matRValue: data.recommended_mat_r_value,
                dewFrostIndex: data.dew_frost_index,
                campfireWindRisk: data.campfire_wind_risk,
                pegStrainFactor: data.peg_strain_factor,
                valleyInversionActive: data.valley_inversion_active,
                terrainNotes: data.terrain_notes,
                forecastType: data.forecast_type,
                aiConditionSummary: data.ai_condition_summary,
              });
              return;
            }
          }
        } catch {
          // Fallback
        }

        const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${campsite.latitude}&longitude=${campsite.longitude}&start_date=2023-${startDate.substring(5)}&end_date=2023-${startDate.substring(5)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.daily) {
            const avgTempMax = data.daily.temperature_2m_max[0] || 22;
            const avgTempMin = data.daily.temperature_2m_min[0] || 12;
            const totalPrecip = data.daily.precipitation_sum[0] || 0;

            setFutureWeather({
              tempMax: Math.round(avgTempMax),
              tempMin: Math.round(avgTempMin),
              precipProb: totalPrecip > 5 ? 70 : totalPrecip > 0 ? 30 : 10,
              windSpeed: Math.round(data.daily.windspeed_10m_max[0] || 15),
              uvIndex: 6,
              description: `Climatology Model (${Math.round(totalPrecip)}mm baseline)`
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch future weather", e);
      } finally {
        if (isMounted) setLoadingFutureWeather(false);
      }
    };

    fetchFutureWeather();
    return () => { isMounted = false; };
  }, [campsite, startDate, endDate]);

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campsite) return;
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const res = await fetch(`${getApiUrl()}/saved-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: email,
          campsite_id: campsite.id,
          start_date: startDate || new Date().toISOString().split("T")[0],
          end_date: endDate || new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          origin_lat: startLocation?.latitude ?? null,
          origin_lng: startLocation?.longitude ?? null,
          max_drive_hours: null,
          has_dog: campsite.dog_friendly ?? null,
          rig_access: campsite.rig_access ? campsite.rig_access[0] : null,
          plan_b_alert_active: true
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to save trip");
      }

      setSaveSuccess(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error saving trip. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!campsite) return null;

  return (
    <div className="absolute top-4 left-4 md:top-6 md:left-6 w-96 max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100%-2rem)] md:max-h-[calc(100%-3rem)] glass-panel rounded-2xl z-20 animate-fade-in flex flex-col text-[var(--foreground)] shadow-2xl overscroll-contain overflow-hidden border border-white/20">
      {/* Sticky Header with Title and Close Button */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-white/10 flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-start">
          <div className="pr-4">
            <div className="flex items-center gap-2 text-[var(--color-neon-green)] text-xs font-semibold mb-0.5 uppercase tracking-wider">
              <MapPin size={13} />
              {campsite.state} • {campsite.management_type || "Public Reserve"}
            </div>
            <h2 className="text-xl md:text-2xl font-bold leading-tight text-white">{campsite.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close campsite details"
          >
            <X size={18} />
          </button>
        </div>

        {/* SITE CONFIDENCE METER (D2) */}
        <ConfidenceMeter 
          knownCount={fullDetails?.facts?.known_facts_count ?? (campsite.facilities ? 6 : 4)}
          totalCount={fullDetails?.facts?.total_facts_count ?? 9}
          officialCount={fullDetails?.facts?.official_or_verified_count ?? (fullDetails?.data_status === "verified" ? 4 : 2)}
        />
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 p-5 pt-3 overflow-y-auto overflow-x-hidden flex flex-col gap-3.5 custom-scrollbar">
        {routeDistance !== undefined && routeDistance !== null && (
          <div className="flex gap-4 text-xs font-medium text-[var(--color-neon-green)] bg-white/5 p-2 rounded-lg border border-white/10 shrink-0">
            <div className="flex items-center gap-1">
              <Car size={14} /> 
              {Math.round(routeDistance / 1000)} km from Start
            </div>
            <div className="flex items-center gap-1 opacity-80">
              ⛽ Est. Fuel: ${( (routeDistance / 1000) * 0.24 ).toFixed(2)} (4WD)
            </div>
          </div>
        )}

        {/* PERSPECTIVE SELECTOR (Glance / 5-Axis Radar / Weather Ribbon / Telemetry) */}
        <div className="flex items-center justify-between bg-black/50 p-1 rounded-xl border border-white/10 text-[11px] shrink-0">
          <button
            onClick={() => setPerspective("glance")}
            className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
              perspective === "glance"
                ? "bg-white/20 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Glance
          </button>
          <button
            onClick={() => setPerspective("radar")}
            className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
              perspective === "radar"
                ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            5-Axis Radar
          </button>
          <button
            onClick={() => setPerspective("weather")}
            className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
              perspective === "weather"
                ? "bg-sky-500 text-black shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Weather Ribbon
          </button>
          <button
            onClick={() => setPerspective("telemetry")}
            className={`flex-1 py-1 px-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
              perspective === "telemetry"
                ? "bg-amber-500 text-black shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Diurnal
          </button>
        </div>

        {/* PERSPECTIVE CONTENT */}
        {perspective === "radar" ? (
          <div className="py-1 shrink-0">
            <WhyItFitsRadar card={cardData} size={200} />
          </div>
        ) : perspective === "weather" ? (
          <div className="py-1 shrink-0">
            <WeekendWeatherRibbon campsiteName={campsite.name} isForecastWindow={true} />
          </div>
        ) : perspective === "telemetry" ? (
          <div className="shrink-0 w-full">
            <FuturisticWeatherHUD 
              liveWeather={weather}
              futureWeather={futureWeather}
              loadingLive={loadingWeather}
              loadingFuture={loadingFutureWeather}
              selectedStartDate={startDate}
              selectedEndDate={endDate}
              campsiteName={campsite.name}
              onDateChange={(date) => setStartDate(date)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 shrink-0">
            {/* 6-PILL TRUST LENS HUD */}
            <div className="grid grid-cols-3 gap-1.5">
              <FactChip
                label="Access"
                icon={<Car size={11} className="text-gray-300" />}
                displayValue={campsite.rig_access?.includes("4WD_ONLY") ? "4WD Only" : "2WD Easy"}
                fact={fullDetails?.facts?.vehicle_access}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.vehicle_access || {
                    value: campsite.rig_access?.includes("4WD_ONLY") ? "4WD_ONLY" : "2WD",
                    basis: "official",
                    confidence: 2,
                    source: campsite.source_url || "Park Dataset",
                    note: campsite.rig_access?.includes("4WD_ONLY") ? "High clearance 4WD required" : "Accessible by standard 2WD vehicles"
                  };
                  setInspectFact({ fact, label: "Vehicle Access", campsiteName: campsite.name });
                }}
              />

              <FactChip
                label="Telco"
                icon={<Wifi size={11} className="text-gray-300" />}
                displayValue={fullDetails?.facts?.telco?.value ? String(fullDetails.facts.telco.value) : "Unspecified"}
                fact={fullDetails?.facts?.telco}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.telco || {
                    value: null,
                    basis: "unknown",
                    confidence: 0,
                    note: "Mobile signal unverified — download offline maps before travel"
                  };
                  setInspectFact({ fact, label: "Mobile Reception", campsiteName: campsite.name });
                }}
              />

              <FactChip
                label="Campfire"
                icon={<Flame size={11} className="text-gray-300" />}
                displayValue={fullDetails?.facts?.campfires?.value === true ? "Permitted" : fullDetails?.facts?.campfires?.value === false ? "Prohibited" : "Check Rules"}
                fact={fullDetails?.facts?.campfires}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.campfires || {
                    value: null,
                    basis: "unknown",
                    confidence: 0,
                    note: "Campfire regulations unverified — verify current fire danger ratings and park signs"
                  };
                  setInspectFact({ fact, label: "Campfires", campsiteName: campsite.name });
                }}
              />

              <FactChip
                label="Water"
                icon={<Droplets size={11} className="text-gray-300" />}
                displayValue={fullDetails?.facts?.water?.value ? "Available" : "Carry In"}
                fact={fullDetails?.facts?.water}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.water || {
                    value: null,
                    basis: "unknown",
                    confidence: 0,
                    note: "Water availability unverified — carry all drinking water"
                  };
                  setInspectFact({ fact, label: "Water", campsiteName: campsite.name });
                }}
              />

              <FactChip
                label="Toilets"
                icon={<Layers size={11} className="text-gray-300" />}
                displayValue={fullDetails?.facts?.toilets?.value ? String(fullDetails.facts.toilets.value) : "Unverified"}
                fact={fullDetails?.facts?.toilets}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.toilets || {
                    value: null,
                    basis: "unknown",
                    confidence: 0,
                    note: "Toilet facilities unverified — carry necessary hygiene supplies"
                  };
                  setInspectFact({ fact, label: "Toilets", campsiteName: campsite.name });
                }}
              />

              <FactChip
                label="Pets"
                icon={<Dog size={11} className="text-gray-300" />}
                displayValue={campsite.dog_friendly === true ? "Dogs OK" : campsite.dog_friendly === false ? "No Pets" : "Check Rules"}
                fact={fullDetails?.facts?.dog_friendly}
                onInspect={() => {
                  const fact: Fact = fullDetails?.facts?.dog_friendly || {
                    value: campsite.dog_friendly,
                    basis: campsite.dog_friendly !== undefined ? "official" : "unknown",
                    confidence: campsite.dog_friendly !== undefined ? 2 : 0,
                    note: campsite.dog_friendly === true ? "Dogs allowed on leash" : "Check pet restrictions with local ranger"
                  };
                  setInspectFact({ fact, label: "Pet Policy", campsiteName: campsite.name });
                }}
              />
            </div>

            {/* LIVE FIRE AGENCY & DISTRICT STRIP */}
            <FireStrip 
              fireDistrict={fullDetails?.fire_district || ""} 
              fireFact={fullDetails?.facts?.fire_status} 
              state={campsite.state} 
            />
          </div>
        )}

        {/* CONDITION-AWARE GEAR-FIT BADGE (D9) */}
        <div className="bg-emerald-950/40 border border-emerald-500/25 px-3 py-1.5 rounded-xl text-xs flex items-center justify-between text-emerald-200 shrink-0">
          <span className="font-semibold text-[11px] flex items-center gap-1.5">
            🎒 <strong className="text-white">Gear Fit:</strong> 15°C Summer Quilt / Light Bag ✔
          </span>
          <span className="text-[10px] text-emerald-400 font-bold">Overnight ~14°C</span>
        </div>

        {/* ONE-TAP DIRECT GPS NAVIGATION & PLAN B ACTION BUTTONS */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowPlanBModal(true)}
              className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
              title="Inspect condition-aware Plan B alternatives for this campsite"
            >
              <Shuffle size={13} className="text-amber-400" /> Plan B Alternatives
            </button>
            <button
              onClick={() => setShowCheckInModal(true)}
              className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[var(--color-neon-green)] py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              📡 10s Ground Report
            </button>
          </div>

          {(() => {
            const originParam = startLocation?.latitude && startLocation?.longitude 
              ? `&origin=${startLocation.latitude},${startLocation.longitude}` 
              : "";
            const googleMapsUrl = originParam 
              ? `https://www.google.com/maps/dir/?api=1${originParam}&destination=${campsite.latitude},${campsite.longitude}&travelmode=driving`
              : `https://www.google.com/maps/search/?api=1&query=${campsite.latitude},${campsite.longitude}`;
            const appleMapsUrl = startLocation?.latitude && startLocation?.longitude 
              ? `https://maps.apple.com/?saddr=${startLocation.latitude},${startLocation.longitude}&daddr=${campsite.latitude},${campsite.longitude}&dirflg=d`
              : `https://maps.apple.com/?daddr=${campsite.latitude},${campsite.longitude}`;

            return (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                >
                  <Navigation size={13} className="text-cyan-400" /> Google Maps
                </a>
                <a
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                >
                  <Compass size={13} className="text-emerald-300" /> Apple Maps
                </a>
              </div>
            );
          })()}
        </div>

        {aiSummary && (
          <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-white/20 pl-3 shrink-0">
            <span className="font-semibold text-white/50 text-xs block mb-1">AI Pitch</span>
            {aiSummary}
          </p>
        )}

        {/* Community Field Notes & Sourced Insights Section */}
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2 border border-white/10 shrink-0">
          <div className="flex justify-between items-center text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <span>Town & Field Notes</span>
              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">AI Web Synthesis</span>
            </span>
            {insights?.retrieved_at && (
              <span className="text-[10px] text-gray-400">
                Checked {new Date(insights.retrieved_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          
          {loadingInsights ? (
            <div className="text-xs text-gray-400 animate-pulse py-2">Scanning nearby town amenities & field reports...</div>
          ) : insights ? (
            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400 block mb-0.5">⛽ Fuel</span>
                  <span className="text-white font-medium">{insights.nearest_fuel}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">🛒 Groceries</span>
                  <span className="text-white font-medium">{insights.nearest_grocery}</span>
                </div>
              </div>

              {insights.observations && insights.observations.length > 0 && (
                <div className="border-t border-white/10 pt-2 space-y-1.5">
                  <span className="text-gray-400 block text-[11px] font-semibold uppercase tracking-wider">Ground Truth Observations</span>
                  {insights.observations.map((obs, i) => (
                    <div key={i} className="bg-black/30 p-2 rounded-lg border border-white/5 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-emerald-300 font-bold uppercase">{obs.category}</span>
                        <span className="text-gray-500 italic">via {obs.source_attribution}</span>
                      </div>
                      <div className="text-gray-200 text-xs">{obs.observation}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-2">
                <span className="text-gray-400 block mb-1">Top Activities</span>
                <div className="flex flex-wrap gap-1">
                  {insights.top_activities.map((act, i) => (
                    <span key={i} className="bg-white/10 px-2 py-0.5 rounded text-white text-[11px]">{act}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">Field notes currently unavailable</div>
          )}
        </div>

        {/* Plan B Monitoring Form */}
        <div className="mt-2 border-t border-white/10 pt-4 shrink-0">
          {saveSuccess ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center flex flex-col gap-3">
              <div className="text-[var(--color-neon-green)] font-bold">✨ Trip Saved & Plan B Monitor Armed!</div>
              <p className="text-xs text-gray-300">We will monitor rain, severe heat, and park closures for your weekend and alert you if conditions worsen.</p>
              <button 
                onClick={() => setSaveSuccess(false)}
                className="text-xs text-white underline"
              >
                Save another date
              </button>
            </div>
          ) : isSaving ? (
            <form onSubmit={handleSaveTrip} className="flex flex-col gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-white">Save Trip & Arm Plan B Monitor</span>
              
              {saveError && (
                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                  {saveError}
                </div>
              )}

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Your Email</label>
                <input 
                  type="email" 
                  required
                  placeholder="camper@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--color-neon-green)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Start Date</label>
                  <input 
                    type="date" 
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!e.target.value) setFutureWeather(null);
                    }}
                    className="w-full bg-black/40 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--color-neon-green)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">End Date</label>
                  <input 
                    type="date" 
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[var(--color-neon-green)]"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button 
                  type="button"
                  onClick={() => setIsSaving(false)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Confirm & Monitor
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setIsSaving(true)}
                className="w-full py-2.5 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] font-bold text-xs rounded-xl transition-all shadow-[0_4px_20px_rgba(0,255,136,0.2)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.4)] cursor-pointer"
              >
                Save Trip & Monitor for Plan B
              </button>
            </div>
          )}
        </div>

        <div className="mt-2">
          <a 
            href={campsite.booking_url || campsite.source_url || `https://www.google.com/search?q=book+${encodeURIComponent(campsite.name)}+camping`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-1.5 w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-xs border border-white/20 cursor-pointer"
          >
            <span>View Booking / Permit Details</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* 10-SECOND GROUND CHECK-IN MODAL */}
      {showCheckInModal && (
        <GroundCheckInModal
          campsiteId={campsite.id}
          campsiteName={campsite.name}
          onClose={() => setShowCheckInModal(false)}
          onCheckInSuccess={() => {
            setShowCheckInModal(false);
          }}
        />
      )}

      {/* PLAN B ALTERNATIVES MODAL */}
      {showPlanBModal && (
        <PlanBModal
          originalCampsite={cardData}
          originLat={startLocation?.latitude}
          originLng={startLocation?.longitude}
          onClose={() => setShowPlanBModal(false)}
          onSwapWithAlternative={() => {
            setShowPlanBModal(false);
          }}
        />
      )}

      {/* TRUST LENS SOURCE INSPECTION SHEET */}
      {inspectFact && (
        <SourceSheet
          fact={inspectFact.fact}
          label={inspectFact.label}
          campsiteName={inspectFact.campsiteName}
          onClose={() => setInspectFact(null)}
          onOpenCheckIn={() => {
            setShowCheckInModal(true);
          }}
        />
      )}
    </div>
  );
}
