import React from "react";
import { Fact } from "@/types/facts";
import BasisMark from "@/components/ui/BasisMark";
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
          title: "Recent Camper Ground Report",
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/40 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-paper-card border border-paper-rule rounded-t-lg sm:rounded-md p-5 shadow-overlay flex flex-col gap-4 text-ink"
        role="dialog"
        aria-labelledby="source-sheet-title"
      >
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-paper-rule pb-3">
          <div className="flex items-center gap-2.5">
            <BasisMark basis={fact.basis} confidence={fact.confidence} showLabel={false} />
            <div>
              <h3 id="source-sheet-title" className="t-title text-base font-semibold text-ink">
                {label}
              </h3>
              <p className="t-lede text-xs text-ink-muted truncate max-w-[260px]">
                {campsiteName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xs text-ink-faint hover:text-ink hover:bg-paper-sunk transition-colors cursor-pointer"
            aria-label="Close fact inspection sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* STATUS CARD */}
        <div className="bg-paper-sunk border border-paper-rule rounded-sm p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="t-label text-ink-muted">Recorded Value</span>
            <span className="t-body font-semibold text-ink text-sm">
              {fact.value !== null && fact.value !== undefined
                ? typeof fact.value === "boolean"
                  ? fact.value ? "Yes / Permitted" : "No / Prohibited"
                  : String(fact.value)
                : "Not verified yet"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-paper-rule">
            <span className="t-label text-ink-muted">Basis</span>
            <span className="t-data text-xs text-ink font-medium capitalize">
              {fact.basis} ({fact.confidence}/3 confidence)
            </span>
          </div>
        </div>

        {/* BASIS EXPLANATION */}
        <div className="space-y-1 text-xs">
          <div className="t-micro text-eucalypt flex items-center gap-1.5 font-semibold">
            <BookOpen size={12} /> {basisInfo.title}
          </div>
          <p className="t-body text-xs text-ink-muted leading-relaxed">
            {basisInfo.desc}
          </p>
        </div>

        {/* PROVENANCE METADATA */}
        {(fact.source || fact.note || fact.as_of || fact.url) && (
          <div className="bg-paper-sunk border border-paper-rule rounded-sm p-3 space-y-2 text-xs">
            {fact.note && (
              <div>
                <span className="t-micro text-ink-faint block mb-0.5">Field / Policy Note</span>
                <p className="t-body text-xs text-ink font-medium">{fact.note}</p>
              </div>
            )}

            {fact.source && (
              <div className="flex items-center justify-between pt-1 border-t border-paper-rule text-[11px]">
                <span className="text-ink-muted">Authority / Source:</span>
                <span className="text-ink font-medium truncate max-w-[220px]">{fact.source}</span>
              </div>
            )}

            {fact.as_of && (
              <div className="flex items-center justify-between pt-1 border-t border-paper-rule text-[11px]">
                <span className="text-ink-muted flex items-center gap-1">
                  <Calendar size={11} /> Source Date:
                </span>
                <span className="t-data text-ink">{fact.as_of}</span>
              </div>
            )}

            {fact.url && (
              <div className="pt-1.5 border-t border-paper-rule">
                <a
                  href={fact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-trust-official hover:underline font-medium"
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
              className="w-full bg-eucalypt-tint hover:bg-eucalypt-tint/80 text-eucalypt border border-eucalypt/30 py-2.5 rounded-sm font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass size={13} className="text-ochre" /> Have ground truth? Report conditions
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full bg-paper hover:bg-paper-sunk border border-paper-rule text-ink-muted py-2 rounded-sm text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
