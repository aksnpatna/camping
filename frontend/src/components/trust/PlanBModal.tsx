"use client";

import React, { useState, useEffect } from "react";
import { 
  Shuffle, 
  AlertTriangle, 
  CloudSun, 
  ShieldCheck, 
  X, 
  MapPin, 
  Check, 
  Dog
} from "lucide-react";
import { getApiUrl } from "@/config";
import { TripCardData } from "../FindWeekendPlanner";
import TrustRing from "./TrustRing";
import { CampsiteFacts } from "@/types/facts";

export interface PlanBAlternative {
  id: number;
  name: string;
  state: string;
  management_type: string | null;
  dog_friendly: boolean | null;
  driving_time_minutes: number | null;
  conditions_verified: boolean;
  reason: string;
  latitude: number | null;
  longitude: number | null;
  facts: CampsiteFacts | null;
}

interface PlanBResponse {
  original_campsite_id: number;
  alternatives: PlanBAlternative[];
}

interface PlanBModalProps {
  originalCampsite: TripCardData;
  originLat?: number;
  originLng?: number;
  onClose: () => void;
  onSwapWithAlternative: (alternative: PlanBAlternative) => void;
  onSaveAlternative?: (id: number, name: string) => void;
}

export default function PlanBModal({
  originalCampsite,
  originLat,
  originLng,
  onClose,
  onSwapWithAlternative,
  onSaveAlternative,
}: PlanBModalProps) {
  const [loading, setLoading] = useState(true);
  const [alternatives, setAlternatives] = useState<PlanBAlternative[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [swappedId, setSwappedId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchPlanB() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (originalCampsite.dog_friendly !== null && originalCampsite.dog_friendly !== undefined) {
          params.set("has_dog", String(originalCampsite.dog_friendly));
        }
        if (originalCampsite.vehicle_clearance) {
          params.set("rig_access", originalCampsite.vehicle_clearance);
        }
        if (originLat !== undefined && originLng !== undefined) {
          params.set("origin_lat", String(originLat));
          params.set("origin_lng", String(originLng));
        }
        params.set("limit", "3");

        const res = await fetch(`${getApiUrl()}/campsites/${originalCampsite.id}/plan-b?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load Plan B options: HTTP ${res.status}`);
        }
        const data: PlanBResponse = await res.json();
        if (isMounted) {
          setAlternatives(data.alternatives || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load Plan B alternatives.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPlanB();
    return () => {
      isMounted = false;
    };
  }, [originalCampsite, originLat, originLng]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl shadow-2xl p-6 text-[#1E2A24] overflow-hidden max-h-[92vh] flex flex-col">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#8B9891] hover:text-[#1E2A24] rounded-full bg-[#FAF6EF] hover:bg-[#EFE9DD] transition-colors cursor-pointer"
          aria-label="Close Plan B Modal"
        >
          <X size={18} />
        </button>

        {/* HEADER */}
        <div className="flex items-start gap-3 mb-5 pr-8">
          <div className="w-10 h-10 rounded-xl bg-[#FAF2E6] border border-[#E8CFA9] flex items-center justify-center text-[#C9822B] shrink-0">
            <Shuffle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-[#FAF2E6] text-[#9A5C0E] px-2 py-0.5 rounded border border-[#E8CFA9]">
                Plan B Engine
              </span>
              <span className="text-xs text-[#536259]">Condition-Aware Alternatives</span>
            </div>
            <h3 className="text-xl font-black text-[#1E2A24] mt-0.5">
              Alternatives for {originalCampsite.name}
            </h3>
            <p className="text-xs text-[#536259] mt-1">
              If rain, extreme fire danger, or road washouts threaten your primary site, these nearby sites preserve your weekend.
            </p>
          </div>
        </div>

        {/* ORIGINAL SITE RECAP */}
        <div className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-3 mb-5 flex items-center justify-between text-xs text-[#1E2A24]">
          <div>
            <span className="text-[10px] text-[#536259] uppercase block font-bold">Current Primary Choice:</span>
            <span className="font-bold text-[#1E2A24] text-sm">{originalCampsite.name}</span>
            <span className="text-[#536259] ml-2">({originalCampsite.state} • {originalCampsite.driving_distance_km} km)</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#9A5C0E] block uppercase font-bold">The Catch:</span>
            <span className="text-[#C9822B] text-xs font-semibold max-w-[220px] truncate block">
              {originalCampsite.main_compromise}
            </span>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Scanning proximity, weather radar, and dog/vehicle clearance...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && alternatives.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-xs bg-white/5 rounded-xl border border-white/10">
              No matching alternative campgrounds found within your drive window.
            </div>
          )}

          {!loading && !error && alternatives.map((alt, idx) => {
            const driveHours = alt.driving_time_minutes ? Math.floor(alt.driving_time_minutes / 60) : null;
            const driveMins = alt.driving_time_minutes ? alt.driving_time_minutes % 60 : null;
            const isSwapped = swappedId === alt.id;

            return (
              <div
                key={alt.id}
                className={`p-4 rounded-xl border transition-all ${
                  isSwapped
                    ? "bg-[#EBF2EE] border-[#2F5D50] shadow-xs"
                    : "bg-[#FAF6EF] border-[#E2DAC8] hover:border-[#2F5D50]/40 shadow-2xs"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#9A5C0E]">
                        Option #{idx + 1}
                      </span>
                      {alt.conditions_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#2F5D50] bg-[#EBF2EE] border border-[#2F5D50]/30 px-1.5 py-0.2 rounded font-bold">
                          <ShieldCheck size={11} /> Forecast Checked
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-black text-[#1E2A24] mt-1">
                      {alt.name}
                    </h4>
                    <p className="text-[11px] text-[#536259] mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-[#8B9891]" /> {alt.state} • {alt.management_type || "Public Reserve"}
                      </span>
                      {alt.driving_time_minutes && (
                        <span className="text-[#2F5D50] font-semibold">
                          ⏱️ {driveHours ? `${driveHours}h ` : ""}{driveMins}m drive
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {alt.dog_friendly && (
                      <span className="text-[10px] bg-[#FFFFFF] text-[#2F5D50] px-2 py-0.5 rounded-full border border-[#E2DAC8] font-bold flex items-center gap-1" title="Dog friendly">
                        <Dog size={11} /> Dogs OK
                      </span>
                    )}
                  </div>
                </div>

                {/* WHY IT MAKES A GREAT PLAN B */}
                <div className="mt-3 p-2.5 rounded-lg bg-[#FAF2E6] border border-[#E8CFA9] text-xs text-[#9A5C0E] flex items-start gap-2">
                  <CloudSun size={15} className="text-[#C9822B] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#9A5C0E] mr-1.5">Why Swap:</span>
                    <span className="text-[11px] leading-relaxed text-[#7A4506]">{alt.reason}</span>
                  </div>
                </div>

                {/* TRUST FACTS STRIP */}
                {alt.facts && (
                  <div className="mt-3 pt-2.5 border-t border-[#E2DAC8] flex flex-wrap items-center gap-3 text-[11px] text-[#536259]">
                    <div className="flex items-center gap-1">
                      <TrustRing basis={alt.facts.campfires.basis} confidence={alt.facts.campfires.confidence} size="sm" />
                      <span>Fires: {alt.facts.campfires.value === true ? "Permitted" : alt.facts.campfires.value === false ? "Prohibited" : "Unverified"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrustRing basis={alt.facts.toilets.basis} confidence={alt.facts.toilets.confidence} size="sm" />
                      <span>Toilets: {alt.facts.toilets.value ? String(alt.facts.toilets.value) : "Unverified"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrustRing basis={alt.facts.water.basis} confidence={alt.facts.water.confidence} size="sm" />
                      <span>Water: {alt.facts.water.value ? "Available" : "Carry In"}</span>
                    </div>
                  </div>
                )}

                {/* ACTION CONTROLS */}
                <div className="mt-3 pt-2.5 border-t border-[#E2DAC8] flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#8B9891]">
                    Preserves your group intent & departure schedule
                  </span>

                  <div className="flex items-center gap-2">
                    {onSaveAlternative && (
                      <button
                        onClick={() => onSaveAlternative(alt.id, alt.name)}
                        className="bg-[#FFFFFF] hover:bg-[#FAF6EF] text-[#1E2A24] border border-[#E2DAC8] text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSwappedId(alt.id);
                        onSwapWithAlternative(alt);
                      }}
                      className="bg-[#2F5D50] hover:bg-[#24493F] text-white text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      {isSwapped ? (
                        <>
                          <Check size={13} /> Swapped!
                        </>
                      ) : (
                        <>
                          <Shuffle size={13} /> Swap into Trip
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="mt-4 pt-3 border-t border-[#E2DAC8] flex items-center justify-between text-xs text-[#536259]">
          <span>Active condition monitoring auto-alerts 24h before bad weather shifts.</span>
          <button
            onClick={onClose}
            className="text-[#1E2A24] hover:text-[#2F5D50] font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
