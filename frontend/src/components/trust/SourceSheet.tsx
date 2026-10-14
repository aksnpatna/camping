import React from "react";
import { Fact } from "@/types/facts";
import TrustRing from "./TrustRing";
import { X, ExternalLink, Calendar, BookOpen, Compass } from "lucide-react";

interface SourceSheetProps {
  fact: Fact;
  label: string;
  campsiteName: string;
  onClose: () => void;
  onOpenCheckIn?: () => void;
}

export default function SourceSheet({
  fact,
  label,
  campsiteName,
  onClose,
  onOpenCheckIn
}: SourceSheetProps) {
  const getBasisDescription = () => {
    switch (fact.basis) {
      case "official":
        return {
          title: "Official Government / Park Authority Dataset",
          desc: "This data point comes directly from the official state land manager (e.g. NPWS, Parks Victoria, QPWS) or local council records."
        };
      case "verified":
        return {
          title: "Field Verified Ground Truth",
          desc: "Confirmed on-site or cross-verified directly with ranger staff and physical campground signage."
        };
      case "rule":
        return {
          title: "Statutory Policy Rule",
          desc: "Derived from legislated regulations that apply uniformly to this land management category (e.g. Australian National Parks Act pet restrictions)."
        };
      case "community":
        return {
          title: "Recent Camper Ground Check-in",
          desc: "Observed and submitted by a fellow camper within the last 14 days. Community observations decay after 14 days to prevent stale field notes."
        };
      case "model":
        return {
          title: "Scientific Climatological / Forecast Model",
          desc: "Generated via numerical weather models (e.g. Open-Meteo, BOM) downscaled with microclimatic elevation and valley physics."
        };
      case "estimate":
        return {
          title: "Geodesic / Network Estimate",
          desc: "Calculated routing or distance estimate based on coordinates and Australian road network topology."
        };
      case "unknown":
      default:
        return {
          title: "Unverified / Unknown Information",
          desc: "This campground has no confirmed data for this attribute. Camp Smart Australia refuses to guess or fabricate an answer."
        };
    }
  };

  const basisInfo = getBasisDescription();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-[#FFFFFF] border border-[#E2DAC8] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[#1E2A24]"
        role="dialog"
        aria-labelledby="source-sheet-title"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-[#E2DAC8] pb-3">
          <div className="flex items-center gap-2.5">
            <TrustRing basis={fact.basis} confidence={fact.confidence} size="md" />
            <div>
              <h3 id="source-sheet-title" className="text-base font-bold text-[#1E2A24] flex items-center gap-1.5">
                {label} Lens
              </h3>
              <p className="text-xs text-[#536259] truncate max-w-[260px]">
                {campsiteName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#8B9891] hover:text-[#1E2A24] hover:bg-[#FAF6EF] transition-colors"
            aria-label="Close fact inspection sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* STATUS CARD */}
        <div className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#536259] font-medium">Recorded Value</span>
            <span className="font-bold text-[#1E2A24] text-sm">
              {fact.value !== null && fact.value !== undefined
                ? typeof fact.value === "boolean"
                  ? fact.value ? "Yes / Permitted" : "No / Prohibited"
                  : String(fact.value)
                : "Not Available (Unconfirmed)"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E2DAC8]">
            <span className="text-[#536259] font-medium">Confidence Rating</span>
            <span className="font-mono text-xs text-[#2F5D50] font-bold">
              {"★".repeat(fact.confidence)}{"☆".repeat(3 - fact.confidence)} ({fact.confidence}/3)
            </span>
          </div>
        </div>

        {/* BASIS EXPLANATION */}
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-[#2F5D50] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
            <BookOpen size={12} /> {basisInfo.title}
          </div>
          <p className="text-[#536259] text-xs leading-relaxed">
            {basisInfo.desc}
          </p>
        </div>

        {/* PROVENANCE METADATA */}
        {(fact.source || fact.note || fact.as_of || fact.url) && (
          <div className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-3 space-y-2 text-xs">
            {fact.note && (
              <div>
                <span className="text-[#8B9891] text-[10px] uppercase font-bold block mb-0.5">Field / Policy Note</span>
                <p className="text-[#1E2A24] font-medium">{fact.note}</p>
              </div>
            )}

            {fact.source && (
              <div className="flex items-center justify-between pt-1 border-t border-[#E2DAC8] text-[11px]">
                <span className="text-[#536259]">Authority / Source:</span>
                <span className="text-[#1E2A24] font-medium truncate max-w-[220px]">{fact.source}</span>
              </div>
            )}

            {fact.as_of && (
              <div className="flex items-center justify-between pt-1 border-t border-[#E2DAC8] text-[11px]">
                <span className="text-[#536259] flex items-center gap-1">
                  <Calendar size={11} /> Source Date:
                </span>
                <span className="text-[#1E2A24] font-mono">{fact.as_of}</span>
              </div>
            )}

            {fact.url && (
              <div className="pt-2">
                <a
                  href={fact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#1F6FB2] hover:underline font-medium"
                >
                  <ExternalLink size={12} /> View Official Source Document
                </a>
              </div>
            )}
          </div>
        )}

        {/* COMMUNITY CORRECTION ACTION */}
        <div className="pt-1 flex flex-col gap-2">
          {onOpenCheckIn && (
            <button
              onClick={() => {
                onClose();
                onOpenCheckIn();
              }}
              className="w-full bg-[#EBF2EE] hover:bg-[#DFEBE5] text-[#2F5D50] border border-[#2F5D50]/30 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Compass size={13} className="text-[#C9822B]" /> Have ground truth? Report in 10s
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] text-[#536259] py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
