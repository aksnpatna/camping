"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  size = "md",
  children,
  className = ""
}: SheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl"
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidths[size]} bg-paper-card border border-paper-rule rounded-md shadow-overlay overflow-hidden flex flex-col max-h-[90vh] ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-paper-rule bg-paper">
            <h3 className="t-title text-base font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-ink-muted hover:text-ink hover:bg-paper-sunk rounded-xs transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-4 custom-scrollbar text-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Sheet;
