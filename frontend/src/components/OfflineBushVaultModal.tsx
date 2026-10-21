"use client";

import React, { useState, useEffect } from "react";
import { X, WifiOff, Trash2, Navigation, Download, MapPin, Car, Dog, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { TripCardData } from "./FindWeekendPlanner";

export interface OfflineBushVaultModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSelectSite?: (campsiteId: number) => void;
}

export const OFFLINE_STORAGE_KEY = "campsmart_offline_vault_v1";

export function getOfflineTrips(): TripCardData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTripOffline(card: TripCardData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const existing = getOfflineTrips();
    const filtered = existing.filter((t) => t.id !== card.id);
    filtered.unshift(card);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

export function removeTripOffline(cardId: number): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getOfflineTrips();
    const updated = existing.filter((t) => t.id !== cardId);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore error
  }
}

export default function OfflineBushVaultModal({
  isOpen = true,
  onClose,
  onSelectSite
}: OfflineBushVaultModalProps) {
  const [trips, setTrips] = useState<TripCardData[]>(() => {
    return typeof window !== "undefined" ? getOfflineTrips() : [];
  });

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setTrips(getOfflineTrips());
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleDelete = (id: number) => {
    removeTripOffline(id);
    setTrips(getOfflineTrips());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-paper-card border border-paper-rule rounded-sm shadow-2xl p-6 text-ink flex flex-col max-h-[88vh]">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ink-muted hover:text-ink rounded-xs bg-paper-tint hover:bg-paper-sunk transition-colors cursor-pointer"
          aria-label="Close offline vault"
        >
          <X size={16} />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="w-9 h-9 rounded-xs bg-ochre-tint border border-ochre/30 flex items-center justify-center text-ochre">
            <WifiOff size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-semibold tracking-tight text-ink">Offline trips</h3>
              <Badge tone="warn" size="sm">Ready offline</Badge>
            </div>
            <p className="text-xs text-ink-muted">
              Cached trip cards, GPS coordinates, and safety rules available 100% offline.
            </p>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {trips.length === 0 ? (
            <div className="py-12 text-center text-ink-muted flex flex-col items-center gap-2.5">
              <Download size={28} className="text-ink-faint" />
              <p className="text-xs font-semibold text-ink">No campsites saved offline yet.</p>
              <p className="text-xs max-w-sm text-ink-muted">
                Tap <span className="text-eucalypt font-medium">Save offline</span> on any recommended trip card before you leave mobile reception.
              </p>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-paper border border-paper-rule rounded-sm p-4 flex flex-col gap-2.5 hover:border-paper-rule-bold transition-colors shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 
                        onClick={() => onSelectSite && onSelectSite(trip.id)}
                        className={`font-serif text-base font-semibold text-ink ${onSelectSite ? "cursor-pointer hover:underline" : ""}`}
                      >
                        {trip.name}
                      </h4>
                      {trip.highlight_badge && (
                        <Badge tone="ok" size="sm">{trip.highlight_badge}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-eucalypt" />
                      <span>{trip.state} • {trip.management_type || "Public Reserve"} • {trip.driving_distance_km}km</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="p-1 text-ink-muted hover:text-clay rounded-xs hover:bg-paper-tint transition-colors cursor-pointer"
                    title="Remove from offline trips"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* GRAPHICAL CHIPS */}
                <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
                  <span className="bg-paper-card border border-paper-rule px-2 py-0.5 rounded-xs flex items-center gap-1">
                    <Car size={11} className="text-ink-faint" />
                    <span>{trip.vehicle_clearance === "4WD_ONLY" ? "4WD Only" : "2WD Friendly"}</span>
                  </span>
                  <span className="bg-paper-card border border-paper-rule px-2 py-0.5 rounded-xs flex items-center gap-1">
                    <Dog size={11} className="text-ink-faint" />
                    <span>{trip.dog_friendly ? "Dogs Allowed" : "No Pets"}</span>
                  </span>
                  <span className="bg-paper-card border border-paper-rule px-2 py-0.5 rounded-xs">
                    {trip.estimated_cost}
                  </span>
                  <span className="bg-paper-card border border-paper-rule px-2 py-0.5 rounded-xs flex items-center gap-1">
                    <Clock size={11} className="text-ink-faint" />
                    <span>{Math.floor(trip.driving_time_minutes / 60)}h {trip.driving_time_minutes % 60}m</span>
                  </span>
                </div>

                {/* WATCH FOR */}
                <div className="bg-ochre-tint border border-ochre/25 px-3 py-1.5 rounded-xs text-xs text-ink">
                  <span className="font-bold text-ochre text-[10px] uppercase block tracking-wider">Watch for:</span>
                  <span className="text-xs text-ink-muted">{trip.main_compromise}</span>
                </div>

                {/* GPS ACTIONS */}
                <div className="flex items-center gap-2 pt-1 border-t border-paper-rule/60">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${trip.latitude},${trip.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-paper-card hover:bg-paper-tint text-ink border border-paper-rule py-1.5 rounded-xs text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Navigation size={12} className="text-eucalypt" />
                    <span>Open in Google Maps</span>
                  </a>
                  <a
                    href={`https://maps.apple.com/?daddr=${trip.latitude},${trip.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-paper-card hover:bg-paper-tint text-ink border border-paper-rule py-1.5 rounded-xs text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Navigation size={12} className="text-eucalypt" />
                    <span>Open in Apple Maps</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-4 border-t border-paper-rule flex items-center justify-between text-xs text-ink-muted">
          <span>{trips.length} campsite{trips.length === 1 ? "" : "s"} cached locally</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xs bg-eucalypt hover:bg-eucalypt/90 text-paper font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
