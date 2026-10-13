"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getApiUrl } from "@/config";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("cs_session_id");
  if (!sid) {
    sid = "cs_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    sessionStorage.setItem("cs_session_id", sid);
  }
  return sid;
}

export async function trackClientEvent(
  eventType: string,
  path?: string,
  metaData?: Record<string, unknown>,
  userEmail?: string
) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      event_type: eventType,
      path: path || window.location.pathname,
      referrer: document.referrer || undefined,
      session_id: getOrCreateSessionId(),
      user_email: userEmail || undefined,
      meta_data: {
        ...metaData,
        screen_res: `${window.innerWidth}x${window.innerHeight}`
      }
    };

    const apiUrl = getApiUrl();
    const endpoint = `${apiUrl}/analytics/events`;

    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  } catch {
    // Non-blocking telemetry
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    if (fullPath === lastTrackedPath.current) return;
    lastTrackedPath.current = fullPath;

    trackClientEvent("page_view", fullPath);
  }, [pathname, searchParams]);

  return null;
}
