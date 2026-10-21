import React from "react";

export interface SectionProps {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  badge,
  children,
  className = ""
}: SectionProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between pb-1 border-b border-paper-rule">
        <span className="t-micro text-ink-faint tracking-wider">{title}</span>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default Section;
