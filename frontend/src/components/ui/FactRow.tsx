import React from "react";
import BasisMark from "./BasisMark";

export interface FactData {
  value?: unknown;
  basis?: string;
  source?: string | null;
  url?: string | null;
  as_of?: string | null;
  confidence?: number;
  note?: string | null;
}

export interface FactRowProps {
  label: string;
  value?: React.ReactNode;
  fact?: FactData | null;
  onInspect?: () => void;
  className?: string;
}

export function FactRow({
  label,
  value,
  fact,
  onInspect,
  className = ""
}: FactRowProps) {
  const isUnknown = !fact || fact.basis === "unknown" || value === null || value === undefined || value === "";
  const basis = fact?.basis || "unknown";

  const renderValue = () => {
    if (isUnknown) {
      return (
        <span className="t-data text-ink-faint">
          — <span className="italic font-sans text-xs ml-1">not verified</span>
        </span>
      );
    }
    return <span className="t-data text-ink font-medium">{value}</span>;
  };

  const Component = onInspect ? "button" : "div";

  return (
    <Component
      onClick={onInspect}
      className={`w-full flex items-center justify-between py-1.5 px-2 border-b border-paper-rule/60 text-left transition-colors ${
        onInspect ? "hover:bg-paper-sunk/60 cursor-pointer group" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="t-label text-ink-muted text-xs shrink-0">{label}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {renderValue()}
        {fact && fact.basis !== "unknown" && (
          <BasisMark basis={basis} confidence={fact.confidence} />
        )}
      </div>
    </Component>
  );
}

export default FactRow;
