"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckSquare, 
  Square, 
  Package, 
  AlertTriangle, 
  Share2, 
  Printer, 
  Plus, 
  X,
  Droplets,
  Flame,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { getApiUrl } from "@/config";

interface PackingItem {
  category: string;
  item: string;
  quantity: string;
  reason: string;
  owned: boolean;
  borrow_first: boolean;
}

interface ChecklistResponse {
  campsite_id: number;
  campsite_name: string;
  packing_items: PackingItem[];
  food_and_shopping: string[];
  departure_tasks: string[];
  missing_equipment_alerts: string[];
}

interface PreparationBoardProps {
  campsiteId: number;
  campsiteName: string;
  partySize?: number;
  hasDog?: boolean;
  onClose: () => void;
}

const DEFAULT_EQUIPMENT_PRESETS = [
  "2-Person Tent",
  "Sleeping Bag",
  "Sleeping Pad",
  "Portable Gas Stove",
  "Cooler / Esky",
  "LED Headlamp",
  "First Aid Kit",
  "Camp Chairs",
  "Insect Repellent",
  "Water Canteen"
];

export default function PreparationBoard({
  campsiteId,
  campsiteName,
  partySize = 2,
  hasDog = false,
  onClose
}: PreparationBoardProps) {
  const [gearProfile, setGearProfile] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("campsmart_gear_profile");
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return ["2-Person Tent", "Sleeping Bag", "Sleeping Pad", "LED Headlamp"];
  });
  const [customGearInput, setCustomGearInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"gear" | "packing" | "departure">("packing");
  const [copiedLink, setCopiedLink] = useState(false);


  // Save gear profile whenever it changes
  const saveGearProfile = (newProfile: string[]) => {
    setGearProfile(newProfile);
    try {
      localStorage.setItem("campsmart_gear_profile", JSON.stringify(newProfile));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  };

  const toggleProfileItem = (item: string) => {
    if (gearProfile.includes(item)) {
      saveGearProfile(gearProfile.filter(i => i !== item));
    } else {
      saveGearProfile([...gearProfile, item]);
    }
  };

  const handleAddCustomGear = () => {
    if (!customGearInput.trim()) return;
    const trimmed = customGearInput.trim();
    if (!gearProfile.includes(trimmed)) {
      saveGearProfile([...gearProfile, trimmed]);
    }
    setCustomGearInput("");
  };

  // Fetch or re-generate tailored checklist
  useEffect(() => {
    let isCancelled = false;
    const fetchChecklist = async () => {
      setLoading(true);
      try {
        const apiUrl = getApiUrl();
        const res = await fetch(`${apiUrl}/trips/checklist/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campsite_id: campsiteId,
            gear_profile: gearProfile,
            party_size: partySize,
            has_dog: hasDog
          })
        });
        if (res.ok) {
          const data: ChecklistResponse = await res.json();
          if (!isCancelled) {
            setChecklist(data);
          }
        }
      } catch (err) {
        console.error("Failed to generate checklist:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchChecklist();
    return () => {
      isCancelled = true;
    };
  }, [campsiteId, gearProfile, partySize, hasDog]);

  const togglePacked = (itemKey: string) => {
    setPackedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };

  const toggleTask = (taskKey: string) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskKey]: !prev[taskKey]
    }));
  };

  const totalPackingCount = checklist?.packing_items.length || 0;
  const packedCount = checklist?.packing_items.filter(i => packedItems[i.item]).length || 0;
  const progressPercent = totalPackingCount > 0 ? Math.round((packedCount / totalPackingCount) * 100) : 0;

  // Group items by category
  const categories: Record<string, PackingItem[]> = {};
  if (checklist) {
    checklist.packing_items.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-[#0b1f17] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col text-white shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 md:p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--color-neon-green)] bg-[var(--color-neon-green)]/10 border border-[var(--color-neon-green)]/30 px-2.5 py-0.5 rounded-full">
                Phase 2 • Preparation Board
              </span>
              <span className="text-xs text-gray-400">
                Party of {partySize} {hasDog && "• 🐶 Dog"}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
              {campsiteName}
            </h2>
            <p className="text-xs text-gray-300">
              Condition-aware checklist with calculated reasons, water rations, and pre-departure tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/pack/${campsiteId}`}
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Print Offline PDF"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Offline Pack</span>
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Share Checklist"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">{copiedLink ? "Copied!" : "Share"}</span>
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 text-xl font-bold rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PROGRESS BAR & TABS */}
        <div className="bg-black/20 border-b border-white/10 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("packing")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "packing"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Package size={14} /> Packing List ({packedCount}/{totalPackingCount})
            </button>
            <button
              onClick={() => setActiveTab("departure")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "departure"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <Flame size={14} /> Departure & Food ({checklist?.departure_tasks.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("gear")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "gear"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              🎒 My Gear Profile ({gearProfile.length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="text-xs font-bold text-gray-300">
              {progressPercent}% Packed
            </div>
            <div className="w-32 bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[var(--color-neon-green)] h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          
          {loading ? (
            <div className="text-center py-16 text-gray-400 animate-pulse text-sm">
              Analyzing campsite terrain, weather forecasts, and gear needs...
            </div>
          ) : activeTab === "gear" ? (
            /* TAB 1: REUSABLE GEAR PROFILE */
            <div className="space-y-6">
              <div className="bg-black/30 border border-white/10 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-white mb-1">Personal Equipment Profile</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Select the camping items you already own. We match these against trip requirements to flag missing essentials and suggest borrowing before buying.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {DEFAULT_EQUIPMENT_PRESETS.map((item) => {
                    const owned = gearProfile.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => toggleProfileItem(item)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          owned
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                            : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-200"
                        }`}
                      >
                        {owned ? <CheckCircle2 size={13} /> : <Plus size={13} />}
                        {item}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom gear (e.g. 12V Fridge, Camp Oven)..."
                    value={customGearInput}
                    onChange={e => setCustomGearInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddCustomGear()}
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-neon-green)]"
                  />
                  <button
                    onClick={handleAddCustomGear}
                    className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {gearProfile.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Your Saved Gear ({gearProfile.length} items)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {gearProfile.map((g) => (
                      <span 
                        key={g} 
                        className="bg-white/10 border border-white/10 text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5"
                      >
                        {g}
                        <button 
                          onClick={() => saveGearProfile(gearProfile.filter(i => i !== g))}
                          className="text-gray-400 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "departure" ? (
            /* TAB 2: DEPARTURE & FOOD CHECKLIST */
            <div className="space-y-6">
              
              {/* WATER & HYDRATION HIGHLIGHT */}
              <div className="bg-sky-500/10 border border-sky-500/30 p-4 rounded-xl flex items-start gap-3">
                <Droplets className="text-sky-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-sky-200">
                    Mandatory Water Ration: {partySize * 5} Litres Minimum
                  </h4>
                  <p className="text-xs text-sky-300/80 mt-1">
                    Calculated at 5L per person/day for Australian conditions. Do not rely on unpotable creek or dam water.
                  </p>
                </div>
              </div>

              {/* FOOD & SHOPPING */}
              <div className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  🛒 Food & Shopping Essentials
                </h3>
                <div className="space-y-2">
                  {checklist?.food_and_shopping.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleTask(`food_${idx}`)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs transition-colors"
                    >
                      {completedTasks[`food_${idx}`] ? (
                        <CheckSquare className="text-[var(--color-neon-green)] shrink-0" size={16} />
                      ) : (
                        <Square className="text-gray-500 shrink-0" size={16} />
                      )}
                      <span className={completedTasks[`food_${idx}`] ? "line-through text-gray-500" : "text-gray-200 font-medium"}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRE-DEPARTURE TASKS */}
              <div className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame size={16} className="text-amber-400" /> Pre-Departure Safety Tasks
                </h3>
                <div className="space-y-2">
                  {checklist?.departure_tasks.map((task, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleTask(`dept_${idx}`)}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs transition-colors"
                    >
                      {completedTasks[`dept_${idx}`] ? (
                        <CheckSquare className="text-[var(--color-neon-green)] shrink-0" size={16} />
                      ) : (
                        <Square className="text-gray-500 shrink-0" size={16} />
                      )}
                      <span className={completedTasks[`dept_${idx}`] ? "line-through text-gray-500" : "text-gray-200 font-medium"}>
                        {task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 3: PACKING CHECKLIST GROUPED BY CATEGORY */
            <div className="space-y-6">
              
              {/* MISSING EQUIPMENT BORROW ALERT BANNER */}
              {checklist && checklist.missing_equipment_alerts.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>Missing Gear Alert — Prioritize Borrowing or Renting First:</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-amber-200/80 space-y-1">
                    {checklist.missing_equipment_alerts.slice(0, 3).map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* GROUPED CATEGORIES */}
              {Object.entries(categories).map(([catName, items]) => (
                <div key={catName} className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {catName}
                    </h3>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {items.filter(i => packedItems[i.item]).length} of {items.length} packed
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item) => {
                      const isPacked = Boolean(packedItems[item.item]);
                      return (
                        <div
                          key={item.item}
                          onClick={() => togglePacked(item.item)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isPacked 
                              ? "bg-emerald-950/20 border-emerald-500/30 opacity-75"
                              : "bg-white/5 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isPacked ? (
                              <CheckSquare className="text-[var(--color-neon-green)]" size={17} />
                            ) : (
                              <Square className="text-gray-500" size={17} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${isPacked ? "line-through text-gray-400" : "text-white"}`}>
                                {item.item}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-mono">
                                  {item.quantity}
                                </span>
                                {item.owned ? (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
                                    Owned
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                    Borrow/Rent
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Calculated Reason */}
                            <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                              <HelpCircle size={11} className="text-[var(--color-neon-green)] shrink-0" />
                              <span>{item.reason}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Camp Smart Australia • All packing advice is condition-calculated.
          </span>
          <button
            onClick={onClose}
            className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] font-bold text-xs px-5 py-2 rounded-xl transition-all hover:bg-[#00e67a] cursor-pointer"
          >
            Done Preparing
          </button>
        </div>

      </div>
    </div>
  );
}
