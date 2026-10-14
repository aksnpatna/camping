import React from "react";
import { ShieldCheck, HelpCircle } from "lucide-react";

interface ConfidenceMeterProps {
  knownCount?: number;
  totalCount?: number;
  officialCount?: number;
  onClickHelp?: () => void;
}

export default function ConfidenceMeter({
  knownCount = 6,
  totalCount = 9,
  officialCount = 3,
  onClickHelp
}: ConfidenceMeterProps) {
  const percentage = Math.round((knownCount / totalCount) * 100);

  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-black/40 border border-white/10 rounded-xl">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#60a5fa]" />
        <span className="font-semibold text-gray-200 text-[11px]">
          Known <strong className="text-white">{knownCount}</strong> of {totalCount} facts
        </span>
        {officialCount > 0 && (
          <span className="text-[10px] text-[#60a5fa] bg-[#1F6FB2]/20 px-1.5 py-0.2 rounded font-medium border border-[#1F6FB2]/30">
            {officialCount} official
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-gray-700/60 rounded-full overflow-hidden flex">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentage >= 75
                ? "bg-emerald-400"
                : percentage >= 50
                ? "bg-amber-400"
                : "bg-gray-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {onClickHelp && (
          <button
            onClick={onClickHelp}
            className="text-gray-400 hover:text-white transition-colors"
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
