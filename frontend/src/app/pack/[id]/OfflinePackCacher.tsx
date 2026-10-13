"use client";

import { useEffect } from "react";

export default function OfflinePackCacher({ campsite, id }: { campsite: unknown; id: string }) {
  useEffect(() => {
    if (!campsite || typeof window === "undefined") return;
    try {
      localStorage.setItem(`campsmart_offline_pack_${id}`, JSON.stringify(campsite));
    } catch {
      // Ignore quota errors
    }
  }, [campsite, id]);

  return null;
}
