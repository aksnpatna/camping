"use client";

import React, { useState } from "react";
import { X, Trash2, MapPin, Navigation, Download, WifiOff } from "lucide-react";
import type { TripCardData } from "./FindWeekendPlanner";

interface OfflineBushVaultModalProps {
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

export default function OfflineBushVaultModal({ onClose }: OfflineBushVaultModalProps) {
  const [trips, setTrips] = useState<TripCardData[]>(() => {
    if (typeof window === "undefined") return [];
    return getOfflineTrips();
  });

  const handleDelete = (id: number) => {
    removeTripOffline(id);
    setTrips(getOfflineTrips());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-[#FFFFFF] border border-[#E2DAC8] rounded-2xl shadow-2xl p-6 text-[#1E2A24] overflow-hidden max-h-[90vh] flex flex-col">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#536259] hover:text-[#1E2A24] rounded-full bg-[#FAF6EF] hover:bg-[#F6F1E7] transition-colors cursor-pointer"
          aria-label="Close Offline Vault"
        >
          <X size={18} />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#FFF9EE] border border-[#F0D5A8] flex items-center justify-center text-[#8A5818] font-bold text-lg shadow-xs">
            <WifiOff size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-[#1E2A24] flex items-center gap-2">
              Bush Mode Offline Vault
              <span className="text-[11px] bg-[#FFF9EE] text-[#8A5818] px-2.5 py-0.5 rounded-full border border-[#F0D5A8] font-bold uppercase">
                Zero Reception Ready
              </span>
            </h3>
            <p className="text-xs text-[#536259]">
              Cached trip cards, GPS coordinates, and safety rules available 100% offline.
            </p>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {trips.length === 0 ? (
            <div className="py-12 text-center text-[#536259] flex flex-col items-center gap-3">
              <Download size={32} className="text-[#536259]/60" />
              <p className="text-sm font-semibold text-[#1E2A24]">No campsites saved offline yet.</p>
              <p className="text-xs max-w-sm text-[#536259]">
                Tap <span className="text-[#2F5D50] font-bold">📥 Save Offline</span> on any recommended trip card before you leave mobile reception.
              </p>
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-4 flex flex-col gap-3 hover:border-[#2F5D50]/40 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-[#1E2A24]">{trip.name}</h4>
                      <span className="text-[10px] bg-[#EBF2EE] text-[#2F5D50] border border-[#2F5D50]/20 px-2 py-0.5 rounded font-bold uppercase">
                        {trip.highlight_badge || "Cached Pick"}
                      </span>
                    </div>
                    <p className="text-xs text-[#536259] flex items-center gap-1 mt-0.5 font-medium">
                      <MapPin size={12} className="text-[#2F5D50]" />
                      {trip.state} • {trip.management_type || "Public Reserve"} • {trip.driving_distance_km}km
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(trip.id)}
                    className="p-1.5 text-[#536259] hover:text-[#A83232] rounded-lg hover:bg-[#F6F1E7] transition-colors cursor-pointer"
                    title="Remove from Offline Vault"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* GRAPHICAL CHIPS */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="bg-[#FFFFFF] border border-[#E2DAC8] px-2 py-0.5 rounded text-[#1E2A24]">
                    🚗 {trip.vehicle_clearance === "4WD_ONLY" ? "4WD Only" : "2WD Friendly"}
                  </span>
                  <span className="bg-[#FFFFFF] border border-[#E2DAC8] px-2 py-0.5 rounded text-[#1E2A24]">
                    🐶 {trip.dog_friendly ? "Dogs Allowed" : "No Pets"}
                  </span>
                  <span className="bg-[#FFFFFF] border border-[#E2DAC8] px-2 py-0.5 rounded text-[#1E2A24]">
                    💰 {trip.estimated_cost}
                  </span>
                  <span className="bg-[#FFFFFF] border border-[#E2DAC8] px-2 py-0.5 rounded text-[#1E2A24]">
                    ⏱️ {Math.floor(trip.driving_time_minutes / 60)}h {trip.driving_time_minutes % 60}m
                  </span>
                </div>

                {/* COMPROMISE */}
                <div className="bg-[#FFF9EE] border border-[#F0D5A8] px-3 py-2 rounded-lg text-xs text-[#8A5818]">
                  <span className="font-bold text-[#8A5818] text-[10px] uppercase block mb-0.5">Key Ground Fact:</span>
                  {trip.main_compromise}
                </div>

                {/* GPS ACTIONS */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#E2DAC8]">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${trip.latitude},${trip.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-[#FFFFFF] hover:bg-[#F6F1E7] text-[#1E2A24] border border-[#E2DAC8] py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Navigation size={13} className="text-[#1F6FB2]" /> Open in Google Maps
                  </a>
                  <a
                    href={`https://maps.apple.com/?daddr=${trip.latitude},${trip.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-[#FFFFFF] hover:bg-[#F6F1E7] text-[#1E2A24] border border-[#E2DAC8] py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Navigation size={13} className="text-[#2F5D50]" /> Open in Apple Maps
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-4 border-t border-[#E2DAC8] flex items-center justify-between text-xs text-[#536259]">
          <span>{trips.length} campsite{trips.length === 1 ? "" : "s"} saved locally</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2F5D50] hover:bg-[#254A40] text-white font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
}
