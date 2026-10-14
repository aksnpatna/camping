import React from "react";
import { BasisType } from "@/types/facts";
import { Check, Users, Sparkles, Navigation, HelpCircle, BookOpen } from "lucide-react";

interface TrustRingProps {
  basis: BasisType;
  confidence: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export default function TrustRing({ basis, confidence, size = "sm", showIcon = true }: TrustRingProps) {
  const iconSize = size === "sm" ? 10 : size === "md" ? 12 : 14;
  const ringSize = size === "sm" ? "w-4 h-4" : size === "md" ? "w-5 h-5" : "w-6 h-6";

  if (basis === "official" || basis === "verified") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[#1F6FB2]/20 border border-[#1F6FB2] text-[#60a5fa] ${ringSize}`}
        title={`Official / Verified Source (Confidence ${confidence}/3)`}
        aria-label="Official verified fact"
      >
        {showIcon && <Check size={iconSize} strokeWidth={3} />}
      </span>
    );
  }

  if (basis === "rule") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-[#B7791F]/20 border border-dashed border-[#B7791F] text-[#fbbf24] ${ringSize}`}
        title={`Statutory Regulation / Policy Rule (Confidence ${confidence}/3)`}
        aria-label="Statutory rule"
      >
        {showIcon && <BookOpen size={iconSize} strokeWidth={2.5} />}
      </span>
    );
  }

  if (basis === "community") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-teal-500/20 border border-dotted border-teal-400 text-teal-300 ${ringSize}`}
        title={`Camper Ground Report < 14d (Confidence ${confidence}/3)`}
        aria-label="Recent camper ground report"
      >
        {showIcon && <Users size={iconSize} strokeWidth={2.5} />}
      </span>
    );
  }

  if (basis === "model") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-sky-500/20 border border-sky-400 text-sky-300 ${ringSize}`}
        title={`Forecast / Climatological Model (Confidence ${confidence}/3)`}
        aria-label="Climatological model"
      >
        {showIcon && <Sparkles size={iconSize} strokeWidth={2.5} />}
      </span>
    );
  }

  if (basis === "estimate") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-amber-500/20 border border-dashed border-amber-400 text-amber-300 ${ringSize}`}
        title={`Estimated Calculation (Confidence ${confidence}/3)`}
        aria-label="Estimated calculation"
      >
        {showIcon && <Navigation size={iconSize} strokeWidth={2} />}
      </span>
    );
  }

  // basis === "unknown"
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gray-700/40 border border-dashed border-[#8A8F8C] text-[#9ca3af] ${ringSize}`}
      title="Unverified / Missing Information"
      aria-label="Fact unverified"
    >
      {showIcon && <HelpCircle size={iconSize} strokeWidth={2} />}
    </span>
  );
}
