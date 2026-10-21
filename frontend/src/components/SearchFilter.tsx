"use client";

import { Dog, Truck, Search, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { getApiUrl } from "@/config";

export interface FilterParams {
  dog_friendly: boolean | null;
  rig_access: string | null;
  state?: string | null;
}

interface CampsiteCounts {
  total: number;
  by_state: Record<string, number>;
}

const STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales",
  QLD: "Queensland",
  VIC: "Victoria",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
  JBT: "Jervis Bay Territory"
};

export default function SearchFilter({ onFilterChange }: { onFilterChange: (filters: FilterParams) => void }) {
  const [dogFriendly, setDogFriendly] = useState<boolean | null>(null);
  const [rigAccess, setRigAccess] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [counts, setCounts] = useState<CampsiteCounts | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${getApiUrl()}/campsites/counts`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CampsiteCounts | null) => {
        if (active && data) {
          setCounts(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newState = val === "ALL" ? null : val;
    setSelectedState(newState);
    onFilterChange({ dog_friendly: dogFriendly, rig_access: rigAccess, state: newState });
  };

  const handleRigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newRig = val === "ANY" ? null : val;
    setRigAccess(newRig);
    onFilterChange({ dog_friendly: dogFriendly, rig_access: newRig, state: selectedState });
  };

  const handleDogToggle = () => {
    // Cycle: null -> true -> false -> null
    const newDog = dogFriendly === null ? true : dogFriendly === true ? false : null;
    setDogFriendly(newDog);
    onFilterChange({ dog_friendly: newDog, rig_access: rigAccess, state: selectedState });
  };

  const allLabel = counts?.total
    ? `All Australia (${counts.total.toLocaleString()} Sites)`
    : "All Australia";

  const getStateOptionLabel = (code: string) => {
    const name = STATE_NAMES[code] || code;
    const count = counts?.by_state[code];
    return count !== undefined ? `${name} (${count.toLocaleString()})` : name;
  };

  return (
    <div className="w-full bg-paper-card/95 backdrop-blur-md border border-paper-rule rounded-sm p-4 shadow-xl flex flex-col gap-4 text-ink font-sans">
      <div className="flex items-center gap-2 text-ink font-semibold">
        <Search className="w-4 h-4 text-eucalypt" />
        <h2 className="text-sm font-bold font-serif tracking-tight text-ink">Filter Campground Data</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-ink-muted font-semibold uppercase tracking-wider t-label">Region / State</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
          <select 
            value={selectedState || "ALL"}
            onChange={handleStateChange}
            className="w-full bg-paper-page text-ink text-xs font-semibold rounded-xs pl-9 pr-3 py-2.5 border border-paper-rule focus:outline-none focus:border-eucalypt appearance-none transition-colors t-data"
          >
            <option value="ALL">{allLabel}</option>
            {Object.keys(STATE_NAMES).map((code) => (
              <option key={code} value={code}>
                {getStateOptionLabel(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-ink-muted font-semibold uppercase tracking-wider t-label">Rig & Vehicle Clearance</label>
        <div className="relative">
          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
          <select 
            value={rigAccess || "ANY"}
            onChange={handleRigChange}
            className="w-full bg-paper-page text-ink text-xs font-semibold rounded-xs pl-9 pr-3 py-2.5 border border-paper-rule focus:outline-none focus:border-eucalypt appearance-none transition-colors t-data"
          >
            <option value="ANY">Any Rig / Setup</option>
            <option value="TENT">Tent (Car Camping)</option>
            <option value="4WD_ONLY">4WD Access Only</option>
            <option value="CAMPER_TRAILER">Camper Trailer</option>
            <option value="CARAVAN">Caravan</option>
            <option value="MOTORHOME">Motorhome</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-paper-rule">
        <label className="text-xs text-ink-muted font-semibold uppercase tracking-wider flex items-center gap-1.5 t-label">
          <Dog className="w-3.5 h-3.5 text-ink-subtle" />
          Pet Friendly
        </label>
        
        <button 
          onClick={handleDogToggle}
          className={`px-3 py-1 text-xs font-semibold rounded-xs border transition-all cursor-pointer t-label ${
            dogFriendly === true 
              ? "bg-paper-tint text-eucalypt border-eucalypt/40 shadow-xs" 
              : dogFriendly === false
                ? "bg-paper-tint text-clay border-clay/40" 
                : "bg-paper-page text-ink-muted border-paper-rule"
          }`}
        >
          {dogFriendly === null ? "Doesn't Matter" : dogFriendly ? "Yes (Required)" : "No Dogs"}
        </button>
      </div>
    </div>
  );
}
