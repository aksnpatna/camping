"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 text-center font-sans selection:bg-eucalypt selection:text-paper">
      <div className="max-w-md bg-paper-card border border-clay p-8 rounded-sm shadow-xs">
        <div className="w-10 h-10 rounded-xs bg-clay-tint text-clay border border-clay/30 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle size={20} />
        </div>
        <span className="t-micro text-clay font-bold mb-1 block">Telemetry Error</span>
        <h1 className="font-serif text-2xl font-semibold text-ink tracking-tight mb-2">
          Unable to render conditions
        </h1>
        <p className="text-xs text-ink-muted leading-relaxed mb-6">
          A temporary failure occurred while reading campsite feeds or rendering map projections. You can retry the operation or return to the main field guide.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-eucalypt text-paper px-4 py-2 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Try again</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 border border-paper-rule bg-paper text-ink px-4 py-2 rounded-sm text-xs font-medium hover:bg-paper-tint transition-colors"
          >
            <Home size={13} className="text-ink-muted" />
            <span>Return home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
