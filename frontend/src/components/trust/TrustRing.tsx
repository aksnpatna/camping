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
        className={`inline-flex items-center justify-center rounded-full bg-[#1F6FB2]/15 border border-[#1F6FB2] text-[#1F6FB2] ${ringSize}`}
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
        className={`inline-flex items-center justify-center rounded-full bg-[#B7791F]/15 border border-dashed border-[#B7791F] text-[#B7791F] ${ringSize}`}
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
        className={`inline-flex items-center justify-center rounded-full bg-[#2F5D50]/15 border border-dotted border-[#2F5D50] text-[#2F5D50] ${ringSize}`}
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
        className={`inline-flex items-center justify-center rounded-full bg-[#0284C7]/15 border border-[#0284C7] text-[#0284C7] ${ringSize}`}
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
        className={`inline-flex items-center justify-center rounded-full bg-[#C9822B]/15 border border-dashed border-[#C9822B] text-[#C9822B] ${ringSize}`}
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
      className={`inline-flex items-center justify-center rounded-full bg-[#FAF6EF] border border-dashed border-[#8A8F8C] text-[#8A8F8C] ${ringSize}`}
      title="Unverified / Missing Information"
      aria-label="Fact unverified"
    >
      {showIcon && <HelpCircle size={iconSize} strokeWidth={2} />}
    </span>
  );
}
