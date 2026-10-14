"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  MapPin, 
  Calendar, 
  AlertCircle, 
  ExternalLink, 
  SlidersHorizontal, 
  Search, 
  ArrowRight, 
  Users, 
  ClipboardList, 
  WifiOff, 
  Navigation, 
  Compass,
  Car,
  Wifi,
  Flame,
  Droplets,
  Layers,
  Dog,
  Shuffle,
  Clock,
  Backpack,
  Download,
  Check,
  Radio,
  Scale
} from "lucide-react";
import { getApiUrl } from "@/config";
import PreparationBoard from "./PreparationBoard";
import TripRoomModal from "./TripRoomModal";
import GroundCheckInModal from "./GroundCheckInModal";
import OfflineBushVaultModal, { saveTripOffline, getOfflineTrips } from "./OfflineBushVaultModal";
import FactChip from "./trust/FactChip";
import ConfidenceMeter from "./trust/ConfidenceMeter";
import SourceSheet from "./trust/SourceSheet";
import FireStrip from "./trust/FireStrip";
import WhyItFitsRadar from "./graphics/WhyItFitsRadar";
import WeekendWeatherRibbon from "./graphics/WeekendWeatherRibbon";
import CompareTrayModal from "./graphics/CompareTrayModal";
import PlanBModal, { PlanBAlternative } from "./trust/PlanBModal";
import { CampsiteFacts, Fact } from "@/types/facts";

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
      label: isWA ? `🚙 ${city} Bush Camp (< 3.5 hrs)` : `🐶 ${city} + Dog (< 3.5 hrs)`,
      prompt: isWA
        ? `Leaving ${city} Friday afternoon, 2 adults. Tent camping, under 3.5 hours driving.`
        : `Leaving ${city} Friday afternoon, 2 adults and a dog. Tent camping, under 3.5 hours driving.`
    },
    {
      label: `👨‍👩‍👧 Family Weekend (< 2 hrs)`,
      prompt: `Two adults, two kids. Leaving ${city} Saturday morning, under 2 hours driving, toilets essential.`
    },
    {
      label: `🚙 4WD Bush Camp Escape`,
      prompt: `Under 4 hours drive from ${city}, 4WD tracks preferred, quiet bush camping.`
    },
    {
      label: `🏕️ Quick Friday Overnight`,
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
  const [cardViewMode, setCardViewMode] = useState<Record<number, "glance" | "radar" | "weather">>({});

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
          dog_friendly: alt.dog_friendly,
          management_type: alt.management_type,
          driving_time_minutes: alt.driving_time_minutes ?? c.driving_time_minutes,
          highlight_badge: "Plan B Swap",
          why_it_fits: [alt.reason],
          facts: alt.facts || c.facts,
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

  const [lastRequest, setLastRequest] = useState<Record<string, unknown>>({
    prompt: presets[0].prompt,
    origin_lat: startLocation?.latitude ?? -33.8688,
    origin_lng: startLocation?.longitude ?? 151.2093,
    max_drive_hours: 3.5
  });

  const handleSearch = useCallback(async (searchPrompt?: string, overrideLocation?: StartLocation) => {
    const loc = overrideLocation || startLocation;
    const q = searchPrompt !== undefined ? searchPrompt : (userPrompt ?? presets[0].prompt);
    setLoading(true);
    setLimitingConstraint(null);
    setSuggestedAdjustments([]);

    const originLat = loc?.latitude ?? -33.8688;
    const originLng = loc?.longitude ?? 151.2093;

    try {
      const payload = {
        prompt: q,
        origin_lat: originLat,
        origin_lng: originLng
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
  }, [startLocation, userPrompt, presets]);

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
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* HERO & SEARCH BAR */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF2E6] border border-[#E8CFA9] text-[#9A5C0E] text-xs font-bold uppercase tracking-wider mb-3">
          <Compass size={14} className="text-[#C9822B]" /> Answer-First Weekend Finder
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-[#1E2A24] tracking-tight mb-3">
          Turn your free weekend into <br className="hidden md:block"/>
          <span className="text-[#2F5D50]">the right camping trip</span>
        </h1>
        <p className="text-[#536259] text-sm md:text-base mb-4 font-medium">
          Condition-aware trip cards matched to your group, your vehicle, and your gear. No 50,000 dots to guess from.
        </p>

        {/* ORIGIN LOCATION BADGE */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFFFF] border border-[#E2DAC8] text-xs text-[#1E2A24] shadow-xs">
            <MapPin size={14} className="text-[#C9822B]" />
            <span>Departing from <strong className="text-[#1E2A24]">{city}, {state}</strong></span>
            {startLocation?.isDetected && (
              <span className="text-[10px] text-[#2F5D50] bg-[#EBF2EE] px-2 py-0.5 rounded-full font-bold border border-[#2F5D50]/20">
                {startLocation.source === "gps" ? "GPS Location" : "IP Detected"}
              </span>
            )}
            <button
              onClick={() => setShowOriginDropdown(!showOriginDropdown)}
              className="text-[11px] text-[#2F5D50] hover:underline ml-1 font-bold cursor-pointer"
            >
              {showOriginDropdown ? "Close" : "Change City"}
            </button>
          </div>

          {/* QUICK ORIGIN SWITCHER DROPDOWN */}
          {showOriginDropdown && (
            <div className="absolute top-10 z-30 bg-[#FFFFFF] border border-[#E2DAC8] rounded-xl p-2.5 shadow-2xl grid grid-cols-2 sm:grid-cols-4 gap-1.5 min-w-[320px]">
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
                  className={`text-xs px-3 py-2 rounded-lg text-left font-semibold transition-all cursor-pointer ${
                    city === origin.city
                      ? "bg-[#2F5D50] text-white shadow-xs"
                      : "text-[#536259] hover:bg-[#FAF6EF] hover:text-[#1E2A24]"
                  }`}
                >
                  {origin.city}, {origin.state}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INPUT FORM */}
        <div className="w-full bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl p-2 shadow-md flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 text-[#8B9891]" size={18} />
            <input 
              type="text"
              value={activePrompt}
              onChange={e => {
                setUserPrompt(e.target.value);
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={`e.g. 2 adults, kids and a dog, leaving ${city} Friday, under 3 hours...`}
              className="w-full bg-transparent pl-11 pr-4 py-3 text-sm md:text-base text-[#1E2A24] outline-none placeholder:text-[#8B9891] font-medium"
            />
          </div>
          <button 
            onClick={() => handleSearch()}
            disabled={loading}
            className="bg-[#2F5D50] text-white px-6 py-3 rounded-xl font-bold text-sm md:text-base hover:bg-[#24493F] transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? (
              <span className="animate-spin">◌</span>
            ) : (
              <>Find My 3 Trips <ArrowRight size={18} /></>
            )}
          </button>
        </div>

        {/* PRESET QUERY CHIPS */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <span className="text-xs text-[#536259] mr-1 font-semibold">Try:</span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUserPrompt(preset.prompt);
                handleSearch(preset.prompt);
              }}
              className="text-xs bg-[#FFFFFF] hover:bg-[#FAF6EF] text-[#536259] hover:text-[#1E2A24] border border-[#E2DAC8] px-3.5 py-1.5 rounded-full transition-all cursor-pointer font-medium shadow-2xs"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIMITING CONSTRAINT BANNER (When zero or restricted) */}
      {limitingConstraint && (
        <div className="bg-[#FAF2E6] border border-[#E8CFA9] p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[#7A4506] shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-[#C9822B] shrink-0 mt-0.5" size={22} />
            <div>
              <h4 className="font-bold text-base text-[#9A5C0E]">Limiting Constraint Identified</h4>
              <p className="text-sm text-[#7A4506]/90 mt-0.5">{limitingConstraint}</p>
            </div>
          </div>
          {suggestedAdjustments.length > 0 && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {suggestedAdjustments.map((adj, i) => (
                <button
                  key={i}
                  onClick={() => handleWhatIfAdjust(adj)}
                  className="bg-[#FFFFFF] hover:bg-[#FAF6EF] border border-[#E8CFA9] text-[#9A5C0E] text-xs px-3 py-2 rounded-lg font-bold transition-all cursor-pointer shadow-2xs"
                >
                  ⚡ {adj}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ASSUMED ORIGIN TRANSPARENCY BANNER */}
      {assumedOrigin && cards.length > 0 && (
        <div className="bg-[#F0F7FB] border border-[#BAE0F3] px-4 py-2.5 rounded-xl text-xs text-[#1F6FB2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Compass size={15} className="text-[#1F6FB2] shrink-0" />
            <span>
              Search routed from assumed origin: <strong className="text-[#1E2A24] font-bold">{assumedOrigin}</strong>. Drive times & distances are estimates from here.
            </span>
          </div>
          <span className="text-[11px] text-[#1F6FB2]/80 shrink-0">
            Set your departure town or enable GPS for exact drive times
          </span>
        </div>
      )}

      {/* THREE TRIP CARDS GRID */}
      {cards.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              <span className="text-[var(--color-neon-green)]">🎯 Your 3 Recommended Trips</span>
              <span className="text-xs text-gray-400 font-normal">Ranked by driving efficiency & condition fit</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOfflineVault(true)}
                className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="View cached offline trip cards for zero-reception bush areas"
              >
                <WifiOff size={14} className="text-amber-400" /> Bush Vault ({offlineCount})
              </button>
              <button
                onClick={() => setShowTripRoom(true)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Coordinate with your group in a shared room"
              >
                <Users size={14} className="text-[var(--color-neon-green)]" /> Shared Trip Room
              </button>
              {selectedForCompare.length > 1 && (
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <SlidersHorizontal size={14} /> Compare ({selectedForCompare.length})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, index) => {
              const isCompared = selectedForCompare.includes(card.id);
              const isSavedOffline = savedOfflineIds.includes(card.id);
              const driveHours = Math.floor(card.driving_time_minutes / 60);
              const driveMins = card.driving_time_minutes % 60;
              const photoUrl = card.photo_url || "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?auto=format&fit=crop&w=800&q=80";

              return (
                <div 
                  key={card.id}
                  className="bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl flex flex-col justify-between shadow-xs hover:shadow-md hover:border-[#2F5D50]/40 transition-all relative overflow-hidden group"
                >
                  {/* HERO VISUAL COVER PHOTO BANNER */}
                  <div className="relative h-44 w-full overflow-hidden shrink-0">
                    <img 
                      src={photoUrl} 
                      alt={card.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1E2A24]/90 via-[#1E2A24]/40 to-transparent" />

                    {card.is_illustrative_photo && (
                      <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-[9px] text-gray-200 px-1.5 py-0.5 rounded border border-white/20 uppercase tracking-wider">
                        Illustrative Photo
                      </div>
                    )}

                    {/* TOP FLOATING CONTROLS */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="bg-[#1E2A24]/85 backdrop-blur-md text-[#FAF6EF] border border-white/20 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shadow-xs">
                        {card.highlight_badge || `#${index + 1} Pick`}
                      </span>
                      <span className="bg-[#1E2A24]/85 backdrop-blur-md text-[#FAF6EF] border border-white/20 text-[10px] px-2.5 py-1 rounded-full font-medium shadow-xs flex items-center gap-1">
                        <Clock size={11} className="text-[#C9822B]" /> {driveHours > 0 ? `${driveHours}h ` : ""}{driveMins}m
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() => handleSaveOffline(card)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold backdrop-blur-md border transition-all cursor-pointer shadow-xs flex items-center gap-1 ${
                          isSavedOffline
                            ? "bg-[#C9822B] text-white border-[#C9822B]"
                            : "bg-[#1E2A24]/75 hover:bg-[#1E2A24] text-white border-white/20"
                        }`}
                        title={isSavedOffline ? "Saved in Offline Bush Vault" : "Save for offline bush mode"}
                      >
                        <Download size={11} /> {isSavedOffline ? "Saved" : "Offline"}
                      </button>

                      <button
                        onClick={() => toggleCompare(card.id)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold backdrop-blur-md border transition-all cursor-pointer shadow-xs flex items-center gap-1 ${
                          isCompared 
                            ? "bg-[#2F5D50] text-white border-[#2F5D50]" 
                            : "bg-[#1E2A24]/75 hover:bg-[#1E2A24] text-white border-white/20"
                        }`}
                      >
                        {isCompared ? <><Check size={11} /> Compared</> : "+ Compare"}
                      </button>
                    </div>

                    {/* TITLE & LOCATION OVERLAY */}
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-lg font-black text-white leading-tight drop-shadow-sm group-hover:text-[#FAF6EF] transition-colors">
                        {card.name}
                      </h3>
                      <p className="text-[11px] text-[#FAF6EF]/90 flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin size={11} className="text-[#E2DAC8]" />
                        {card.state} • {card.management_type || "Public Reserve"} • {card.driving_distance_km}km
                      </p>
                    </div>
                  </div>

                  {/* BODY CONTENT */}
                  <div className="p-4 flex flex-col gap-3">
                    {/* PERSPECTIVE SELECTOR (Glance / 5-Axis Radar / Weather Ribbon) */}
                    <div className="flex items-center justify-between bg-[#F6F1E7] p-1 rounded-xl border border-[#E2DAC8] text-[11px]">
                      <button
                        onClick={() => setCardViewMode(prev => ({ ...prev, [card.id]: "glance" }))}
                        className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          (cardViewMode[card.id] || "glance") === "glance"
                            ? "bg-[#FFFFFF] text-[#1E2A24] shadow-xs border border-[#E2DAC8]"
                            : "text-[#536259] hover:text-[#1E2A24]"
                        }`}
                      >
                        Glance
                      </button>
                      <button
                        onClick={() => setCardViewMode(prev => ({ ...prev, [card.id]: "radar" }))}
                        className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          cardViewMode[card.id] === "radar"
                            ? "bg-[#2F5D50] text-white shadow-xs"
                            : "text-[#536259] hover:text-[#1E2A24]"
                        }`}
                      >
                        5-Axis Radar
                      </button>
                      <button
                        onClick={() => setCardViewMode(prev => ({ ...prev, [card.id]: "weather" }))}
                        className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                          cardViewMode[card.id] === "weather"
                            ? "bg-[#1F6FB2] text-white shadow-xs"
                            : "text-[#536259] hover:text-[#1E2A24]"
                        }`}
                      >
                        Weather Ribbon
                      </button>
                    </div>

                    {/* PERSPECTIVE VIEWS */}
                    {cardViewMode[card.id] === "radar" ? (
                      <div className="py-1">
                        <WhyItFitsRadar card={card} size={190} />
                      </div>
                    ) : cardViewMode[card.id] === "weather" ? (
                      <div className="py-1">
                        <WeekendWeatherRibbon campsiteName={card.name} isForecastWindow={true} />
                      </div>
                    ) : (
                      <>
                        {/* SITE CONFIDENCE METER */}
                        <ConfidenceMeter 
                          knownCount={card.facts?.known_facts_count ?? (card.facilities ? 6 : 4)}
                          totalCount={card.facts?.total_facts_count ?? 9}
                          officialCount={card.facts?.official_or_verified_count ?? (card.data_status === "verified" ? 4 : 2)}
                        />

                        {/* 6-PILL VISUAL ATTRIBUTE HUD WITH TRUST LENS */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <FactChip
                            label="Access"
                            icon={<Car size={11} className="text-[#536259]" />}
                            displayValue={card.visual_badges?.clearance || (card.vehicle_clearance === "4WD_ONLY" ? "4WD Only" : "2WD Easy")}
                            fact={card.facts?.vehicle_access}
                            onInspect={() => {
                              const fact: Fact = card.facts?.vehicle_access || {
                                value: card.vehicle_clearance,
                                basis: "official",
                                confidence: 2,
                                source: card.source_url || "Park Dataset",
                                note: card.vehicle_clearance === "4WD_ONLY" ? "High clearance 4WD required" : "Accessible by standard 2WD vehicles"
                              };
                              setInspectFact({ fact, label: "Vehicle Access", campsiteName: card.name });
                            }}
                          />

                          <FactChip
                            label="Telco"
                            icon={<Wifi size={11} className="text-[#536259]" />}
                            displayValue={card.visual_badges?.telco || "Coverage Unspecified"}
                            fact={card.facts?.telco}
                            onInspect={() => {
                              const fact: Fact = card.facts?.telco || {
                                value: card.visual_badges?.telco || null,
                                basis: card.visual_badges?.telco ? "community" : "unknown",
                                confidence: card.visual_badges?.telco ? 2 : 0,
                                source: card.visual_badges?.telco ? "Recent Camper Check-in" : undefined,
                                note: card.visual_badges?.telco ? `Carrier coverage: ${card.visual_badges.telco}` : "Mobile signal unverified — download offline maps before travel"
                              };
                              setInspectFact({ fact, label: "Mobile Reception", campsiteName: card.name });
                            }}
                          />

                          <FactChip
                            label="Campfire"
                            icon={<Flame size={11} className="text-[#536259]" />}
                            displayValue={card.visual_badges?.campfire || "Check Fire Rules"}
                            fact={card.facts?.campfires}
                            onInspect={() => {
                              const fact: Fact = card.facts?.campfires || {
                                value: card.visual_badges?.campfire === "Fire Pits Allowed",
                                basis: card.facilities?.campfires !== undefined ? "official" : "unknown",
                                confidence: card.facilities?.campfires !== undefined ? 2 : 0,
                                source: card.source_url || "Park facilities dataset",
                                note: card.visual_badges?.campfire || "Campfire regulations unverified — verify current fire danger ratings and park signs"
                              };
                              setInspectFact({ fact, label: "Campfires", campsiteName: card.name });
                            }}
                          />

                          <FactChip
                            label="Water"
                            icon={<Droplets size={11} className="text-[#536259]" />}
                            displayValue={card.visual_badges?.water || "Water Unverified"}
                            fact={card.facts?.water}
                            onInspect={() => {
                              const fact: Fact = card.facts?.water || {
                                value: card.visual_badges?.water || null,
                                basis: card.facilities?.drinking_water !== undefined ? "official" : "unknown",
                                confidence: card.facilities?.drinking_water !== undefined ? 2 : 0,
                                source: card.source_url || "Park facilities dataset",
                                note: card.visual_badges?.water || "Water availability unverified — carry all drinking water"
                              };
                              setInspectFact({ fact, label: "Water", campsiteName: card.name });
                            }}
                          />

                          <FactChip
                            label="Toilets"
                            icon={<Layers size={11} className="text-[#536259]" />}
                            displayValue={card.visual_badges?.toilets || "Toilets Unverified"}
                            fact={card.facts?.toilets}
                            onInspect={() => {
                              const fact: Fact = card.facts?.toilets || {
                                value: card.visual_badges?.toilets || null,
                                basis: card.facilities?.toilets ? "official" : "unknown",
                                confidence: card.facilities?.toilets ? 2 : 0,
                                source: card.source_url || "Park facilities dataset",
                                note: card.visual_badges?.toilets || "Toilet facilities unverified — carry necessary hygiene supplies"
                              };
                              setInspectFact({ fact, label: "Toilets", campsiteName: card.name });
                            }}
                          />

                          <FactChip
                            label="Pets"
                            icon={<Dog size={11} className="text-[#536259]" />}
                            displayValue={card.dog_friendly === true ? "Dogs OK" : card.dog_friendly === false ? "No Pets" : "Check Regulations"}
                            fact={card.facts?.dog_friendly}
                            onInspect={() => {
                              const fact: Fact = card.facts?.dog_friendly || {
                                value: card.dog_friendly,
                                basis: card.dog_friendly === false && card.state === "NSW" && (card.management_type?.includes("National Park") || card.management_type?.includes("NPWS")) ? "rule" : (card.dog_friendly !== null ? "official" : "unknown"),
                                confidence: card.dog_friendly !== null ? 3 : 0,
                                source: card.source_url || "National Parks policy",
                                note: card.dog_friendly === true ? "Dogs allowed on leash" : card.dog_friendly === false ? "Dogs strictly prohibited under state conservation rules" : "Pet policy unconfirmed — check with local ranger"
                              };
                              setInspectFact({ fact, label: "Pet Policy", campsiteName: card.name });
                            }}
                          />
                        </div>

                        {/* LIVE FIRE AGENCY & DISTRICT STRIP */}
                        <FireStrip 
                          fireDistrict={card.fire_district} 
                          fireFact={card.facts?.fire_status} 
                          state={card.state} 
                        />
                      </>
                    )}

                    {/* GEAR-FIT BADGE (D9) */}
                    <div className="bg-[#FAF6EF] border border-[#E2DAC8] px-3 py-2 rounded-xl text-xs flex items-center justify-between text-[#1E2A24]">
                      <span className="font-medium text-[11px] flex items-center gap-1.5">
                        <Backpack size={13} className="text-[#2F5D50]" />
                        <strong className="text-[#1E2A24]">Gear Fit:</strong> 15°C Summer Quilt / Light Bag <Check size={12} className="inline text-[#2F5D50]" />
                      </span>
                      <span className="text-[10px] text-[#536259] font-bold">Overnight ~14°C</span>
                    </div>

                    {/* LIVE COMMUNITY GROUND REPORT & 10S CHECK-IN */}
                    <div className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 overflow-hidden text-[#536259]">
                        <Radio size={12} className="text-[#2F5D50] shrink-0" />
                        <span className="text-[#2F5D50] font-bold text-[10px] uppercase shrink-0">Field Reports (14d):</span>
                        {card.community_signals && Object.keys(card.community_signals).length > 0 ? (
                          <span className="text-[11px] text-[#536259] truncate">
                            {card.community_signals.water === "dry" ? "Creek Dry" : card.community_signals.water === "flowing" ? "Creek Flowing" : "Water Unreported"} • {" "}
                            {card.community_signals.toilets === "clean" ? "Clean" : card.community_signals.toilets === "dirty" ? "Needs Attention" : "Toilets Unreported"} • {" "}
                            {card.community_signals.vibe === "full" ? "Full" : card.community_signals.vibe === "quiet" ? "Quiet" : "Space"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#536259]/80 italic truncate">
                            No recent field reports — be the first to check in
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setCheckInSite({ id: card.id, name: card.name })}
                        className="shrink-0 bg-[#FFFFFF] hover:bg-[#F6F1E7] text-[#2F5D50] border border-[#2F5D50]/30 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        title="Report real conditions at this campsite in 10 seconds"
                      >
                        ⚡ 10s Check-in
                      </button>
                    </div>

                    {/* THE MAIN COMPROMISE */}
                    <div className="bg-[#FFF9EE] border border-[#F0D5A8] px-3 py-2 rounded-xl text-xs text-[#8A5818] flex items-start gap-2">
                      <AlertCircle size={13} className="text-[#C9822B] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#8A5818] uppercase text-[10px] mr-1">The Catch:</span>
                        <span className="text-[11px] leading-relaxed text-[#536259]">{card.main_compromise}</span>
                      </div>
                    </div>

                    {/* COST & BOOKING WINDOW */}
                    <div className="flex items-center justify-between text-xs py-1 px-1 border-t border-[#E2DAC8]/60">
                      <div>
                        <span className="text-[#536259] text-[11px]">Fee: </span>
                        <span className="font-bold text-[#1E2A24] text-xs">{card.estimated_cost}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                        card.booking_type === "FIRST_COME_FIRST_SERVED"
                          ? "bg-[#EBF2EE] text-[#2F5D50] border border-[#2F5D50]/20"
                          : card.booking_type === "ONLINE_BOOKING_REQUIRED"
                          ? "bg-[#FFF9EE] text-[#8A5818] border border-[#C9822B]/30"
                          : card.booking_type === "FREE_REGISTRATION_REQUIRED"
                          ? "bg-[#EBF2EE] text-[#2F5D50] border border-[#2F5D50]/20"
                          : "bg-[#EEF5FA] text-[#1F6FB2] border border-[#1F6FB2]/30"
                      }`}>
                        {card.booking_type === "FIRST_COME_FIRST_SERVED"
                          ? "No Booking Req"
                          : card.booking_type === "ONLINE_BOOKING_REQUIRED"
                          ? "Booking Req"
                          : card.booking_type === "FREE_REGISTRATION_REQUIRED"
                          ? "Free Permit ($0)"
                          : "Operator Portal"}
                      </span>
                    </div>

                    {/* ONE-TAP DIRECT GPS NAVIGATION BUTTONS */}
                    {(() => {
                      const originParam = startLocation?.latitude && startLocation?.longitude 
                        ? `&origin=${startLocation.latitude},${startLocation.longitude}` 
                        : "";
                      const googleMapsUrl = originParam
                        ? `https://www.google.com/maps/dir/?api=1${originParam}&destination=${card.latitude},${card.longitude}&travelmode=driving`
                        : `https://www.google.com/maps/search/?api=1&query=${card.latitude},${card.longitude}`;
                      const appleMapsUrl = startLocation?.latitude && startLocation?.longitude
                        ? `https://maps.apple.com/?saddr=${startLocation.latitude},${startLocation.longitude}&daddr=${card.latitude},${card.longitude}&dirflg=d`
                        : `https://maps.apple.com/?daddr=${card.latitude},${card.longitude}`;

                      return (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E2DAC8]/60">
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#1E2A24] py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors border border-[#E2DAC8]"
                          >
                            <Navigation size={12} className="text-[#1F6FB2]" /> Google Maps
                          </a>
                          <a
                            href={appleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#1E2A24] py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors border border-[#E2DAC8]"
                          >
                            <Compass size={12} className="text-[#2F5D50]" /> Apple Maps
                          </a>
                        </div>
                      );
                    })()}
                  </div>

                  {/* BOTTOM ACTION BUTTONS */}
                  <div className="p-3 pt-0 flex gap-2">
                    <button
                      onClick={() => onOpenSaveModal(card.id, card.name)}
                      className="flex-1 bg-[#2F5D50] hover:bg-[#254A40] text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Calendar size={13} /> Save & Monitor
                    </button>
                    <button
                      onClick={() => setPlanBCampsite(card)}
                      className="bg-[#FFF9EE] hover:bg-[#FFF3DC] text-[#8A5818] border border-[#F0D5A8] px-2.5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Inspect condition-aware Plan B alternatives"
                    >
                      <Shuffle size={13} className="text-[#C9822B]" /> Plan B
                    </button>
                    <button
                      onClick={() => setPrepCampsite({ id: card.id, name: card.name })}
                      className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#1E2A24] border border-[#E2DAC8] px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Open Condition-Aware Preparation Board"
                    >
                      <ClipboardList size={13} className="text-[#536259]" /> Prep
                    </button>
                    <button
                      onClick={() => onSelectSiteOnMap(card.id)}
                      className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#1E2A24] border border-[#E2DAC8] px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="View on Map"
                    >
                      <MapPin size={13} className="text-[#536259]" /> Map
                    </button>
                    {card.booking_url && (
                      <a
                        href={card.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#536259] border border-[#E2DAC8] px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
                        title="Official Booking Information"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* "WHAT-IF" ADJUSTMENT TOOLBAR */}
      {cards.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#1E2A24]">
            <SlidersHorizontal size={20} className="text-[#2F5D50]" />
            <div>
              <h4 className="font-bold text-sm text-[#1E2A24]">Need to adjust? Ask &apos;What If?&apos;</h4>
              <p className="text-xs text-[#536259]">Our engine recalculates tradeoffs immediately</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                className="bg-[#FAF6EF] hover:bg-[#F6F1E7] text-[#1E2A24] border border-[#E2DAC8] px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
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
              className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl px-3 py-1.5 text-xs text-[#1E2A24] outline-none w-full md:w-48 placeholder:text-[#536259]/60 focus:border-[#2F5D50]"
            />
            <button
              onClick={() => handleWhatIfAdjust(whatIfInput)}
              disabled={adjusting || !whatIfInput}
              className="bg-[#2F5D50] hover:bg-[#254A40] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              Apply
            </button>
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
            handleSwapWithPlanB(alt);
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
