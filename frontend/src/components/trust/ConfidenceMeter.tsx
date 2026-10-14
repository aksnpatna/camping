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
    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl text-[#1E2A24] shadow-xs">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-[#1F6FB2]" />
        <span className="font-medium text-[#536259] text-[11px]">
          Known <strong className="text-[#1E2A24] font-bold">{knownCount}</strong> of {totalCount} facts
        </span>
        {officialCount > 0 && (
          <span className="text-[10px] text-[#1F6FB2] bg-[#1F6FB2]/10 px-1.5 py-0.2 rounded font-bold border border-[#1F6FB2]/20">
            {officialCount} official
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-[#E2DAC8] rounded-full overflow-hidden flex">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentage >= 75
                ? "bg-[#2F5D50]"
                : percentage >= 50
                ? "bg-[#C9822B]"
                : "bg-[#8A8F8C]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {onClickHelp && (
          <button
            onClick={onClickHelp}
            className="text-[#8B9891] hover:text-[#1E2A24] transition-colors cursor-pointer"
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
