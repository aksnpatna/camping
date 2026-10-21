"use client";

import React, { useState, useEffect } from "react";
import { X, Shuffle, AlertTriangle, ShieldCheck, Dog, MapPin, CloudSun, Check, Clock } from "lucide-react";
import { getApiUrl } from "@/config";
import { Fact } from "@/types/facts";
import TrustRing from "./TrustRing";
import { Badge } from "@/components/ui/Badge";

export interface AlternativeCampsite {
  id: number;
  name: string;
  state: string;
  latitude?: number;
  longitude?: number;
  driving_distance_km: number;
  driving_time_minutes?: number;
  reason: string;
  conditions_verified?: boolean;
  dog_friendly?: boolean;
  facts?: {
    campfires: Fact<boolean>;
    toilets: Fact<string>;
    water: Fact<string>;
  };
  management_type?: string;
}

export type PlanBAlternative = AlternativeCampsite;

export interface PlanBModalProps {
  isOpen?: boolean;
  onClose: () => void;
  originalCampsite: {
    id: number;
    name: string;
    state: string;
    driving_distance_km: number;
    main_compromise: string;
  };
  onSwapWithAlternative: (alternative?: AlternativeCampsite) => void;
  onSaveAlternative?: (campsiteId: number, campsiteName: string) => void;
  originLat?: number;
  originLng?: number;
}

export default function PlanBModal({
  isOpen = true,
  onClose,
  originalCampsite,
  onSwapWithAlternative,
  onSaveAlternative
}: PlanBModalProps) {
  const [alternatives, setAlternatives] = useState<AlternativeCampsite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [swappedId, setSwappedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchAlternatives = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = getApiUrl();
        const res = await fetch(`${apiUrl}/plan-b/alternatives/${originalCampsite.id}`);
        if (!res.ok) {
          throw new Error("Unable to fetch alternative campsites right now.");
        }
        const data = await res.json();
        if (!isCancelled) {
          setAlternatives(data.alternatives || []);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to fetch Plan B alternatives:", err);
          setError("Failed to load alternatives. Please try again.");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchAlternatives();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, originalCampsite.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-paper-card border border-paper-rule rounded-sm shadow-2xl p-6 text-ink flex flex-col max-h-[90vh]">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink rounded-xs bg-paper-tint hover:bg-paper-sunk transition-colors cursor-pointer"
          aria-label="Close Plan B Modal"
        >
          <X size={16} />
        </button>

        {/* HEADER */}
        <div className="flex items-start gap-3 mb-5 pr-8">
          <div className="w-9 h-9 rounded-xs bg-ochre-tint border border-ochre/30 flex items-center justify-center text-ochre shrink-0">
            <Shuffle size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="warn" size="sm">Alternative sites</Badge>
            </div>
            <h3 className="font-serif text-lg font-semibold text-ink mt-1">
              Alternatives for {originalCampsite.name}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              If rain, extreme fire danger, or road washouts threaten your primary site, these nearby sites preserve your weekend.
            </p>
          </div>
        </div>

        {/* ORIGINAL SITE RECAP */}
        <div className="bg-paper border border-paper-rule rounded-sm p-3 mb-4 flex items-center justify-between text-xs text-ink">
          <div>
            <span className="t-micro text-ink-muted block">Current Choice:</span>
            <span className="font-semibold text-ink text-sm">{originalCampsite.name}</span>
            <span className="text-ink-muted ml-2">({originalCampsite.state} • {originalCampsite.driving_distance_km} km)</span>
          </div>
          <div className="text-right">
            <span className="t-micro text-ochre block">Watch for:</span>
            <span className="text-ink-muted text-xs max-w-[220px] truncate block">
              {originalCampsite.main_compromise}
            </span>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5">
              <div className="w-7 h-7 border-2 border-eucalypt border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-ink-muted">Finding alternative sites…</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-3.5 rounded-sm bg-clay-tint border border-clay/30 text-clay text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && alternatives.length === 0 && (
            <div className="p-8 text-center text-ink-muted text-xs bg-paper rounded-sm border border-paper-rule">
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
                className={`p-4 rounded-sm border transition-colors ${
                  isSwapped
                    ? "bg-eucalypt-tint border-eucalypt shadow-xs"
                    : "bg-paper border-paper-rule hover:border-paper-rule-bold shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="t-micro text-ochre font-bold">
                        Option #{idx + 1}
                      </span>
                      {alt.conditions_verified && (
                        <span className="inline-flex items-center gap-1 t-micro text-eucalypt bg-eucalypt-tint border border-eucalypt/30 px-1.5 py-0.2 rounded-xs">
                          <ShieldCheck size={10} /> Forecast Checked
                        </span>
                      )}
                    </div>
                    <h4 className="font-serif text-base font-semibold text-ink mt-0.5">
                      {alt.name}
                    </h4>
                    <p className="text-[11px] text-ink-muted mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-eucalypt" /> {alt.state} • {alt.management_type || "Public Reserve"}
                      </span>
                      {alt.driving_time_minutes && (
                        <span className="text-ink font-medium flex items-center gap-1">
                          <Clock size={10} className="text-ink-faint" />
                          <span>{driveHours ? `${driveHours}h ` : ""}{driveMins}m drive</span>
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {alt.dog_friendly && (
                      <Badge tone="ok" size="sm" className="flex items-center gap-1">
                        <Dog size={10} /> Dogs OK
                      </Badge>
                    )}
                  </div>
                </div>

                {/* WHY IT MAKES A GREAT PLAN B */}
                <div className="mt-3 p-2.5 rounded-xs bg-ochre-tint border border-ochre/25 text-xs text-ink flex items-start gap-2">
                  <CloudSun size={14} className="text-ochre shrink-0 mt-0.5" />
                  <div>
                    <span className="t-micro text-ochre font-bold mr-1.5">Why swap:</span>
                    <span className="text-[11px] leading-relaxed text-ink">{alt.reason}</span>
                  </div>
                </div>

                {/* TRUST FACTS STRIP */}
                {alt.facts && (
                  <div className="mt-3 pt-2.5 border-t border-paper-rule flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
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
                      <span>Water: {alt.facts.water.value ? "Available" : "Carry in"}</span>
                    </div>
                  </div>
                )}

                {/* ACTION CONTROLS */}
                <div className="mt-3 pt-2.5 border-t border-paper-rule flex items-center justify-between gap-2">
                  <span className="text-[10px] text-ink-faint">
                    Preserves your group intent & departure schedule
                  </span>

                  <div className="flex items-center gap-2">
                    {onSaveAlternative && (
                      <button
                        onClick={() => onSaveAlternative(alt.id, alt.name)}
                        className="bg-paper hover:bg-paper-tint text-ink border border-paper-rule text-xs px-2.5 py-1 rounded-xs font-medium transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSwappedId(alt.id);
                        onSwapWithAlternative(alt);
                      }}
                      className="bg-eucalypt hover:bg-eucalypt/90 text-paper text-xs px-3 py-1 rounded-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      {isSwapped ? (
                        <>
                          <Check size={12} /> Swapped!
                        </>
                      ) : (
                        <>
                          <Shuffle size={12} /> Swap into Trip
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
        <div className="mt-4 pt-3 border-t border-paper-rule flex items-center justify-between text-xs text-ink-muted">
          <span>Active condition monitoring alerts 24h before bad weather shifts.</span>
          <button
            onClick={onClose}
            className="text-ink hover:text-eucalypt font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
