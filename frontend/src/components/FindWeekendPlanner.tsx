"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  MapPin, 
  Calendar, 
  AlertCircle, 
  SlidersHorizontal, 
  Search, 
  ArrowRight, 
  Users, 
  WifiOff, 
  Compass,
  Scale
} from "lucide-react";

import { getApiUrl } from "@/config";
import PreparationBoard from "./PreparationBoard";
import TripRoomModal from "./TripRoomModal";
import GroundCheckInModal from "./GroundCheckInModal";
import OfflineBushVaultModal, { saveTripOffline, getOfflineTrips } from "./OfflineBushVaultModal";
import SourceSheet from "./trust/SourceSheet";
import CompareTrayModal from "./graphics/CompareTrayModal";
import PlanBModal, { PlanBAlternative } from "./trust/PlanBModal";
import FieldGuideLedgerCard from "./FieldGuideLedgerCard";
import Button from "./ui/Button";
import { CampsiteFacts, Fact } from "@/types/facts";

export interface WeatherDay {
  dayName: string;
  dateStr: string;
  minTemp: number;
  maxTemp: number;
  rainProb: number;
  gearRecommendation: string;
  conditionIcon: "sun" | "rain" | "wind";
}

export interface GearFit {

  overnight_min_temp: number;
  sleeping_bag_rating: string;
  recommended_mat_r_value: number;
  dew_frost_index: string;
  campfire_wind_risk: string;
}

export interface TripCardData {
  id: number;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  dog_friendly: boolean | null;
  rig_access: string[] | null;
  vehicle_clearance: string;
  driving_distance_km: number;
  driving_time_minutes: number;
  highlight_badge: string;
  why_it_fits: string[];
  main_compromise: string;
  estimated_cost: string;
  booking_status: string;
  booking_type?: string;
  availability_window?: string;
  booking_url: string | null;
  management_type: string | null;
  facilities?: Record<string, unknown> | null;
  fees?: string | null;
  fire_district?: string | null;
  data_status?: string | null;
  source_url?: string | null;
  evidence_url?: string | null;
  visual_badges?: Record<string, string> | null;
  community_signals?: Record<string, unknown> | null;
  photo_url?: string | null;
  is_illustrative_photo?: boolean;
  facts?: CampsiteFacts | null;
  weather_days?: WeatherDay[] | null;
  gear_fit?: GearFit | null;
  forecast_source?: string | null;
}


interface FindWeekendResponse {
  cards: TripCardData[];
  limiting_constraint: string | null;
  suggested_adjustments: string[];
  parsed_criteria?: Record<string, unknown>;
  assumed_origin?: string | null;
}

export interface StartLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  isDetected?: boolean;
  source?: "gps" | "ip" | "default";
}

interface FindWeekendPlannerProps {
  onSelectSiteOnMap: (campsiteId: number) => void;
  onOpenSaveModal: (campsiteId: number, campsiteName: string) => void;
  startLocation?: StartLocation;
  onUpdateStartLocation?: (location: StartLocation) => void;
}

export function getPresetQueries(city = "Sydney", state = "NSW") {
  const isWA = state === "WA" || city.toLowerCase() === "perth";
  return [
    {
      label: isWA ? `${city} Bush Camp (< 3.5 hrs)` : `${city} + Dog (< 3.5 hrs)`,
      prompt: isWA
        ? `Leaving ${city} Friday afternoon, 2 adults. Tent camping, under 3.5 hours driving.`
        : `Leaving ${city} Friday afternoon, 2 adults and a dog. Tent camping, under 3.5 hours driving.`
    },
    {
      label: `Family Weekend (< 2 hrs)`,
      prompt: `Two adults, two kids. Leaving ${city} Saturday morning, under 2 hours driving, toilets essential.`
    },
    {
      label: `4WD Bush Camp Escape`,
      prompt: `Under 4 hours drive from ${city}, 4WD tracks preferred, quiet bush camping.`
    },
    {
      label: `Quick Friday Overnight`,
      prompt: `Leaving ${city} Friday after work, back Saturday evening, under 90 minutes drive.`
    }
  ];
}

export const PRESET_QUERIES = getPresetQueries("Sydney", "NSW");

const MAJOR_AU_ORIGINS = [
  { city: "Sydney", state: "NSW", latitude: -33.8688, longitude: 151.2093 },
  { city: "Melbourne", state: "VIC", latitude: -37.8136, longitude: 144.9631 },
  { city: "Brisbane", state: "QLD", latitude: -27.4698, longitude: 153.0251 },
  { city: "Perth", state: "WA", latitude: -31.9505, longitude: 115.8605 },
  { city: "Adelaide", state: "SA", latitude: -34.9285, longitude: 138.6007 },
  { city: "Hobart", state: "TAS", latitude: -42.8821, longitude: 147.3272 },
  { city: "Canberra", state: "ACT", latitude: -35.2809, longitude: 149.1300 },
  { city: "Darwin", state: "NT", latitude: -12.4634, longitude: 130.8456 }
];

