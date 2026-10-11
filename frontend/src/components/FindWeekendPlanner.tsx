"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Car, 
  Dog, 
  MapPin, 
  Calendar, 
  AlertCircle, 
  ExternalLink, 
  SlidersHorizontal, 
  Check, 
  ShieldCheck,
  Search,
  ArrowRight,
  Users,
  ClipboardList,
  Clock
} from "lucide-react";
import { getApiUrl } from "@/config";
import PreparationBoard from "./PreparationBoard";
import TripRoomModal from "./TripRoomModal";

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
}

interface FindWeekendResponse {
  cards: TripCardData[];
  limiting_constraint: string | null;
  suggested_adjustments: string[];
  parsed_criteria?: Record<string, unknown>;
}

interface FindWeekendPlannerProps {
  onSelectSiteOnMap: (campsiteId: number) => void;
  onOpenSaveModal: (campsiteId: number, campsiteName: string) => void;
  startLocation?: { latitude: number; longitude: number };
}

const PRESET_QUERIES = [
  {
    label: "🐶 Sydney + Dog (< 3.5 hrs)",
    prompt: "Leaving Sydney Friday afternoon, 2 adults and a dog. Tent camping, under 3.5 hours driving."
  },
  {
    label: "👨‍👩‍👧 Family Weekend (< 2 hrs)",
    prompt: "Two adults, two kids. Leaving Sydney Saturday morning, under 2 hours driving, toilets essential."
  },
  {
    label: "🚙 4WD Bush Camp Escape",
    prompt: "Under 4 hours drive from Sydney, 4WD tracks preferred, quiet bush camping."
  },
  {
    label: "🏕️ Quick Friday Overnight",
    prompt: "Leaving Sydney Friday after work, back Saturday evening, under 90 minutes drive."
  }
];

