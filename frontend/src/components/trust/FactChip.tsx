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
      className={`rounded-xl p-2 text-left w-full group relative overflow-hidden transition-all cursor-pointer shadow-2xs ${
        isUnknown
          ? "bg-[#FAF6EF] border border-dashed border-[#CDC3AF] hover:border-[#8B9891]"
          : "bg-[#FFFFFF] border border-[#E2DAC8] hover:border-[#2F5D50]/50 hover:bg-[#FAF6EF]"
      }`}
      title={onInspect ? `Tap to inspect ${label} source and provenance` : undefined}
    >
      <div className="flex items-center justify-between text-[10px] text-[#536259] font-bold gap-1">
        <span className="flex items-center gap-1.5 truncate text-[#2F5D50]">
          {icon} <span className="text-[#536259]">{label}</span>
        </span>
        {fact && (
          <TrustRing basis={fact.basis} confidence={fact.confidence} size="sm" />
        )}
      </div>

      <div className={`text-[11px] mt-1 truncate ${isUnknown ? "text-[#8B9891] italic font-medium" : "text-[#1E2A24] font-bold"}`}>
        {displayValue}
      </div>
    </button>
  );
}
