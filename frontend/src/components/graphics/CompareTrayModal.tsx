import React from "react";
import { TripCardData } from "../FindWeekendPlanner";
import TrustRing from "../trust/TrustRing";
import { X, MapPin } from "lucide-react";
import { Fact } from "@/types/facts";

interface CompareTrayModalProps {
  cards: TripCardData[];
  onClose: () => void;
  onSelectSite: (id: number) => void;
  onOpenSaveModal: (id: number, name: string) => void;
}

export default function CompareTrayModal({
  cards,
  onClose,
  onSelectSite,
  onOpenSaveModal
}: CompareTrayModalProps) {
  const attributes = [
    { label: "Drive Time", key: "driving_time", render: (c: TripCardData) => `${Math.floor(c.driving_time_minutes / 60)}h ${c.driving_time_minutes % 60}m (${c.driving_distance_km}km)` },
    { label: "Vehicle Clearance", key: "access", factKey: "vehicle_access", render: (c: TripCardData) => c.visual_badges?.clearance || (c.vehicle_clearance === "4WD_ONLY" ? "4WD Only" : "2WD Easy") },
    { label: "Telco Coverage", key: "telco", factKey: "telco", render: (c: TripCardData) => c.visual_badges?.telco || "Unspecified" },
    { label: "Campfires", key: "campfire", factKey: "campfires", render: (c: TripCardData) => c.visual_badges?.campfire || "Check Rules" },
    { label: "Drinking Water", key: "water", factKey: "water", render: (c: TripCardData) => c.visual_badges?.water || "Unverified" },
    { label: "Toilets", key: "toilets", factKey: "toilets", render: (c: TripCardData) => c.visual_badges?.toilets || "Unverified" },
    { label: "Pet Policy", key: "pets", factKey: "dog_friendly", render: (c: TripCardData) => c.dog_friendly === true ? "Dogs Allowed" : c.dog_friendly === false ? "No Pets" : "Check Regulations" },
    { label: "Camping Fee", key: "fees", factKey: "fees", render: (c: TripCardData) => c.estimated_cost },
    { label: "Fire District", key: "fire", factKey: "fire_status", render: (c: TripCardData) => c.fire_district || "Unmapped" },
    { label: "Booking Type", key: "booking", render: (c: TripCardData) => c.booking_type === "FIRST_COME_FIRST_SERVED" ? "No Booking Req" : "Booking Required" },
    { label: "The Compromise", key: "catch", render: (c: TripCardData) => c.main_compromise }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl bg-[#0b2019] border border-emerald-500/30 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              Side-by-Side Trip Comparison
              <span className="text-xs bg-emerald-500/20 text-[var(--color-neon-green)] px-2.5 py-0.5 rounded-full font-bold">
                {cards.length} Campsites Selected
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Direct condition and facility comparison with transparent trust ratings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* COMPARISON TABLE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-40 sticky left-0 bg-[#0b2019] z-10">
                  Attribute
                </th>
                {cards.map((c) => (
                  <th key={c.id} className="p-3 min-w-[220px] max-w-[280px]">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] text-[var(--color-neon-green)] font-black uppercase">
                        {c.highlight_badge}
                      </span>
                      <h4 className="text-base font-bold text-white leading-tight">{c.name}</h4>
                      <span className="text-xs text-emerald-300 flex items-center gap-1">
                        <MapPin size={11} /> {c.state} • {c.management_type || "Public Reserve"}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {attributes.map((attr, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="p-3 font-semibold text-gray-300 sticky left-0 bg-[#0b2019] z-10">
                    {attr.label}
                  </td>
                  {cards.map((c) => {
                    const fact = attr.factKey && c.facts ? (c.facts as unknown as Record<string, Fact>)[attr.factKey] : null;
                    const valStr = attr.render(c);
                    const isUnknown = valStr.toLowerCase().includes("unverified") || valStr.toLowerCase().includes("unspecified") || valStr.toLowerCase().includes("unmapped");

                    return (
                      <td key={c.id} className="p-3">
                        <div className="flex items-center gap-2">
                          {fact && (
                            <TrustRing basis={fact.basis} confidence={fact.confidence} size="sm" />
                          )}
                          <span className={isUnknown ? "text-gray-400 italic" : "text-white font-medium"}>
                            {valStr}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-3 sticky left-0 bg-[#0b2019] z-10"></td>
                {cards.map((c) => (
                  <td key={c.id} className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenSaveModal(c.id, c.name);
                        }}
                        className="flex-1 bg-[var(--color-neon-green)] text-[var(--color-forest-900)] py-2 rounded-xl font-black text-xs hover:bg-[#00e67a] transition-all cursor-pointer shadow"
                      >
                        Select & Save
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectSite(c.id);
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer"
                        title="View on map"
                      >
                        <MapPin size={13} />
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
