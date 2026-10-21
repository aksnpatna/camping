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
      className={`rounded-sm p-2 text-left w-full group relative overflow-hidden transition-all cursor-pointer shadow-2xs ${
        isUnknown
          ? "bg-paper-tint border border-dashed border-paper-rule hover:border-ink-subtle"
          : "bg-paper-card border border-paper-rule hover:border-eucalypt/50 hover:bg-paper-tint"
      }`}
      title={onInspect ? `Tap to inspect ${label} source and provenance` : undefined}
    >
      <div className="flex items-center justify-between text-xs text-ink-muted font-semibold gap-1 t-label">
        <span className="flex items-center gap-1.5 truncate text-eucalypt">
          {icon} <span className="text-ink-muted">{label}</span>
        </span>
        {fact && (
          <TrustRing basis={fact.basis} confidence={fact.confidence} size="sm" />
        )}
      </div>

      <div className={`text-xs mt-1 truncate ${isUnknown ? "text-ink-subtle italic font-normal" : "text-ink font-semibold t-data"}`}>
        {displayValue}
      </div>
    </button>
  );
}
