"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Sparkles, 
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
  Compass 
} from "lucide-react";
import { getApiUrl } from "@/config";
import PreparationBoard from "./PreparationBoard";
import TripRoomModal from "./TripRoomModal";
import GroundCheckInModal from "./GroundCheckInModal";
import OfflineBushVaultModal, { saveTripOffline, getOfflineTrips } from "./OfflineBushVaultModal";

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
}

interface FindWeekendResponse {
  cards: TripCardData[];
  limiting_constraint: string | null;
  suggested_adjustments: string[];
  parsed_criteria?: Record<string, unknown>;
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
  const [limitingConstraint, setLimitingConstraint] = useState<string | null>(null);
  const [suggestedAdjustments, setSuggestedAdjustments] = useState<string[]>([]);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [prepCampsite, setPrepCampsite] = useState<{ id: number; name: string } | null>(null);
  const [showTripRoom, setShowTripRoom] = useState(false);
  const [whatIfInput, setWhatIfInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [checkInSite, setCheckInSite] = useState<{ id: number; name: string } | null>(null);
  const [showOfflineVault, setShowOfflineVault] = useState(false);
  const [offlineCount, setOfflineCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return getOfflineTrips().length;
  });
  const [savedOfflineIds, setSavedOfflineIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    return getOfflineTrips().map(t => t.id);
  });

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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[var(--color-neon-green)] text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles size={14} /> Answer-First Weekend Finder
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3">
          Turn your free weekend into <br className="hidden md:block"/>
          <span className="text-[var(--color-neon-green)]">the right camping trip</span>
        </h1>
        <p className="text-gray-300 text-sm md:text-base mb-4">
          Condition-aware trip cards matched to your group, your vehicle, and your gear. No 50,000 dots to guess from.
        </p>

        {/* ORIGIN LOCATION BADGE */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 border border-white/15 text-xs text-gray-200 backdrop-blur-md shadow-lg">
            <MapPin size={14} className="text-[var(--color-neon-green)]" />
            <span>Departing from <strong className="text-white">{city}, {state}</strong></span>
            {startLocation?.isDetected && (
              <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                {startLocation.source === "gps" ? "📍 GPS Location" : "🌐 IP Detected"}
              </span>
            )}
            <button
              onClick={() => setShowOriginDropdown(!showOriginDropdown)}
              className="text-[11px] text-[var(--color-neon-green)] hover:underline ml-1 font-bold cursor-pointer"
            >
              {showOriginDropdown ? "Close" : "Change City"}
            </button>
          </div>

          {/* QUICK ORIGIN SWITCHER DROPDOWN */}
          {showOriginDropdown && (
            <div className="absolute top-10 z-30 bg-slate-900/95 border border-white/20 rounded-xl p-2.5 shadow-2xl backdrop-blur-md grid grid-cols-2 sm:grid-cols-4 gap-1.5 min-w-[320px]">
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
                  className={`text-xs px-3 py-2 rounded-lg text-left font-medium transition-all cursor-pointer ${
                    city === origin.city
                      ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] font-black shadow"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {origin.city}, {origin.state}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INPUT FORM */}
        <div className="w-full bg-black/40 border border-white/15 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 text-gray-400" size={18} />
            <input 
              type="text"
              value={activePrompt}
              onChange={e => {
                setUserPrompt(e.target.value);
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={`e.g. 2 adults, kids and a dog, leaving ${city} Friday, under 3 hours...`}
              className="w-full bg-transparent pl-11 pr-4 py-3 text-sm md:text-base text-white outline-none placeholder:text-gray-500 font-medium"
            />
          </div>
          <button 
            onClick={() => handleSearch()}
            disabled={loading}
            className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-6 py-3 rounded-xl font-black text-sm md:text-base hover:bg-[#00e67a] transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.25)]"
          >
            {loading ? (
              <span className="animate-spin">🔄</span>
            ) : (
              <>Find My 3 Trips <ArrowRight size={18} /></>
            )}
          </button>
        </div>

        {/* PRESET QUERY CHIPS */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <span className="text-xs text-gray-400 mr-1 font-semibold">Try:</span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUserPrompt(preset.prompt);
                handleSearch(preset.prompt);
              }}
              className="text-xs bg-white/5 hover:bg-white/15 text-gray-200 border border-white/10 px-3 py-1.5 rounded-full transition-all cursor-pointer font-medium"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIMITING CONSTRAINT BANNER (When zero or restricted) */}
      {limitingConstraint && (
        <div className="bg-amber-950/60 border border-amber-500/40 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-200 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={22} />
            <div>
              <h4 className="font-bold text-base text-amber-300">Limiting Constraint Identified</h4>
              <p className="text-sm text-amber-200/90 mt-0.5">{limitingConstraint}</p>
            </div>
          </div>
          {suggestedAdjustments.length > 0 && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {suggestedAdjustments.map((adj, i) => (
                <button
                  key={i}
                  onClick={() => handleWhatIfAdjust(adj)}
                  className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs px-3 py-2 rounded-lg font-bold transition-all cursor-pointer"
                >
                  ⚡ {adj}
                </button>
              ))}
            </div>
          )}
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
                  className="bg-[#0b2019]/95 border border-emerald-500/25 rounded-2xl flex flex-col justify-between shadow-2xl hover:border-emerald-500/50 transition-all backdrop-blur-md relative overflow-hidden group"
                >
                  {/* HERO VISUAL COVER PHOTO BANNER */}
                  <div className="relative h-44 w-full overflow-hidden shrink-0">
                    <img 
                      src={photoUrl} 
                      alt={card.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b2019] via-[#0b2019]/50 to-black/40" />

                    {/* TOP FLOATING CONTROLS */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="bg-black/70 backdrop-blur-md text-[var(--color-neon-green)] border border-emerald-500/40 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow">
                        {card.highlight_badge || `#${index + 1} Pick`}
                      </span>
                      <span className="bg-black/70 backdrop-blur-md text-gray-200 border border-white/10 text-[10px] px-2.5 py-1 rounded-full font-bold shadow">
                        ⏱️ {driveHours > 0 ? `${driveHours}h ` : ""}{driveMins}m
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() => handleSaveOffline(card)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-black backdrop-blur-md border transition-all cursor-pointer shadow ${
                          isSavedOffline
                            ? "bg-amber-400 text-black border-amber-300"
                            : "bg-black/60 hover:bg-black/80 text-white border-white/20"
                        }`}
                        title={isSavedOffline ? "Saved in Offline Bush Vault" : "Save for offline bush mode"}
                      >
                        {isSavedOffline ? "💾 Cached" : "📥 Offline"}
                      </button>

                      <button
                        onClick={() => toggleCompare(card.id)}
                        className={`text-[10px] px-2 py-1 rounded-lg font-black backdrop-blur-md border transition-all cursor-pointer shadow ${
                          isCompared 
                            ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] border-[var(--color-neon-green)]" 
                            : "bg-black/60 hover:bg-black/80 text-white border-white/20"
                        }`}
                      >
                        {isCompared ? "✓ Compared" : "+ Compare"}
                      </button>
                    </div>

                    {/* TITLE & LOCATION OVERLAY */}
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-xl font-black text-white leading-tight drop-shadow-md group-hover:text-[var(--color-neon-green)] transition-colors">
                        {card.name}
                      </h3>
                      <p className="text-[11px] text-emerald-300/90 flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin size={11} className="text-emerald-400" />
                        {card.state} • {card.management_type || "Public Reserve"} • {card.driving_distance_km}km
                      </p>
                    </div>
                  </div>

                  {/* BODY CONTENT */}
                  <div className="p-4 flex flex-col gap-3">
                    {/* 6-PILL VISUAL ATTRIBUTE HUD */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          🚗 Access
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.visual_badges?.clearance || (card.vehicle_clearance === "4WD_ONLY" ? "4WD Only" : "2WD Easy")}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          📶 Telco
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.visual_badges?.telco || "Telstra 4G"}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          🔥 Fire
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.visual_badges?.campfire || "Fire Pits"}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          💧 Water
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.visual_badges?.water || "Drinking Water"}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          🧻 Toilets
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.visual_badges?.toilets || "Drop Toilets"}
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-lg p-1.5 text-center">
                        <div className="text-[10px] text-gray-400 font-semibold flex items-center justify-center gap-1">
                          🐶 Pets
                        </div>
                        <div className="text-[11px] font-bold text-white mt-0.5 truncate">
                          {card.dog_friendly === true ? "Dogs OK" : card.dog_friendly === false ? "No Pets" : "Unknown"}
                        </div>
                      </div>
                    </div>

                    {/* LIVE COMMUNITY GROUND REPORT & 10S CHECK-IN */}
                    <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 overflow-hidden text-gray-300">
                        <span className="text-[var(--color-neon-green)] font-black text-[10px] uppercase shrink-0">📡 Ground:</span>
                        <span className="text-[11px] text-gray-300 truncate">
                          {card.community_signals?.water === "dry" ? "❌ Creek Dry" : "💧 Creek Flowing"} • {" "}
                          {card.community_signals?.toilets === "clean" ? "✨ Clean" : "⚠️ Bring TP"} • {" "}
                          {card.community_signals?.vibe === "full" ? "🔴 Full" : "🟢 Space"}
                        </span>
                      </div>
                      <button
                        onClick={() => setCheckInSite({ id: card.id, name: card.name })}
                        className="shrink-0 bg-white/10 hover:bg-white/20 text-[var(--color-neon-green)] border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer"
                        title="Report real conditions at this campsite in 10 seconds"
                      >
                        ⚡ 10s Check-in
                      </button>
                    </div>

                    {/* THE MAIN COMPROMISE */}
                    <div className="bg-amber-950/40 border border-amber-500/30 px-3 py-2 rounded-xl text-xs text-amber-200/90 flex items-start gap-1.5">
                      <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-amber-300 uppercase text-[10px] mr-1">The Catch:</span>
                        <span className="text-[11px] leading-tight">{card.main_compromise}</span>
                      </div>
                    </div>

                    {/* COST & BOOKING WINDOW */}
                    <div className="flex items-center justify-between text-xs py-1 px-1 border-t border-white/5">
                      <div>
                        <span className="text-gray-400 text-[11px]">Fee: </span>
                        <span className="font-bold text-white text-xs">{card.estimated_cost}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                        card.booking_type === "FIRST_COME_FIRST_SERVED"
                          ? "bg-emerald-500/20 text-[var(--color-neon-green)] border border-emerald-500/30"
                          : card.booking_type === "ONLINE_BOOKING_REQUIRED"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : card.booking_type === "FREE_REGISTRATION_REQUIRED"
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
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
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white/5 hover:bg-white/15 text-gray-200 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                          >
                            <Navigation size={12} className="text-cyan-400" /> Google Maps
                          </a>
                          <a
                            href={appleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-white/5 hover:bg-white/15 text-gray-200 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                          >
                            <Compass size={12} className="text-emerald-300" /> Apple Maps
                          </a>
                        </div>
                      );
                    })()}
                  </div>

                  {/* BOTTOM ACTION BUTTONS */}
                  <div className="p-3 pt-0 flex gap-2">
                    <button
                      onClick={() => onOpenSaveModal(card.id, card.name)}
                      className="flex-1 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Calendar size={13} /> Save & Monitor
                    </button>
                    <button
                      onClick={() => setPrepCampsite({ id: card.id, name: card.name })}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Open Condition-Aware Preparation Board"
                    >
                      <ClipboardList size={13} /> Prep
                    </button>
                    <button
                      onClick={() => onSelectSiteOnMap(card.id)}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="View on Map"
                    >
                      <MapPin size={13} /> Map
                    </button>
                    {card.booking_url && (
                      <a
                        href={card.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/5 hover:bg-white/15 text-gray-300 px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
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
        <div className="bg-black/40 border border-white/15 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <SlidersHorizontal size={20} className="text-[var(--color-neon-green)]" />
            <div>
              <h4 className="font-bold text-sm text-white">Need to adjust? Ask &apos;What If?&apos;</h4>
              <p className="text-xs text-gray-400">Our engine recalculates tradeoffs immediately</p>
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
                className="bg-white/5 hover:bg-white/15 text-gray-200 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
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
              className="bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none w-full md:w-48 placeholder:text-gray-500"
            />
            <button
              onClick={() => handleWhatIfAdjust(whatIfInput)}
              disabled={adjusting || !whatIfInput}
              className="bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE COMPARE MODAL */}
      {showCompareModal && comparedCards.length > 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d261e] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-black text-white">Compare Campsites</h3>
                <p className="text-xs text-gray-400">Evaluate tradeoffs across drive time, facilities, and compromises</p>
              </div>
              <button 
                onClick={() => setShowCompareModal(false)}
                className="text-gray-400 hover:text-white p-2 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparedCards.map(c => (
                <div key={c.id} className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-lg font-black text-[var(--color-neon-green)] mb-1">{c.name}</h4>
                    <p className="text-xs text-gray-400 mb-4">{c.state} • {c.management_type || "Public"}</p>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-gray-400 block font-semibold">Drive Time:</span>
                        <span className="text-white font-bold">{Math.floor(c.driving_time_minutes / 60)}h {c.driving_time_minutes % 60}m ({c.driving_distance_km}km)</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Pet Policy:</span>
                        <span className="text-white font-bold">{c.dog_friendly ? "🐶 Dogs Allowed" : "🚫 No Pets"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Vehicle Access:</span>
                        <span className="text-white font-bold">{c.vehicle_clearance}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block font-semibold">Estimated Cost:</span>
                        <span className="text-white font-bold">{c.estimated_cost}</span>
                      </div>
                      <div>
                        <span className="text-amber-400 block font-semibold">Main Compromise:</span>
                        <span className="text-amber-200/90 text-[11px]">{c.main_compromise}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex gap-2">
                    <button
                      onClick={() => {
                        setShowCompareModal(false);
                        onOpenSaveModal(c.id, c.name);
                      }}
                      className="flex-1 bg-[var(--color-neon-green)] text-[var(--color-forest-900)] py-2 rounded-lg font-black text-xs hover:bg-[#00e67a]"
                    >
                      Choose This
                    </button>
                    <button
                      onClick={() => {
                        setShowCompareModal(false);
                        onSelectSiteOnMap(c.id);
                      }}
                      className="bg-white/10 text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-white/20"
                    >
                      Map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    </div>
  );
}
