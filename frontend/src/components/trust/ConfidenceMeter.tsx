import React from "react";
import { ShieldCheck, HelpCircle } from "lucide-react";

interface ConfidenceMeterProps {
  knownCount: number;
  totalCount: number;
  officialCount?: number;
  onClickHelp?: () => void;
}

export default function ConfidenceMeter({
  knownCount,
  totalCount,
  officialCount = 0,
  onClickHelp
}: ConfidenceMeterProps) {
  const percentage = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;

  return (
    <div className="flex items-center justify-between text-xs py-1 px-2 bg-paper-sunk border border-paper-rule rounded-sm text-ink">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={13} className="text-trust-official shrink-0" />
        <span className="t-data text-xs text-ink-muted">
          Known <strong className="text-ink font-semibold">{knownCount}</strong> of {totalCount} facts
        </span>
        {officialCount > 0 && (
          <span className="t-data text-[10px] text-trust-official bg-trust-official/10 px-1 py-0.2 rounded-xs border border-trust-official/20">
            {officialCount} official
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-16 h-1 bg-paper-rule rounded-full overflow-hidden flex">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percentage >= 75
                ? "bg-eucalypt"
                : percentage >= 50
                ? "bg-ochre"
                : "bg-ink-faint"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {onClickHelp && (
          <button
            onClick={onClickHelp}
            className="text-ink-faint hover:text-ink transition-colors cursor-pointer"
            title="How Camp Smart verifies data"
            aria-label="Data trust explanation"
          >
            <HelpCircle size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
