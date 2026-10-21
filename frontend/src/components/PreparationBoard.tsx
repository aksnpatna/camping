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
  HelpCircle,
  ShoppingBag,
  Compass
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-fade-in font-sans">
      <div className="bg-paper-card border border-paper-rule rounded-sm w-full max-w-4xl max-h-[92vh] flex flex-col text-ink shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 md:p-6 border-b border-paper-rule flex items-center justify-between bg-paper-card">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-eucalypt bg-paper-tint border border-[#2F5D50]/30 px-2.5 py-0.5 rounded-full">
                Preparation
              </span>
              <span className="text-xs text-ink-muted">
                Party of {partySize} {hasDog && "• Dog"}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold font-serif text-ink mt-1">
              {campsiteName}
            </h2>
            <p className="text-xs text-ink-muted">
              Condition-aware checklist with calculated reasons, water rations, and pre-departure tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/pack/${campsiteId}`}
              target="_blank"
              rel="noreferrer"
              className="bg-paper-page hover:bg-paper-sunk text-ink border border-paper-rule px-3 py-2 rounded-xs text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
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
              className="bg-paper-page hover:bg-paper-sunk text-ink border border-paper-rule px-3 py-2 rounded-xs text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Share Checklist"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">{copiedLink ? "Copied!" : "Share"}</span>
            </button>
            <button 
              onClick={onClose}
              className="text-ink-muted hover:text-ink p-2 text-xl font-bold rounded-xs hover:bg-paper-sunk transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PROGRESS BAR & TABS */}
        <div className="bg-paper-page border-b border-paper-rule px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("packing")}
              className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "packing"
                  ? "bg-eucalypt text-white shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Package size={14} /> Packing List ({packedCount}/{totalPackingCount})
            </button>
            <button
              onClick={() => setActiveTab("departure")}
              className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "departure"
                  ? "bg-eucalypt text-white shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Flame size={14} /> Departure & Food ({checklist?.departure_tasks.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("gear")}
              className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "gear"
                  ? "bg-eucalypt text-white shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Compass size={14} /> My Gear Profile ({gearProfile.length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="text-xs font-bold text-ink">
              {progressPercent}% Packed
            </div>
            <div className="w-32 bg-[#E2DAC8] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-eucalypt h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 bg-paper-page/30">
          
          {loading ? (
            <div className="text-center py-16 text-ink-muted animate-pulse text-sm">
              Building your checklist…
            </div>
          ) : activeTab === "gear" ? (
            /* TAB 1: REUSABLE GEAR PROFILE */
            <div className="space-y-6">
              <div className="bg-paper-card border border-paper-rule p-4 rounded-xs shadow-xs">
                <h3 className="text-sm font-bold text-ink mb-1">Personal Equipment Profile</h3>
                <p className="text-xs text-ink-muted mb-4">
                  Select the camping items you already own. We match these against trip requirements to flag missing essentials and suggest borrowing before buying.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {DEFAULT_EQUIPMENT_PRESETS.map((item) => {
                    const owned = gearProfile.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => toggleProfileItem(item)}
                        className={`px-3 py-1.5 rounded-xs text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          owned
                            ? "bg-paper-tint text-eucalypt border-[#2F5D50]/40 shadow-xs font-bold"
                            : "bg-paper-page text-ink-muted border-paper-rule hover:border-[#2F5D50]/40 hover:text-ink"
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
                    className="flex-1 bg-paper-page border border-paper-rule rounded-xs px-3 py-2 text-xs text-ink outline-none focus:border-eucalypt"
                  />
                  <button
                    onClick={handleAddCustomGear}
                    className="bg-eucalypt hover:bg-eucalypt/90 text-white px-4 py-2 rounded-xs text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              {gearProfile.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                    Your Saved Gear ({gearProfile.length} items)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {gearProfile.map((g) => (
                      <span 
                        key={g} 
                        className="bg-paper-card border border-paper-rule text-ink text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-xs"
                      >
                        {g}
                        <button 
                          onClick={() => saveGearProfile(gearProfile.filter(i => i !== g))}
                          className="text-ink-muted hover:text-clay cursor-pointer"
                          aria-label="Remove gear item"
                        >
                          <X size={12} />
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
              <div className="bg-paper-tint border border-eucalypt/30 p-4 rounded-xs flex items-start gap-3">
                <Droplets className="text-eucalypt shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-eucalypt">
                    Mandatory Water Ration: {partySize * 5} Litres Minimum
                  </h4>
                  <p className="text-xs text-ink-muted mt-1">
                    Calculated at 5L per person/day for Australian conditions. Do not rely on unpotable creek or dam water.
                  </p>
                </div>
              </div>

              {/* FOOD & SHOPPING */}
              <div className="bg-paper-card border border-paper-rule p-5 rounded-xs space-y-3 shadow-xs">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <ShoppingBag size={15} /> Food & Shopping Essentials
                </h3>
                <div className="space-y-2">
                  {checklist?.food_and_shopping.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleTask(`food_${idx}`)}
                      className="flex items-center gap-3 p-2.5 rounded-xs hover:bg-paper-page cursor-pointer text-xs transition-colors"
                    >
                      {completedTasks[`food_${idx}`] ? (
                        <CheckSquare className="text-eucalypt shrink-0" size={16} />
                      ) : (
                        <Square className="text-ink-muted" size={16} />
                      )}
                      <span className={completedTasks[`food_${idx}`] ? "line-through text-ink-muted" : "text-ink font-medium"}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRE-DEPARTURE TASKS */}
              <div className="bg-paper-card border border-paper-rule p-5 rounded-xs space-y-3 shadow-xs">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Flame size={16} className="text-[#C9822B]" /> Pre-Departure Safety Tasks
                </h3>
                <div className="space-y-2">
                  {checklist?.departure_tasks.map((task, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleTask(`dept_${idx}`)}
                      className="flex items-center gap-3 p-2.5 rounded-xs hover:bg-paper-page cursor-pointer text-xs transition-colors"
                    >
                      {completedTasks[`dept_${idx}`] ? (
                        <CheckSquare className="text-eucalypt shrink-0" size={16} />
                      ) : (
                        <Square className="text-ink-muted" size={16} />
                      )}
                      <span className={completedTasks[`dept_${idx}`] ? "line-through text-ink-muted" : "text-ink font-medium"}>
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
                <div className="bg-paper-tint border border-ochre/30 p-4 rounded-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#8A5818] font-bold text-xs">
                    <AlertTriangle size={16} className="shrink-0 text-[#C9822B]" />
                    <span>Missing Gear Alert — Prioritize Borrowing or Renting First:</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs text-[#8A5818]/90 space-y-1">
                    {checklist.missing_equipment_alerts.slice(0, 3).map((alert, i) => (
                      <li key={i}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* GROUPED CATEGORIES */}
              {Object.entries(categories).map(([catName, items]) => (
                <div key={catName} className="bg-paper-card border border-paper-rule p-5 rounded-xs space-y-3 shadow-xs">
                  <div className="flex justify-between items-center border-b border-paper-rule pb-2">
                    <h3 className="text-sm font-bold font-serif text-ink uppercase tracking-wider">
                      {catName}
                    </h3>
                    <span className="text-[11px] text-ink-muted font-medium">
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
                          className={`p-3 rounded-xs border transition-all cursor-pointer flex items-start gap-3 ${
                            isPacked 
                              ? "bg-paper-page border-paper-rule opacity-75"
                              : "bg-paper-card border-paper-rule hover:border-[#2F5D50]/40 shadow-xs"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isPacked ? (
                              <CheckSquare className="text-eucalypt" size={17} />
                            ) : (
                              <Square className="text-ink-muted" size={17} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className={`text-xs font-bold ${isPacked ? "line-through text-ink-muted" : "text-ink"}`}>
                                {item.item}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-paper-page text-ink-muted border border-paper-rule px-2 py-0.5 rounded font-mono">
                                  {item.quantity}
                                </span>
                                {item.owned ? (
                                  <span className="text-[10px] bg-paper-tint text-eucalypt border border-[#2F5D50]/30 px-1.5 py-0.5 rounded font-bold">
                                    Owned
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-paper-tint text-[#8A5818] border border-ochre/30 px-1.5 py-0.5 rounded font-bold">
                                    Borrow/Rent
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Calculated Reason */}
                            <p className="text-[11px] text-ink-muted mt-1 flex items-center gap-1">
                              <HelpCircle size={11} className="text-eucalypt shrink-0" />
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
        <div className="p-4 bg-paper-card border-t border-paper-rule flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            Camp Smart Australia • All packing advice is condition-calculated.
          </span>
          <button
            onClick={onClose}
            className="bg-eucalypt text-white font-bold text-xs px-5 py-2.5 rounded-xs transition-all hover:bg-eucalypt/90 cursor-pointer shadow-xs"
          >
            Done Preparing
          </button>
        </div>

      </div>
    </div>
  );
}
