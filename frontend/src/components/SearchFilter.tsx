"use client";

import { Dog, Truck, Search, MapPin } from "lucide-react";
import { useState } from "react";

export interface FilterParams {
  dog_friendly: boolean | null;
  rig_access: string | null;
  state?: string | null;
}

export default function SearchFilter({ onFilterChange }: { onFilterChange: (filters: FilterParams) => void }) {
  const [dogFriendly, setDogFriendly] = useState<boolean | null>(null);
  const [rigAccess, setRigAccess] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);

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

  return (
    <div className="w-full bg-[#FFFFFF]/95 backdrop-blur-md border border-[#E2DAC8] rounded-2xl p-4 shadow-xl flex flex-col gap-4 text-[#1E2A24]">
      <div className="flex items-center gap-2 text-[#1E2A24] font-bold">
        <Search className="w-4 h-4 text-[#2F5D50]" />
        <h2 className="text-sm font-black tracking-tight">Filter Campground Data</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#536259] font-bold uppercase tracking-wider">Region / State</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9891]" />
          <select 
            value={selectedState || "ALL"}
            onChange={handleStateChange}
            className="w-full bg-[#FAF6EF] text-[#1E2A24] text-xs font-semibold rounded-xl pl-9 pr-3 py-2.5 border border-[#E2DAC8] focus:outline-none focus:border-[#2F5D50] appearance-none transition-colors"
          >
            <option value="ALL">All Australia (2,964 Sites)</option>
            <option value="NSW">New South Wales (746)</option>
            <option value="QLD">Queensland (1,000)</option>
            <option value="VIC">Victoria (360)</option>
            <option value="SA">South Australia (361)</option>
            <option value="WA">Western Australia (200)</option>
            <option value="TAS">Tasmania (112)</option>
            <option value="NT">Northern Territory (96)</option>
            <option value="ACT">ACT (86)</option>
            <option value="JBT">Jervis Bay Territory (3)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-[#536259] font-bold uppercase tracking-wider">Rig & Vehicle Clearance</label>
        <div className="relative">
          <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9891]" />
          <select 
            value={rigAccess || "ANY"}
            onChange={handleRigChange}
            className="w-full bg-[#FAF6EF] text-[#1E2A24] text-xs font-semibold rounded-xl pl-9 pr-3 py-2.5 border border-[#E2DAC8] focus:outline-none focus:border-[#2F5D50] appearance-none transition-colors"
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

      <div className="flex items-center justify-between pt-1 border-t border-[#E2DAC8]/60">
        <label className="text-[11px] text-[#536259] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Dog className="w-3.5 h-3.5 text-[#8B9891]" />
          Pet Friendly
        </label>
        
        <button 
          onClick={handleDogToggle}
          className={`px-3 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
            dogFriendly === true 
              ? "bg-[#EBF2EE] text-[#2F5D50] border-[#2F5D50]/40 shadow-xs" 
              : dogFriendly === false
                ? "bg-[#FDF2F2] text-[#B3261E] border-[#F5C2C2]" 
                : "bg-[#FAF6EF] text-[#536259] border-[#E2DAC8]"
          }`}
        >
          {dogFriendly === null ? "Doesn't Matter" : dogFriendly ? "Yes (Required)" : "No Dogs"}
        </button>
      </div>
    </div>
  );
}
