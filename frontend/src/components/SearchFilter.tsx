"use client";

import { Dog, Truck, Tent, Search } from "lucide-react";
import { useState } from "react";

export interface FilterParams {
  dog_friendly: boolean | null;
  rig_access: string | null;
}

export default function SearchFilter({ onFilterChange }: { onFilterChange: (filters: FilterParams) => void }) {
  const [dogFriendly, setDogFriendly] = useState<boolean | null>(null);
  const [rigAccess, setRigAccess] = useState<string | null>(null);

  const handleRigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const newRig = val === "ANY" ? null : val;
    setRigAccess(newRig);
    onFilterChange({ dog_friendly: dogFriendly, rig_access: newRig });
  };

  const handleDogToggle = () => {
    // Cycle: null -> true -> false -> null
    const newDog = dogFriendly === null ? true : dogFriendly === true ? false : null;
    setDogFriendly(newDog);
    onFilterChange({ dog_friendly: newDog, rig_access: rigAccess });
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-4">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Search className="w-5 h-5 text-neon-green" />
        <h2>Find Your Trip</h2>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rig Type</label>
        <div className="relative">
          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={rigAccess || "ANY"}
            onChange={handleRigChange}
            className="w-full bg-slate-800/80 text-white text-sm rounded-lg pl-9 pr-3 py-2 border border-white/10 focus:outline-none focus:border-neon-green/50 appearance-none transition-colors"
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

      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
          <Dog className="w-4 h-4" />
          Dog Friendly
        </label>
        
        <button 
          onClick={handleDogToggle}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            dogFriendly === true 
              ? "bg-neon-green/20 text-neon-green border-neon-green/50" 
              : dogFriendly === false
                ? "bg-sunset-orange/20 text-sunset-orange border-sunset-orange/50"
                : "bg-slate-800 text-slate-300 border-white/10"
          }`}
        >
          {dogFriendly === null ? "Doesn't Matter" : dogFriendly ? "Yes (Required)" : "No Dogs"}
        </button>
      </div>
    </div>
  );
}
