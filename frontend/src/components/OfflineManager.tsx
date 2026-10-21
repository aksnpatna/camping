"use client";

import { useSyncExternalStore, useEffect } from "react";
import { Radio, Check } from "lucide-react";

let isOfflineState = typeof navigator !== "undefined" ? !navigator.onLine : false;
let showOnlineToast = false;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    isOfflineState = true;
    showOnlineToast = false;
    notify();
  });

  window.addEventListener("online", () => {
    if (isOfflineState) {
      showOnlineToast = true;
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        showOnlineToast = false;
        notify();
      }, 4000);
    }
    isOfflineState = false;
    notify();
  });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getOfflineSnapshot() {
  return isOfflineState;
}

function getToastSnapshot() {
  return showOnlineToast;
}

function getServerSnapshot() {
  return false;
}

export default function OfflineManager() {
  const isOffline = useSyncExternalStore(subscribe, getOfflineSnapshot, getServerSnapshot);
  const backOnlineNotice = useSyncExternalStore(subscribe, getToastSnapshot, getServerSnapshot);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          console.warn("[ServiceWorker] Registration failed:", err);
        });
    }
  }, []);

  if (isOffline) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-paper-card border border-ochre text-ink px-4 py-3 rounded-sm shadow-xl backdrop-blur-md flex items-center justify-between gap-3 text-xs font-sans"
      >
        <div className="flex items-center gap-2.5">
          <Radio size={16} className="text-ochre shrink-0" />
          <div>
            <div className="font-semibold text-ink">Offline</div>
            <div className="text-[11px] text-ink-muted">Using cached maps, checklists & saved trip details.</div>
          </div>
        </div>
        <span className="bg-ochre-tint text-ochre text-[10px] font-semibold px-2 py-0.5 rounded-xs border border-ochre/30 whitespace-nowrap uppercase tracking-wider">
          Offline
        </span>
      </div>
    );
  }

  if (backOnlineNotice) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-paper-card border border-eucalypt text-ink px-4 py-2.5 rounded-sm shadow-xl backdrop-blur-md flex items-center gap-2.5 text-xs font-sans"
      >
        <Check size={14} className="text-eucalypt shrink-0" />
        <div>
          <span className="font-semibold text-ink">Back online</span>
          <span className="text-ink-muted ml-1.5">— Syncing live condition monitors.</span>
        </div>
      </div>
    );
  }

  return null;
}
