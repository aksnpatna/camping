import React from "react";

export type BasisType = "official" | "rule" | "model" | "community" | "estimate" | "unknown" | string;

export interface BasisMarkProps {
  basis?: BasisType;
  confidence?: number;
  showLabel?: boolean;
  className?: string;
}

const BASIS_COLORS: Record<string, string> = {
  official: "bg-trust-official text-trust-official",
  rule: "bg-trust-rule text-trust-rule",
  model: "bg-trust-model text-trust-model",
  community: "bg-trust-community text-trust-community",
  estimate: "bg-trust-estimate text-trust-estimate",
  unknown: "bg-trust-unknown text-trust-unknown"
};

const BASIS_LABELS: Record<string, string> = {
  official: "official",
  rule: "rule",
  model: "model",
  community: "community",
  estimate: "estimate",
  unknown: "not verified"
};

export function BasisMark({
  basis = "unknown",
  showLabel = true,
  className = ""
}: BasisMarkProps) {


  const normBasis = (basis || "unknown").toLowerCase();
  const colorClass = BASIS_COLORS[normBasis] || BASIS_COLORS.unknown;
  const label = BASIS_LABELS[normBasis] || normBasis;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${className}`}>
      <span className={`w-0.5 h-3 inline-block rounded-full ${colorClass.split(" ")[0]}`} />
      {showLabel && (
        <span className="text-ink-faint lowercase">
          {label}
        </span>
      )}
    </span>
  );
}

export default BasisMark;
