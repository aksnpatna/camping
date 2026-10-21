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
    { label: "Watch for", key: "catch", render: (c: TripCardData) => c.main_compromise }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-5xl bg-paper-card border border-paper-rule rounded-sm p-6 shadow-2xl flex flex-col max-h-[90vh] text-ink">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-paper-rule pb-4 mb-4">
          <div>
            <h3 className="text-xl font-bold font-serif text-ink flex items-center gap-2">
              Side-by-Side Trip Comparison
              <span className="text-xs bg-paper-tint text-eucalypt px-2.5 py-0.5 rounded-xs font-semibold border border-eucalypt/30 t-label">
                {cards.length} Campsites Selected
              </span>
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Direct condition and facility comparison with transparent trust ratings.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xs text-ink-subtle hover:text-ink hover:bg-paper-sunk transition-colors cursor-pointer"
            aria-label="Close comparison modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* COMPARISON TABLE */}
        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-paper-rule">
                <th className="p-3 text-xs font-semibold text-ink-muted uppercase tracking-wider w-40 sticky left-0 bg-paper-card z-10 t-label">
                  Attribute
                </th>
                {cards.map((c) => (
                  <th key={c.id} className="p-3 min-w-[220px] max-w-[280px]">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-eucalypt font-bold uppercase t-label">
                        {c.highlight_badge}
                      </span>
                      <h4 className="text-base font-bold font-serif text-ink leading-tight">{c.name}</h4>
                      <span className="text-xs text-ink-muted flex items-center gap-1 t-data">
                        <MapPin size={11} className="text-ink-subtle" /> {c.state} • {c.management_type || "Authority not recorded"}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-rule text-xs">
              {attributes.map((attr, idx) => (
                <tr key={idx} className="hover:bg-paper-tint">
                  <td className="p-3 font-semibold text-ink-muted sticky left-0 bg-paper-card z-10 t-label">
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
                          <span className={isUnknown ? "text-ink-subtle italic" : "text-ink font-medium"}>
                            {valStr}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-3 sticky left-0 bg-paper-card z-10"></td>
                {cards.map((c) => (
                  <td key={c.id} className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenSaveModal(c.id, c.name);
                        }}
                        className="flex-1 bg-eucalypt hover:bg-eucalypt/90 text-paper-card py-2 rounded-xs font-semibold text-xs transition-all cursor-pointer shadow-xs t-label"
                      >
                        Select & Save
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onSelectSite(c.id);
                        }}
                        className="bg-paper-tint hover:bg-paper-sunk text-ink border border-paper-rule px-3 py-2 rounded-xs font-semibold text-xs transition-all cursor-pointer shadow-xs"
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
