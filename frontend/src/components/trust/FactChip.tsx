import React from "react";
import { Fact } from "@/types/facts";
import TrustRing from "./TrustRing";

interface FactChipProps {
  label: string;
  icon: React.ReactNode;
  displayValue: string;
  fact?: Fact | null;
  onInspect?: () => void;
}

export default function FactChip({
  label,
  icon,
  displayValue,
  fact,
  onInspect
}: FactChipProps) {
  const isUnknown = !fact || fact.basis === "unknown" || displayValue.toLowerCase().includes("unverified") || displayValue.toLowerCase().includes("unknown");

  return (
    <button
      type="button"
      onClick={onInspect}
      className={`bg-black/30 border rounded-lg p-1.5 text-center transition-all cursor-pointer text-left w-full group relative overflow-hidden ${
        isUnknown
          ? "border-gray-700/60 hover:border-gray-500"
          : "border-white/10 hover:border-emerald-500/40 hover:bg-black/40"
      }`}
      title={onInspect ? `Tap to inspect ${label} source and provenance` : undefined}
    >
      <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold gap-1">
        <span className="flex items-center gap-1 truncate">
          {icon} {label}
        </span>
        {fact && (
          <TrustRing basis={fact.basis} confidence={fact.confidence} size="sm" />
        )}
      </div>

      <div className={`text-[11px] font-bold mt-1 truncate ${isUnknown ? "text-gray-400 italic" : "text-white"}`}>
        {displayValue}
      </div>
    </button>
  );
}
