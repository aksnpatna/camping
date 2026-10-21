import React from "react";

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  className = "",
  children
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="t-micro text-ink-muted">
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <span className="text-[11px] text-ink-faint">{hint}</span>
      )}
      {error && (
        <span className="text-[11px] text-safety-danger font-medium">{error}</span>
      )}
    </div>
  );
}

export default Field;
