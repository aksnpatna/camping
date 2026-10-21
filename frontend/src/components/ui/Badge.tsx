import React from "react";

export interface BadgeProps {
  tone?: "ok" | "warn" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  size = "sm",
  className = "",
  children
}: BadgeProps) {
  const tones = {
    ok: "bg-safety-ok/10 text-safety-ok border-safety-ok/25",
    warn: "bg-ochre-tint text-ochre border-ochre/30",
    danger: "bg-safety-danger/10 text-safety-danger border-safety-danger/30",
    info: "bg-trust-official/10 text-trust-official border-trust-official/30",
    neutral: "bg-paper-sunk text-ink-muted border-paper-rule"
  };

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 font-medium rounded-xs tracking-wide",
    md: "text-xs px-2 py-0.5 font-medium rounded-xs tracking-wide"
  };

  return (
    <span className={`inline-flex items-center gap-1 border uppercase ${tones[tone]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
