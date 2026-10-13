"use client";

import { useSyncExternalStore, useEffect } from "react";

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
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-amber-950/95 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base animate-pulse">📡</span>
          <div>
            <div className="font-bold text-amber-100">Bush Offline Mode Active</div>
            <div className="text-[11px] text-amber-300/80">Using cached maps, checklists & saved trip details.</div>
          </div>
        </div>
        <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
          OFFLINE
        </span>
      </div>
    );
  }

  if (backOnlineNotice) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs"
      >
        <span className="text-emerald-400 font-bold">✓</span>
        <div>
          <span className="font-bold text-emerald-100">Back Online</span>
          <span className="text-emerald-300/80 ml-1.5">— Syncing live condition monitors.</span>
        </div>
      </div>
    );
  }

  return null;
}