export default function FindWeekendPlanner({ onSelectSiteOnMap, onOpenSaveModal, startLocation, onUpdateStartLocation }: FindWeekendPlannerProps) {
  const city = startLocation?.city || "Sydney";
  const state = startLocation?.state || "NSW";
  const presets = useMemo(() => getPresetQueries(city, state), [city, state]);

  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const activePrompt = userPrompt ?? presets[0].prompt;
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<TripCardData[]>([]);
  const [assumedOrigin, setAssumedOrigin] = useState<string | null>(null);
  const [limitingConstraint, setLimitingConstraint] = useState<string | null>(null);
  const [suggestedAdjustments, setSuggestedAdjustments] = useState<string[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [prepCampsite, setPrepCampsite] = useState<{ id: number; name: string } | null>(null);
  const [showTripRoom, setShowTripRoom] = useState(false);
  const [whatIfInput, setWhatIfInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [checkInSite, setCheckInSite] = useState<{ id: number; name: string } | null>(null);
  const [inspectFact, setInspectFact] = useState<{ fact: Fact; label: string; campsiteName: string } | null>(null);
  const [showOfflineVault, setShowOfflineVault] = useState(false);
  const [offlineCount, setOfflineCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return getOfflineTrips().length;
  });
  const [savedOfflineIds, setSavedOfflineIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    return getOfflineTrips().map(t => t.id);
  });
  const [planBCampsite, setPlanBCampsite] = useState<TripCardData | null>(null);

  const handleSwapWithPlanB = (alt: PlanBAlternative) => {
    if (!planBCampsite) return;
    setCards(prev => prev.map(c => {
      if (c.id === planBCampsite.id) {
        return {
          ...c,
          id: alt.id,
          name: alt.name,
          state: alt.state,
          latitude: alt.latitude ?? c.latitude,
          longitude: alt.longitude ?? c.longitude,
          dog_friendly: alt.dog_friendly ?? c.dog_friendly,
          management_type: alt.management_type ?? c.management_type,
          driving_time_minutes: alt.driving_time_minutes ?? c.driving_time_minutes,
          highlight_badge: "Plan B Swap",
          why_it_fits: [alt.reason],
          facts: alt.facts ? (alt.facts as unknown as CampsiteFacts) : c.facts,
        };
      }
      return c;
    }));
  };

  const handleSaveOffline = (card: TripCardData) => {
    saveTripOffline(card);
    setSavedOfflineIds(prev => [...new Set([...prev, card.id])]);
    setOfflineCount(getOfflineTrips().length);
  };

  const [targetWeekend, setTargetWeekend] = useState<"this_weekend" | "next_weekend">("this_weekend");

  const [lastRequest, setLastRequest] = useState<Record<string, unknown>>({
    prompt: presets[0].prompt,
    origin_lat: startLocation?.latitude ?? -33.8688,
    origin_lng: startLocation?.longitude ?? 151.2093,
    max_drive_hours: 3.5,
    target_weekend: "this_weekend"
  });

  const handleSearch = useCallback(async (
    searchPrompt?: string, 
    overrideLocation?: StartLocation,
    overrideWeekend?: "this_weekend" | "next_weekend"
  ) => {
    const loc = overrideLocation || startLocation;
    const q = searchPrompt !== undefined ? searchPrompt : (userPrompt ?? presets[0].prompt);
    const wk = overrideWeekend || targetWeekend;
    setLoading(true);
    setLimitingConstraint(null);
    setSuggestedAdjustments([]);

    const originLat = loc?.latitude ?? -33.8688;
    const originLng = loc?.longitude ?? 151.2093;

    try {
      const payload = {
        prompt: q,
        origin_lat: originLat,
        origin_lng: originLng,
        target_weekend: wk
      };
      setLastRequest(payload);

      const res = await fetch(`${getApiUrl()}/trips/find-weekend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: FindWeekendResponse = await res.json();
        setCards(data.cards || []);
        setLimitingConstraint(data.limiting_constraint || null);
        setSuggestedAdjustments(data.suggested_adjustments || []);
        setAssumedOrigin(data.assumed_origin || null);
      }
    } catch (err) {
      console.error("Failed to find weekend trips:", err);
    } finally {
      setLoading(false);
    }
  }, [startLocation, userPrompt, presets, targetWeekend]);

  const handleWhatIfAdjust = async (instruction: string) => {
    if (!instruction) return;
    setAdjusting(true);
    try {
      const res = await fetch(`${getApiUrl()}/trips/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_request: lastRequest,
          instruction: instruction
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
        setLimitingConstraint(data.limiting_constraint || null);
        setSuggestedAdjustments(data.suggested_adjustments || []);
        setLastRequest(data.updated_request || lastRequest);
        if (data.assumed_origin !== undefined) {
          setAssumedOrigin(data.assumed_origin || null);
        }
        setWhatIfInput("");
      }
    } catch (err) {
      console.error("Adjustment failed:", err);
    } finally {
      setAdjusting(false);
    }
  };

  // Run search when location is resolved or changed
  const prevLocKey = useRef<string>("");
  useEffect(() => {
    const currentLocKey = `${city}_${state}_${startLocation?.latitude?.toFixed(2)}_${startLocation?.longitude?.toFixed(2)}`;
    if (prevLocKey.current !== currentLocKey) {
      prevLocKey.current = currentLocKey;
      const q = userPrompt ?? presets[0].prompt;
      handleSearch(q, startLocation);
    }
  }, [city, state, startLocation, presets, userPrompt, handleSearch]);

  const toggleCompare = (id: number) => {
    setSelectedForCompare(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id].slice(-3)
    );
  };

  const comparedCards = cards.filter(c => selectedForCompare.includes(c.id));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8 text-ink">
      {/* HERO & SEARCH BAR */}
      <div className="flex flex-col text-left max-w-3xl">
        <h1 className="t-display text-ink mb-2">
          Find a campground that fits your weekend.
        </h1>
        <p className="t-lede text-base mb-4">
          Matched to your group, vehicle and gear. Every answer shows where it came from.
        </p>

        {/* ORIGIN LOCATION & TARGET WEEKEND CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-paper-card border border-paper-rule text-xs text-ink shadow-sheet">
              <MapPin size={13} className="text-ochre" />
              <span>Departing from <strong className="text-ink font-semibold">{city}, {state}</strong></span>
              {startLocation?.isDetected && (
                <span className="t-micro text-[10px] text-eucalypt bg-eucalypt-tint px-1.5 py-0.5 rounded-xs border border-eucalypt/30">
                  {startLocation.source === "gps" ? "GPS" : "IP"}
                </span>
              )}
              <button
                onClick={() => setShowOriginDropdown(!showOriginDropdown)}
                className="t-data text-xs text-eucalypt hover:underline ml-1 font-semibold cursor-pointer"
              >
                {showOriginDropdown ? "Close" : "Change city"}
              </button>
            </div>

            {/* QUICK ORIGIN SWITCHER DROPDOWN */}
            {showOriginDropdown && (
              <div className="absolute top-10 left-0 z-30 bg-paper-card border border-paper-rule rounded-sm p-2 shadow-overlay grid grid-cols-2 sm:grid-cols-4 gap-1 min-w-[320px]">
                {MAJOR_AU_ORIGINS.map(origin => (
                  <button
                    key={origin.city}
                    onClick={() => {
                      setShowOriginDropdown(false);
                      const newLoc: StartLocation = {
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                        city: origin.city,
                        state: origin.state,
                        isDetected: false,
                        source: "default"
                      };
                      if (onUpdateStartLocation) {
                        onUpdateStartLocation(newLoc);
                      }
                    }}
                    className={`t-label text-xs px-2.5 py-1.5 rounded-xs text-left transition-colors cursor-pointer ${
                      city === origin.city
                        ? "bg-eucalypt text-paper-card font-medium"
                        : "text-ink-muted hover:bg-paper-sunk hover:text-ink"
                    }`}
                  >
                    {origin.city}, {origin.state}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TARGET WEEKEND SELECTOR */}
          <div className="inline-flex items-center p-0.5 rounded-sm bg-paper-card border border-paper-rule text-xs shadow-sheet">
            <Calendar size={13} className="text-eucalypt ml-2 mr-1" />
            <button
              onClick={() => {
                setTargetWeekend("this_weekend");
                handleSearch(undefined, undefined, "this_weekend");
              }}
              className={`px-2.5 py-1 rounded-xs t-label text-xs transition-colors cursor-pointer ${
                targetWeekend === "this_weekend"
                  ? "bg-eucalypt text-paper-card font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              This Weekend
            </button>
            <button
              onClick={() => {
                setTargetWeekend("next_weekend");
                handleSearch(undefined, undefined, "next_weekend");
              }}
              className={`px-2.5 py-1 rounded-xs t-label text-xs transition-colors cursor-pointer ${
                targetWeekend === "next_weekend"
                  ? "bg-eucalypt text-paper-card font-medium"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Next Weekend
            </button>
          </div>
        </div>

        {/* INPUT FORM */}
        <div className="w-full bg-paper-card border border-paper-rule rounded-sm p-1.5 shadow-sheet flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3 text-ink-faint" size={16} />
            <input 
              type="text"
              value={activePrompt}
              onChange={e => {
                setUserPrompt(e.target.value);
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={`e.g. 2 adults, kids and a dog, leaving ${city} Friday, under 3 hours...`}
              className="w-full bg-transparent pl-9 pr-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint font-sans"
            />
          </div>
          <Button 
            onClick={() => handleSearch()}
            disabled={loading}
            variant="primary"
            size="md"
            className="shrink-0"
          >
            {loading ? (
              <span className="animate-spin">◌</span>
            ) : (
              <>Find My 3 Trips <ArrowRight size={16} /></>
            )}
          </Button>
        </div>

        {/* PRESET QUERY CHIPS */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span className="t-micro text-ink-faint">Suggestions:</span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUserPrompt(preset.prompt);
                handleSearch(preset.prompt);
              }}
              className="t-label text-xs text-eucalypt hover:underline hover:text-eucalypt-hover transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIMITING CONSTRAINT BANNER (When zero or restricted) */}
      {limitingConstraint && (
        <div className="bg-ochre-tint border border-ochre/30 p-4 rounded-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-ink">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="text-ochre shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="t-label text-sm font-semibold text-ochre">Limiting constraint identified</h4>
              <p className="t-body text-xs text-ink-muted mt-0.5">{limitingConstraint}</p>
            </div>
          </div>
          {suggestedAdjustments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {suggestedAdjustments.map((adj, i) => (
                <button
                  key={i}
                  onClick={() => handleWhatIfAdjust(adj)}
                  className="bg-paper-card hover:bg-paper-sunk border border-paper-rule text-ink text-xs px-2.5 py-1 rounded-xs font-medium transition-colors cursor-pointer"
                >
                  {adj}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ASSUMED ORIGIN TRANSPARENCY BANNER */}
      {assumedOrigin && cards.length > 0 && (
        <div className="bg-paper-sunk border border-paper-rule px-3.5 py-2 rounded-sm text-xs text-ink-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-trust-official shrink-0" />
            <span className="t-body text-xs">
              Search routed from assumed origin: <strong className="text-ink font-semibold">{assumedOrigin}</strong>. Drive times & distances are estimates from here.
            </span>
          </div>
          <span className="t-data text-[11px] text-ink-faint shrink-0">
            Set your departure town or enable GPS for exact drive times
          </span>
        </div>
      )}

      {/* THREE TRIP CARDS GRID */}
      {cards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-paper-rule">
            <div>
              <h2 className="t-title text-ink">
                Recommended campsites
              </h2>
              <p className="t-lede text-xs">Ranked by driving efficiency & condition fit</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowOfflineVault(true)}
                title="View cached offline trip cards for zero-reception bush areas"
              >
                <WifiOff size={13} className="text-ochre" /> Offline trips ({offlineCount})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTripRoom(true)}
                title="Coordinate with your group in a shared room"
              >
                <Users size={13} className="text-eucalypt" /> Trip room
              </Button>
              {selectedForCompare.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCompareModal(true)}
                >
                  <SlidersHorizontal size={13} /> Compare ({selectedForCompare.length})
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, index) => (
              <FieldGuideLedgerCard
                key={card.id}
                card={card}
                index={index}
                isCompared={selectedForCompare.includes(card.id)}
                isSavedOffline={savedOfflineIds.includes(card.id)}
                startLocation={startLocation}
                onToggleCompare={toggleCompare}
                onSaveOffline={handleSaveOffline}
                onOpenSaveModal={onOpenSaveModal}
                onOpenPlanB={(c) => setPlanBCampsite(c)}
                onOpenPrep={(site) => setPrepCampsite(site)}
                onOpenCheckIn={(site) => setCheckInSite(site)}
                onInspectFact={(info) => setInspectFact(info)}
                onSelectSiteOnMap={(id) => onSelectSiteOnMap(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* "WHAT-IF" ADJUSTMENT TOOLBAR */}
      {cards.length > 0 && (
        <div className="bg-paper-card border border-paper-rule rounded-sm p-4 shadow-sheet flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-ink">
            <SlidersHorizontal size={16} className="text-eucalypt shrink-0" />
            <div>
              <h4 className="t-label text-sm font-semibold text-ink">Need to adjust? Ask &apos;What If?&apos;</h4>
              <p className="t-lede text-xs">Recalculates tradeoffs immediately</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              "Allow another 45 mins driving",
              "Dog must be allowed",
              "Show tent-only sites",
              "Under 2 hours drive only"
            ].map((chip, i) => (
              <button
                key={i}
                onClick={() => handleWhatIfAdjust(chip)}
                disabled={adjusting}
                className="bg-paper-sunk hover:bg-paper-rule/40 text-ink border border-paper-rule px-2.5 py-1 rounded-xs text-xs t-label transition-colors cursor-pointer disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="w-full md:w-auto flex gap-2">
            <input 
              type="text"
              value={whatIfInput}
              onChange={e => setWhatIfInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleWhatIfAdjust(whatIfInput)}
              placeholder="e.g. Leave Saturday morning..."
              className="bg-paper-sunk border border-paper-rule rounded-xs px-2.5 py-1 text-xs text-ink outline-none w-full md:w-48 placeholder:text-ink-faint focus:border-eucalypt"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleWhatIfAdjust(whatIfInput)}
              disabled={adjusting || !whatIfInput}
            >
              Apply
            </Button>
          </div>
        </div>
      )}


      {/* SIDE-BY-SIDE COMPARE MODAL */}
      {showCompareModal && comparedCards.length > 0 && (
        <CompareTrayModal
          cards={comparedCards}
          onClose={() => setShowCompareModal(false)}
          onSelectSite={(id) => {
            setShowCompareModal(false);
            onSelectSiteOnMap(id);
          }}
          onOpenSaveModal={(id, name) => {
            setShowCompareModal(false);
            onOpenSaveModal(id, name);
          }}
        />
      )}

      {/* PLAN B ALTERNATIVES MODAL */}
      {planBCampsite && (
        <PlanBModal
          originalCampsite={planBCampsite}
          originLat={startLocation?.latitude}
          originLng={startLocation?.longitude}
          onClose={() => setPlanBCampsite(null)}
          onSwapWithAlternative={(alt) => {
            if (alt) handleSwapWithPlanB(alt);
            setPlanBCampsite(null);
          }}
          onSaveAlternative={(id, name) => {
            onOpenSaveModal(id, name);
          }}
        />
      )}

      {/* FLOATING COMPARE TRAY BAR */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1E2A24] border border-[#2F5D50]/50 rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-4 text-xs">
          <span className="text-[#FAF6EF] font-bold flex items-center gap-1.5">
            <Scale size={14} className="text-[#C9822B]" /> <span>{selectedForCompare.length} campsite{selectedForCompare.length > 1 ? "s" : ""} selected</span>
          </span>
          <button
            onClick={() => setShowCompareModal(true)}
            className="bg-[#2F5D50] hover:bg-[#254A40] text-white px-3.5 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            Compare Side-by-Side
          </button>
          <button
            onClick={() => setSelectedForCompare([])}
            className="text-[#E2DAC8] hover:text-white text-xs font-medium cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* PHASE 2: PERSONAL PREPARATION BOARD MODAL */}
      {prepCampsite && (
        <PreparationBoard
          campsiteId={prepCampsite.id}
          campsiteName={prepCampsite.name}
          partySize={2}
          hasDog={cards.find(c => c.id === prepCampsite.id)?.dog_friendly === true}
          onClose={() => setPrepCampsite(null)}
        />
      )}

      {/* PHASE 2: SHARED TRIP ROOM MODAL */}
      {showTripRoom && (
        <TripRoomModal
          initialCards={cards}
          onClose={() => setShowTripRoom(false)}
        />
      )}

      {/* 10-SECOND GROUND CHECK-IN MODAL */}
      {checkInSite && (
        <GroundCheckInModal
          campsiteId={checkInSite.id}
          campsiteName={checkInSite.name}
          onClose={() => setCheckInSite(null)}
          onCheckInSuccess={() => {
            handleSearch();
          }}
        />
      )}

      {/* BUSH MODE OFFLINE VAULT MODAL */}
      {showOfflineVault && (
        <OfflineBushVaultModal
          onClose={() => {
            setShowOfflineVault(false);
            setOfflineCount(getOfflineTrips().length);
          }}
          onSelectSite={(id) => {
            setShowOfflineVault(false);
            onSelectSiteOnMap(id);
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
            const card = cards.find(c => c.name === inspectFact.campsiteName);
            if (card) {
              setCheckInSite({ id: card.id, name: card.name });
            }
          }}
        />
      )}
    </div>
  );
}
