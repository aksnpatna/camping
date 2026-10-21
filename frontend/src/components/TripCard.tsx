"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  X, 
  ExternalLink, 
  Navigation, 
  Compass,
  Shuffle, 
  Flame,
  Radio,
  Car,
  Fuel,
  Bookmark,
  Check,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Moon
} from "lucide-react";
import type { Campsite } from "./Map";
import { getApiUrl } from "@/config";
import GroundCheckInModal from "./GroundCheckInModal";
import ConfidenceMeter from "./trust/ConfidenceMeter";
import SourceSheet from "./trust/SourceSheet";
import PlanBModal from "./trust/PlanBModal";
import { CampsiteFacts, Fact } from "@/types/facts";
import type { TripCardData, StartLocation } from "./FindWeekendPlanner";
import Contour from "./ui/Contour";
import FactRow from "./ui/FactRow";
import Section from "./ui/Section";
import Button from "./ui/Button";

interface CamperObservation {
  category: string;
  observation: string;
  source_attribution: string;
}

interface CampsiteInsights {
  nearest_fuel: string;
  nearest_grocery: string;
  top_activities: string[];
  observations: CamperObservation[];
  retrieved_at: string;
}

interface PhaseTelemetry {
  temperature: number;
  feels_like: number;
  wind_speed: number;
  humidity_or_dew: string;
  condition_description: string;
  camper_tip: string;
}

interface MicroclimateData {
  latitude: number;
  longitude: number;
  date: string;
  elevation_m: number;
  forecast_type: string;
  temp_max: number;
  temp_min: number;
  rain_probability: number;
  expected_rainfall_mm: number;
  wind_max_kmh: number;
  uv_index_max: number;
  phases: Record<string, PhaseTelemetry>;
  sleeping_bag_rating: string;
  recommended_mat_r_value: number;
  dew_frost_index: string;
  campfire_wind_risk: string;
  peg_strain_factor: string;
  valley_inversion_active: boolean;
  terrain_notes: string[];
  ai_condition_summary?: string | null;
}

export interface FullCampsiteDetails extends Campsite {
  fee_standard?: string;
  fire_district?: string;
  data_status?: string;
  facts?: CampsiteFacts;
}

interface TripCardProps {
  campsite: Campsite;
  onClose: () => void;
  routeDistance?: number | null;
  startLocation?: StartLocation | null;
}