export default function FindWeekendPlanner({ onSelectSiteOnMap, onOpenSaveModal, startLocation }: FindWeekendPlannerProps) {
  const [prompt, setPrompt] = useState(PRESET_QUERIES[0].prompt);
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
  const [lastRequest, setLastRequest] = useState<Record<string, unknown>>({
    prompt: PRESET_QUERIES[0].prompt,
    origin_lat: startLocation?.latitude ?? -33.8688,
    origin_lng: startLocation?.longitude ?? 151.2093,
    max_drive_hours: 3.5
  });

  const handleSearch = async (searchPrompt?: string) => {
    const q = searchPrompt !== undefined ? searchPrompt : prompt;
    setLoading(true);
    setLimitingConstraint(null);
    setSuggestedAdjustments([]);

    try {
      const payload = {
        prompt: q,
        origin_lat: startLocation?.latitude ?? -33.8688,
        origin_lng: startLocation?.longitude ?? 151.2093
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
  };

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

  useEffect(() => {
    let isCancelled = false;
    const loadInitial = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/trips/find-weekend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: PRESET_QUERIES[0].prompt,
            origin_lat: -33.8688,
            origin_lng: 151.2093
          })
        });
        if (res.ok && !isCancelled) {
          const data: FindWeekendResponse = await res.json();
          setCards(data.cards || []);
          setLimitingConstraint(data.limiting_constraint || null);
          setSuggestedAdjustments(data.suggested_adjustments || []);
        }
      } catch (e) {
        console.error("Initial search failed:", e);
      }
    };
    loadInitial();
    return () => {
      isCancelled = true;
    };
  }, []);

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
        <p className="text-gray-300 text-sm md:text-base mb-6">
          Condition-aware trip cards matched to your group, your vehicle, and your gear. No 50,000 dots to guess from.
        </p>

        {/* INPUT FORM */}
        <div className="w-full bg-black/40 border border-white/15 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 text-gray-400" size={18} />
            <input 
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. 2 adults, kids and a dog, leaving Sydney Friday, under 3 hours..."
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
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(preset.prompt);
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
              const driveHours = Math.floor(card.driving_time_minutes / 60);
              const driveMins = card.driving_time_minutes % 60;

              return (
                <div 
                  key={card.id}
                  className="bg-[#0f2c22]/90 border border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-2xl hover:border-emerald-500/40 transition-all backdrop-blur-md relative overflow-hidden group"
                >
                  {/* TOP BADGES */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-emerald-500/20 text-[var(--color-neon-green)] border border-emerald-500/40 text-xs px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                      {card.highlight_badge || `#${index + 1} Pick`}
                    </span>
                    <button
                      onClick={() => toggleCompare(card.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                        isCompared 
                          ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] border-[var(--color-neon-green)]" 
                          : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {isCompared && <Check size={12} />}
                      {isCompared ? "Comparing" : "+ Compare"}
                    </button>
                  </div>

                  {/* TITLE & LOCATION */}
                  <div>
                    <h3 className="text-2xl font-black text-white group-hover:text-[var(--color-neon-green)] transition-colors">
                      {card.name}
                    </h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 font-medium">
                      <MapPin size={13} className="text-emerald-400" />
                      {card.state} • {card.management_type || "Public Reserve"}
                    </p>

                    {/* STATS CHIPS */}
                    <div className="grid grid-cols-2 gap-2 my-4">
                      <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                          <Car size={12} /> Drive Time
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">
                          {driveHours > 0 ? `${driveHours}h ` : ""}{driveMins}m
                          <span className="text-[11px] text-gray-400 font-normal ml-1">({card.driving_distance_km}km)</span>
                        </div>
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                          <Dog size={12} /> Pet Policy
                        </div>
                        <div className="text-sm font-black mt-0.5">
                          {card.dog_friendly === true ? (
                            <span className="text-green-400">Dogs Allowed</span>
                          ) : card.dog_friendly === false ? (
                            <span className="text-gray-400">No Pets</span>
                          ) : (
                            <span className="text-yellow-400">Unverified</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* WHY IT FITS */}
                    <div className="mb-4">
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ShieldCheck size={14} /> Why It Fits Your Weekend
                      </div>
                      <ul className="space-y-1.5 text-xs text-gray-200">
                        {card.why_it_fits.map((reason, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-1.5">
                            <span className="text-[var(--color-neon-green)] font-bold shrink-0">✓</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* THE MAIN COMPROMISE */}
                    <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl mb-4 text-xs text-amber-200/90">
                      <div className="font-bold text-amber-300 uppercase tracking-wider text-[10px] mb-0.5 flex items-center gap-1">
                        <AlertCircle size={12} /> The Main Compromise
                      </div>
                      <p>{card.main_compromise}</p>
                    </div>

                    {/* AVAILABILITY STRATEGY & BOOKING WINDOW */}
                    <div className="bg-black/40 border border-emerald-500/20 p-3 rounded-xl mb-4 text-xs">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <Clock size={12} /> Availability Strategy
                        </span>
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
                            ? "No Booking Required"
                            : card.booking_type === "ONLINE_BOOKING_REQUIRED"
                            ? "Online Booking Req"
                            : card.booking_type === "FREE_REGISTRATION_REQUIRED"
                            ? "Free Permit ($0)"
                            : "Operator Portal"}
                        </span>
                      </div>
                      <p className="text-gray-300 text-[11px] leading-relaxed">
                        {card.availability_window || card.booking_status}
                      </p>
                    </div>

                    {/* COST */}
                    <div className="flex items-center justify-between text-xs text-gray-300 py-1.5 border-t border-white/10 mb-4">
                      <div>
                        <span className="text-gray-400">Estimated Cost: </span>
                        <span className="font-bold text-white">{card.estimated_cost}</span>
                      </div>
                      <div className="font-medium text-[11px] text-gray-400">
                        {card.management_type || "Verified Reserve"}
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => onOpenSaveModal(card.id, card.name)}
                      className="flex-1 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Calendar size={14} /> Save & Monitor
                    </button>
                    <button
                      onClick={() => setPrepCampsite({ id: card.id, name: card.name })}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Open Condition-Aware Preparation Board"
                    >
                      <ClipboardList size={14} /> Prep
                    </button>
                    <button
                      onClick={() => onSelectSiteOnMap(card.id)}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="View on Map"
                    >
                      <MapPin size={14} /> Map
                    </button>
                    {card.booking_url && (
                      <a
                        href={card.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/5 hover:bg-white/15 text-gray-300 px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
                        title="Official Booking Information"
                      >
                        <ExternalLink size={14} />
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
    </div>
  );
}