export default function TripCard({ 
  campsite, 
  onClose,
  routeDistance,
  startLocation
}: TripCardProps) {
  const [fullDetails, setFullDetails] = useState<FullCampsiteDetails | null>(null);
  const [inspectFact, setInspectFact] = useState<{ fact: Fact; label: string; campsiteName: string } | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [showPlanBModal, setShowPlanBModal] = useState<boolean>(false);

  // Insights & AI summary
  const [insights, setInsights] = useState<CampsiteInsights | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Save Trip state
  const [isSaving, setIsSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((5 + 7 - d.getDay()) % 7 || 7));
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((5 + 7 - d.getDay()) % 7 || 7) + 2);
    return d.toISOString().split("T")[0];
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch full details including provenance facts
  useEffect(() => {
    if (!campsite) return;
    let active = true;

    fetch(`${getApiUrl()}/campsites/${campsite.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data) setFullDetails(data);
      })
      .catch(() => {});

    // Fetch AI summary
    fetch(`${getApiUrl()}/campsites/${campsite.id}/ai-summary`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data?.summary) setAiSummary(data.summary);
      })
      .catch(() => {});

    // Fetch insights
    fetch(`${getApiUrl()}/campsites/${campsite.id}/insights`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data) setInsights(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [campsite]);

  // Weather & Microclimate state
  const [microclimate, setMicroclimate] = useState<MicroclimateData | null>(null);

  // Fetch microclimate telemetry for campsite and trip date
  useEffect(() => {
    if (!campsite) return;
    let active = true;

    fetch(`${getApiUrl()}/weather/microclimate?campsite_id=${campsite.id}&date=${startDate}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (active && data) {
          setMicroclimate(data);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [campsite, startDate]);

  const cardData: TripCardData = useMemo(() => {
    return {
      id: campsite.id,
      name: campsite.name,
      state: campsite.state,
      latitude: campsite.latitude,
      longitude: campsite.longitude,
      dog_friendly: campsite.dog_friendly ?? null,
      rig_access: campsite.rig_access || null,
      vehicle_clearance: campsite.rig_access?.includes("4WD_ONLY") ? "4WD_ONLY" : (campsite.rig_access && campsite.rig_access.length > 0 ? "2WD" : "UNVERIFIED"),
      driving_distance_km: routeDistance ? Math.round(routeDistance / 1000) : 100,
      driving_time_minutes: routeDistance ? Math.round((routeDistance / 1000) * 0.9) : 90,
      highlight_badge: "Map Selection",
      why_it_fits: [
        campsite.dog_friendly ? "Dog friendly" : "Dogs not allowed",
        campsite.management_type || "Authority not recorded"
      ],
      main_compromise: (fullDetails?.facilities as Record<string, unknown> | undefined)?.toilets ? "Basic amenities" : "Hygiene facilities unverified",
      estimated_cost: fullDetails?.fee_standard || campsite.fees || "Free / Fee Unverified",
      booking_status: campsite.booking_url ? "Book Ahead" : "No Booking Required",
      booking_url: campsite.booking_url || null,
      management_type: campsite.management_type || null,
      facilities: fullDetails?.facilities || campsite.facilities || null,
      fees: fullDetails?.fee_standard || campsite.fees || null,
      fire_district: fullDetails?.fire_district || null,
      data_status: fullDetails?.data_status || null,
      source_url: campsite.source_url || null,
      facts: fullDetails?.facts || null
    };
  }, [campsite, fullDetails, routeDistance]);

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !startDate || !endDate) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`${getApiUrl()}/saved-trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: email,
          campsite_id: campsite.id,
          start_date: startDate,
          end_date: endDate
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save trip");
      }

      setSaveSuccess(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Error saving trip. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Direct GPS navigation links
  const originParam = startLocation?.latitude && startLocation?.longitude 
    ? `&origin=${startLocation.latitude},${startLocation.longitude}` 
    : "";
  const googleMapsUrl = originParam 
    ? `https://www.google.com/maps/dir/?api=1${originParam}&destination=${campsite.latitude},${campsite.longitude}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${campsite.latitude},${campsite.longitude}`;
  const appleMapsUrl = startLocation?.latitude && startLocation?.longitude 
    ? `https://maps.apple.com/?saddr=${startLocation.latitude},${startLocation.longitude}&daddr=${campsite.latitude},${campsite.longitude}&dirflg=d`
    : `https://maps.apple.com/?daddr=${campsite.latitude},${campsite.longitude}`;

  const clearanceValue =
    campsite.rig_access && campsite.rig_access.includes("4WD_ONLY")
      ? "4WD Only"
      : campsite.rig_access && campsite.rig_access.length > 0
      ? "2WD Access"
      : null;

  const dogValue =
    campsite.dog_friendly === true
      ? "Permitted"
      : campsite.dog_friendly === false
      ? "Not allowed"
      : null;

  const campfireValue =
    fullDetails?.facts?.campfires?.value !== undefined && fullDetails?.facts?.campfires?.value !== null
      ? (fullDetails.facts.campfires.value ? "Permitted" : "Prohibited")
      : campsite.facilities?.campfires !== undefined
      ? (campsite.facilities.campfires ? "Permitted" : "Prohibited")
      : null;

  const waterValue =
    fullDetails?.facts?.water?.value
      ? String(fullDetails.facts.water.value)
      : campsite.facilities?.drinking_water !== undefined
      ? (campsite.facilities.drinking_water ? "Drinking water" : "None")
      : null;

  const toiletValue =
    fullDetails?.facts?.toilets?.value
      ? String(fullDetails.facts.toilets.value)
      : campsite.facilities?.toilets
      ? String(campsite.facilities.toilets)
      : null;

  const telcoValue =
    fullDetails?.facts?.telco?.value
      ? String(fullDetails.facts.telco.value)
      : null;

  const inspect = (label: string, fallbackFact: Fact) => {
    const fact = fullDetails?.facts ? (fullDetails.facts as unknown as Record<string, Fact>)[label.toLowerCase()] || fallbackFact : fallbackFact;
    setInspectFact({ fact, label, campsiteName: campsite.name });
  };

  return (
    <div className="absolute top-4 left-4 md:top-6 md:left-6 w-96 max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100%-2rem)] md:max-h-[calc(100%-3rem)] bg-paper-card rounded-md z-20 animate-fade-in flex flex-col text-ink shadow-overlay overscroll-contain overflow-hidden border border-paper-rule">
      {/* Top Header Motif & Close */}
      <div className="relative border-b border-paper-rule bg-paper-sunk/30">
        <Contour latitude={campsite.latitude} longitude={campsite.longitude} height={52} />
        <button 
          onClick={onClose}
          className="absolute top-2.5 right-2.5 p-1 rounded-xs bg-paper-card/90 border border-paper-rule text-ink-muted hover:text-ink transition-colors cursor-pointer"
          aria-label="Close campsite details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sticky Header with Title and Facts Count */}
      <div className="p-4 pb-3 border-b border-paper-rule bg-paper-card flex flex-col gap-1.5 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <h2 className="t-title text-xl font-semibold leading-tight text-ink">
            {campsite.name}
          </h2>
          <span className="t-data text-xs text-ink-muted px-1.5 py-0.5 bg-paper-sunk rounded-xs shrink-0 border border-paper-rule">
            {campsite.state}
          </span>
        </div>

        <p className="t-data text-xs text-ink-muted">
          {campsite.management_type || "Authority not recorded"}
        </p>

        {fullDetails?.facts && (
          <div className="pt-1">
            <ConfidenceMeter 
              knownCount={fullDetails.facts.known_facts_count ?? 0}
              totalCount={fullDetails.facts.total_facts_count ?? 9}
              officialCount={fullDetails.facts.official_or_verified_count}
            />
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto overflow-x-hidden flex flex-col gap-4 custom-scrollbar text-ink">
        {/* Route & Fuel info */}
        {routeDistance !== undefined && routeDistance !== null && (
          <div className="flex items-center justify-between text-xs t-data bg-paper-sunk p-2.5 rounded-sm border border-paper-rule shrink-0">
            <span className="flex items-center gap-1.5 text-eucalypt font-semibold">
              <Car size={13} className="text-eucalypt" /> 
              {Math.round(routeDistance / 1000)} km from Start
            </span>
            <span className="flex items-center gap-1.5 text-ink-muted">
              <Fuel size={13} className="text-ochre" /> 
              Est. Fuel: ${( (routeDistance / 1000) * 0.24 ).toFixed(2)}
            </span>
          </div>
        )}

        {/* CONDITIONS & CAMP CLIMATE */}
        <Section 
          title="Conditions & Climate"
          badge={
            <span className="t-data text-[10px] text-eucalypt font-medium flex items-center gap-1">
              <Radio size={10} className="text-eucalypt animate-pulse" />
              {microclimate?.forecast_type === "numerical_ensemble" ? "Live Synoptic Forecast" : "Typical for this date"}
            </span>
          }
        >
          <div className="flex flex-col gap-2.5 pt-0.5">
            {!microclimate ? (
              <div className="p-3 bg-paper-sunk rounded-xs border border-paper-rule text-center text-xs t-data text-ink-faint animate-pulse">
                Calculating terrain lapse rates & microclimate...
              </div>
            ) : (
              <>
                {/* 4 Primary Weather Metrics */}
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="p-2 bg-paper-card border border-paper-rule rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-ink-faint t-micro mb-0.5">
                      <Sun size={11} className="text-ochre" /> Day Max
                    </div>
                    <span className="t-data text-sm font-bold text-ink">{microclimate.temp_max}°C</span>
                  </div>

                  <div className="p-2 bg-paper-card border border-paper-rule rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-ink-faint t-micro mb-0.5">
                      <Moon size={11} className="text-eucalypt" /> Night Min
                    </div>
                    <span className="t-data text-sm font-bold text-ink">{microclimate.temp_min}°C</span>
                  </div>

                  <div className="p-2 bg-paper-card border border-paper-rule rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-ink-faint t-micro mb-0.5">
                      {microclimate.rain_probability >= 40 || microclimate.expected_rainfall_mm >= 2.0 ? (
                        <CloudRain size={11} className="text-trust-official" />
                      ) : (
                        <Droplets size={11} className="text-trust-official" />
                      )}
                      Rain
                    </div>
                    <span className="t-data text-xs font-bold text-trust-official">{microclimate.rain_probability}%</span>
                    <span className="text-[9px] text-ink-faint block">{microclimate.expected_rainfall_mm}mm</span>
                  </div>

                  <div className="p-2 bg-paper-card border border-paper-rule rounded-xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-ink-faint t-micro mb-0.5">
                      <Wind size={11} className="text-eucalypt" /> Wind
                    </div>
                    <span className="t-data text-xs font-bold text-ink">{microclimate.wind_max_kmh} <span className="text-[9px] font-normal text-ink-muted">km/h</span></span>
                    <span className="text-[9px] text-ochre block font-medium">UV {microclimate.uv_index_max}</span>
                  </div>
                </div>

                {/* AI Camp Condition Synthesis Briefing */}
                {microclimate.ai_condition_summary && (
                  <div className="p-2.5 bg-paper-sunk/70 border-l-2 border-eucalypt rounded-xs text-[11px] text-ink leading-relaxed">
                    <span className="t-label text-[9.5px] uppercase font-bold text-eucalypt block tracking-wide mb-0.5">
                      Field Condition Briefing
                    </span>
                    <p className="italic text-ink-muted">{microclimate.ai_condition_summary}</p>
                  </div>
                )}

                {/* Sleep System & Bush Telemetry */}
                <div className="bg-paper-sunk/60 border border-paper-rule rounded-xs p-2.5 flex flex-col gap-1.5 text-xs font-sans">
                  <div className="flex items-center justify-between border-b border-paper-rule/60 pb-1">
                    <span className="t-label text-[10px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Moon size={11} className="text-eucalypt" /> Sleep System Rating
                    </span>
                    <span className="t-data text-[11px] font-semibold text-eucalypt">
                      Min {microclimate.temp_min}°C Overnight
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-ink-muted font-medium">Bag:</span>
                      <span className="t-data text-ink font-semibold truncate" title={microclimate.sleeping_bag_rating}>
                        {microclimate.sleeping_bag_rating}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-ink-muted font-medium">Mat:</span>
                      <span className="t-data text-ink font-semibold">
                        R-Value {microclimate.recommended_mat_r_value}+ Ground
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-paper-rule/40 flex flex-col gap-1 text-[10.5px] text-ink-muted t-data">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0"></span>
                      <span className="truncate">{microclimate.campfire_wind_risk}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-trust-official shrink-0"></span>
                      <span className="truncate">{microclimate.dew_frost_index}</span>
                    </div>
                    {microclimate.valley_inversion_active && (
                      <div className="flex items-center gap-1.5 text-ochre font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0"></span>
                        <span>Valley Cold-Air Pooling Active (+2.5°C nocturnal chill)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 Diurnal Camping Phases */}
                {microclimate.phases && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="t-label text-[10px] uppercase font-bold text-ink-muted tracking-wider">
                      Diurnal Phase Forecast
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(microclimate.phases).map(([phaseKey, phase]) => (
                        <div key={phaseKey} className="p-1.5 bg-paper-card border border-paper-rule/70 rounded-xs text-xs">
                          <div className="flex items-center justify-between pb-0.5 border-b border-paper-rule/40">
                            <span className="t-label capitalize font-bold text-ink text-[10.5px]">{phaseKey}</span>
                            <span className="t-data text-ink font-semibold text-[10.5px]">{phase.temperature}°C</span>
                          </div>
                          <p className="text-[10px] text-ink-muted leading-tight pt-1 truncate" title={phase.camper_tip}>
                            {phase.camper_tip}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Fire row */}
            <div className="flex items-center justify-between py-1.5 px-2 bg-ochre-tint/70 border border-ochre/25 rounded-xs text-xs">
              <span className="t-data text-[11px] text-ink flex items-center gap-1.5">
                <Flame size={12} className="text-ochre" />
                Fire: {fullDetails?.fire_district || "District unmapped"} ({campsite.state})
              </span>
              <a
                href={
                  campsite.state === "NSW"
                    ? "https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans"
                    : campsite.state === "VIC"
                    ? "https://www.cfa.vic.gov.au/warnings-restrictions/total-fire-bans-fire-danger-ratings"
                    : "https://www.bom.gov.au"
                }
                target="_blank"
                rel="noreferrer"
                className="t-data text-[10px] text-ochre hover:underline flex items-center gap-0.5"
              >
                Agency feed <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </Section>

        {/* SITE FACTS */}
        <Section title="Site facts">
          <div className="flex flex-col border border-paper-rule rounded-xs bg-paper-sunk/30 divide-y divide-paper-rule/60">
            <FactRow
              label="Access"
              value={clearanceValue}
              fact={fullDetails?.facts?.vehicle_access}
              onInspect={() =>
                inspect("Vehicle Access", {
                  value: clearanceValue,
                  basis: clearanceValue ? "official" : "unknown",
                  confidence: clearanceValue ? 2 : 0,
                  note: clearanceValue ? `Clearance recorded: ${clearanceValue}` : "Clearance not recorded by park authority"
                })
              }
            />

            <FactRow
              label="Water"
              value={waterValue}
              fact={fullDetails?.facts?.water}
              onInspect={() =>
                inspect("Water", {
                  value: waterValue,
                  basis: campsite.facilities?.drinking_water !== undefined ? "official" : "unknown",
                  confidence: campsite.facilities?.drinking_water !== undefined ? 2 : 0,
                  note: waterValue ? `Water status: ${waterValue}` : "Drinking water availability unrecorded — carry sufficient water"
                })
              }
            />

            <FactRow
              label="Toilets"
              value={toiletValue}
              fact={fullDetails?.facts?.toilets}
              onInspect={() =>
                inspect("Toilets", {
                  value: toiletValue,
                  basis: campsite.facilities?.toilets ? "official" : "unknown",
                  confidence: campsite.facilities?.toilets ? 2 : 0,
                  note: toiletValue ? `Toilet type: ${toiletValue}` : "Toilet facilities unrecorded — carry hygiene supplies"
                })
              }
            />

            <FactRow
              label="Campfires"
              value={campfireValue}
              fact={fullDetails?.facts?.campfires}
              onInspect={() =>
                inspect("Campfires", {
                  value: campfireValue,
                  basis: campsite.facilities?.campfires !== undefined ? "official" : "unknown",
                  confidence: campsite.facilities?.campfires !== undefined ? 2 : 0,
                  note: campfireValue ? `Campfires: ${campfireValue}` : "Campfire regulations unrecorded — observe total fire bans"
                })
              }
            />

            <FactRow
              label="Dogs"
              value={dogValue}
              fact={fullDetails?.facts?.dog_friendly}
              onInspect={() =>
                inspect("Pet Policy", {
                  value: campsite.dog_friendly,
                  basis: campsite.dog_friendly !== undefined ? "rule" : "unknown",
                  confidence: campsite.dog_friendly !== undefined ? 3 : 0,
                  note: dogValue ? `Pet policy: ${dogValue}` : "Pet policy unrecorded — verify with local authority"
                })
              }
            />

            <FactRow
              label="Telco"
              value={telcoValue}
              fact={fullDetails?.facts?.telco}
              onInspect={() =>
                inspect("Telco", {
                  value: telcoValue,
                  basis: telcoValue ? "community" : "unknown",
                  confidence: telcoValue ? 2 : 0,
                  note: telcoValue ? `Carrier signal: ${telcoValue}` : "Mobile coverage unrecorded — download offline maps before departure"
                })
              }
            />
          </div>
        </Section>

        {/* AI SUMMARY / FIELD NOTES */}
        {aiSummary && (
          <Section title="Field summary">
            <p className="t-body text-xs text-ink-muted leading-relaxed">
              {aiSummary}
            </p>
          </Section>
        )}

        {/* Town & Field Observations */}
        {insights && (
          <Section title="Nearby towns & amenities">
            <div className="bg-paper-sunk p-2.5 rounded-xs border border-paper-rule flex flex-col gap-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="t-micro text-ink-faint block">Nearest Fuel</span>
                  <span className="t-data text-xs text-ink font-semibold">{insights.nearest_fuel}</span>
                </div>
                <div>
                  <span className="t-micro text-ink-faint block">Nearest Groceries</span>
                  <span className="t-data text-xs text-ink font-semibold">{insights.nearest_grocery}</span>
                </div>
              </div>

              {insights.observations && insights.observations.length > 0 && (
                <div className="border-t border-paper-rule pt-2 space-y-1">
                  <span className="t-micro text-ink-faint block">Recent field observations</span>
                  {insights.observations.map((obs, i) => (
                    <div key={i} className="bg-paper-card p-2 rounded-xs border border-paper-rule space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-eucalypt font-bold uppercase">{obs.category}</span>
                        <span className="text-ink-faint italic">{obs.source_attribution}</span>
                      </div>
                      <div className="text-ink text-xs t-body">{obs.observation}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Action Buttons: Direct GPS, Plan B, Ground Report */}
        <div className="flex flex-col gap-2 pt-2 border-t border-paper-rule">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="py-1.5 px-2 bg-paper-card border border-paper-rule rounded-sm text-xs t-label text-ink hover:bg-paper-sunk flex items-center justify-center gap-1.5 transition-colors"
            >
              <Navigation size={12} className="text-trust-official" /> Google Maps
            </a>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="py-1.5 px-2 bg-paper-card border border-paper-rule rounded-sm text-xs t-label text-ink hover:bg-paper-sunk flex items-center justify-center gap-1.5 transition-colors"
            >
              <Compass size={12} className="text-eucalypt" /> Apple Maps
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPlanBModal(true)}
              title="Inspect Plan B alternatives"
            >
              <Shuffle size={13} className="text-ochre" /> Plan B
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCheckInModal(true)}
              title="Report conditions"
            >
              <Radio size={13} className="text-eucalypt" /> Report conditions
            </Button>
          </div>
        </div>

        {/* Save Trip & Monitor Form */}
        <div className="border-t border-paper-rule pt-3">
          {saveSuccess ? (
            <div className="p-3 bg-eucalypt-tint border border-eucalypt/30 rounded-sm text-center flex flex-col gap-2">
              <div className="text-eucalypt font-semibold text-xs flex items-center justify-center gap-1">
                <Check size={14} /> Trip saved & condition monitor armed
              </div>
              <p className="t-lede text-xs">We monitor fire bans and weather shifts for your dates.</p>
              <button 
                onClick={() => setSaveSuccess(false)}
                className="t-data text-xs text-eucalypt underline cursor-pointer"
              >
                Save another date
              </button>
            </div>
          ) : isSaving ? (
            <form onSubmit={handleSaveTrip} className="flex flex-col gap-2.5 bg-paper-sunk p-3 rounded-sm border border-paper-rule">
              <span className="t-label text-xs font-semibold text-ink">Save trip & monitor conditions</span>
              
              {saveError && (
                <div className="text-xs text-safety-danger bg-safety-danger/10 p-2 rounded-xs border border-safety-danger/30">
                  {saveError}
                </div>
              )}

              <div>
                <label className="t-micro text-ink-muted block mb-0.5">Your email</label>
                <input 
                  type="email" 
                  required
                  placeholder="camper@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-paper-card border border-paper-rule rounded-sm px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-eucalypt"
                />
                <p className="text-[10px] text-ink-faint mt-1 leading-normal">
                  We use your email strictly for condition alerts. No marketing. View <Link href="/privacy" target="_blank" className="underline hover:text-eucalypt">Privacy Policy</Link>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="t-micro text-ink-muted block mb-0.5">Start date</label>
                  <input 
                    type="date" 
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-paper-card border border-paper-rule rounded-sm px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-eucalypt"
                  />
                </div>
                <div>
                  <label className="t-micro text-ink-muted block mb-0.5">End date</label>
                  <input 
                    type="date" 
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-paper-card border border-paper-rule rounded-sm px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-eucalypt"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <Button 
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSaving(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex-1"
                >
                  Confirm & Monitor
                </Button>
              </div>
            </form>
          ) : (
            <Button 
              variant="primary"
              size="md"
              onClick={() => setIsSaving(true)}
              className="w-full"
            >
              <Bookmark size={13} /> Save Trip & Monitor Conditions
            </Button>
          )}
        </div>

        {campsite.booking_url && (
          <div className="pt-1">
            <a 
              href={campsite.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-paper-card hover:bg-paper-sunk text-ink text-xs t-label rounded-sm border border-paper-rule transition-colors"
            >
              <span>Booking & Permit Details</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* 10-Second Ground Check-in Modal */}
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

      {/* Plan B Alternatives Modal */}
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

      {/* Source Inspection Sheet */}
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
