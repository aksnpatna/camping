"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  Users, 
  Share2, 
  Check, 
  CheckSquare, 
  Square, 
  Star, 
  Dog, 
  MapPin, 
  ArrowLeft,
  Package,
  Calendar,
  AlertCircle
} from "lucide-react";
import { getApiUrl } from "@/config";

interface ShortlistCampsiteSummary {
  id: number;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  dog_friendly: boolean | null;
  rig_access: string[];
  management_type: string | null;
  primary_votes: number;
  backup_votes: number;
}

interface TripRoomData {
  id: number;
  room_token: string;
  trip_name: string;
  created_by_email: string;
  start_date: string;
  end_date: string;
  shortlist_campsites: ShortlistCampsiteSummary[];
  votes: Array<{ campsite_id: number; voter_name: string; vote_type: string }>;
  primary_votes: Record<string, number>;
  backup_votes: Record<string, number>;
  claimed_gear: Array<{ item_name: string; claimed_by: string }>;
  tasks: Array<{ id: string; title: string; completed: boolean; assigned_to: string | null }>;
  preferences: Array<{ member_name: string; preference: string }>;
}

export default function TripRoomPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [room, setRoom] = useState<TripRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voterName, setVoterName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("campsmart_nickname") || "";
    }
    return "";
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"campsites" | "gear" | "tasks" | "notes">("campsites");

  // Form states
  const [newGearItem, setNewGearItem] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newPrefText, setNewPrefText] = useState("");

  const handleSaveNickname = (name: string) => {
    setVoterName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("campsmart_nickname", name);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchRoomData = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/trips/rooms/${token}`);
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          setRoom(data);
        } else {
          setError("Trip Room not found. It may have expired or the link is invalid.");
        }
      } catch (err) {
        if (!isMounted) return;
        setError("Unable to connect to Camp Smart server.");
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoomData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleVote = async (campsiteId: number, voteType: "primary" | "backup") => {
    const name = voterName.trim() || "Anonymous Camper";
    try {
      const res = await fetch(`${getApiUrl()}/trips/rooms/${token}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campsite_id: campsiteId,
          vote_type: voteType,
          voter_name: name
        })
      });
      if (res.ok) {
        setRoom(await res.json());
      }
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  const handleClaimGear = async (itemName: string, claimer: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/trips/rooms/${token}/claim-gear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: itemName,
          claimer_name: claimer
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setNewGearItem("");
      }
    } catch (err) {
      console.error("Claim gear failed:", err);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      const res = await fetch(`${getApiUrl()}/trips/rooms/${token}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          title: "",
          completed: !currentCompleted
        })
      });
      if (res.ok) {
        setRoom(await res.json());
      }
    } catch (err) {
      console.error("Toggle task failed:", err);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch(`${getApiUrl()}/trips/rooms/${token}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          assigned_to: voterName || null,
          completed: false
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setNewTaskTitle("");
      }
    } catch (err) {
      console.error("Add task failed:", err);
    }
  };

  const handleAddPreference = async () => {
    if (!newPrefText.trim()) return;
    const name = voterName.trim() || "Anonymous Camper";
    try {
      const res = await fetch(`${getApiUrl()}/trips/rooms/${token}/preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_name: name,
          preference: newPrefText.trim()
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setNewPrefText("");
      }
    } catch (err) {
      console.error("Add preference failed:", err);
    }
  };

  const copyRoomLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071912] text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[var(--color-neon-green)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-emerald-300 font-bold text-sm tracking-wide">Loading Shared Trip Room...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#071912] text-white flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-black mb-2">Trip Room Unavailable</h2>
          <p className="text-xs text-gray-300 mb-6">{error || "Unable to find trip room."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-black hover:bg-[#00e67a]"
          >
            <ArrowLeft size={14} /> Back to Camp Smart AU
          </Link>
        </div>
      </div>
    );
  }

  // Pre-seeded gear items if list is empty
  const defaultGearSuggestions = [
    "Gazebo / 3x3 Weather Awning",
    "Double Burner Camp Stove + LPG",
    "12V Camping Fridge / 60L Esky",
    "First Aid Kit & Snake Bite Bandages",
    "Camp Folding Table",
    "LED Camp Lanterns & Rechargeable Torch",
    "Dry Firewood Bundle & Fire Starters"
  ];

  return (
    <div className="min-h-screen bg-[#071912] text-white flex flex-col">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowLeft size={16} /> Home
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-neon-green)] bg-[var(--color-neon-green)]/10 border border-[var(--color-neon-green)]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Users size={11} /> Group Trip Room
                </span>
                <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">#{room.room_token}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">{room.trip_name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomLink}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                copiedLink 
                  ? "bg-green-500/20 text-green-300 border-green-500/40" 
                  : "bg-white/10 text-white border-white/15 hover:bg-white/20"
              }`}
            >
              {copiedLink ? <Check size={14} /> : <Share2 size={14} />}
              <span>{copiedLink ? "Link Copied!" : "Share Room"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MEMBER BAR */}
      <div className="bg-[#0b241a]/80 border-b border-white/5 py-2.5 px-4 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar size={14} className="text-emerald-400" />
            <span>Target Dates: <strong className="text-white">{room.start_date} → {room.end_date}</strong></span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-gray-400 shrink-0">Your Name:</span>
            <input 
              type="text"
              value={voterName}
              onChange={(e) => handleSaveNickname(e.target.value)}
              placeholder="e.g. Jack, Sam..."
              className="bg-black/40 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white outline-none w-36 focus:border-[var(--color-neon-green)] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="max-w-6xl mx-auto px-4 pt-4 w-full">
        <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1">
          {[
            { id: "campsites", label: `Shortlist Voting (${room.shortlist_campsites.length})`, icon: Star },
            { id: "gear", label: `Shared Gear (${room.claimed_gear.length})`, icon: Package },
            { id: "tasks", label: `Prep Tasks (${room.tasks.length})`, icon: CheckSquare },
            { id: "notes", label: `Group Notes (${room.preferences.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
                  active 
                    ? "text-[var(--color-neon-green)] border-[var(--color-neon-green)] bg-white/5" 
                    : "text-gray-400 border-transparent hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        {/* TAB 1: SHORTLIST CAMPSITES & VOTING */}
        {activeTab === "campsites" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Group Shortlist Candidates</h2>
                <p className="text-xs text-gray-400">Vote on your preferred campsite and backup option.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {room.shortlist_campsites.map((site) => {
                const primaryCount = room.primary_votes[site.id.toString()] || 0;
                const backupCount = room.backup_votes[site.id.toString()] || 0;
                const myVote = room.votes.find(v => v.campsite_id === site.id && v.voter_name === (voterName || "Anonymous Camper"))?.vote_type;

                return (
                  <div 
                    key={site.id}
                    className="bg-[#0b241a] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl hover:border-emerald-500/30 transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-black text-white">{site.name}</h3>
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">
                          {site.state}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 flex items-center gap-1 mb-4">
                        <MapPin size={13} className="text-emerald-400" />
                        {site.management_type || "Public Reserve"}
                      </p>

                      <div className="space-y-1.5 text-xs text-gray-300 mb-5 bg-black/30 p-3 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1"><Dog size={12} /> Dog Policy:</span>
                          <span className="font-bold">
                            {site.dog_friendly === true ? "🐶 Allowed" : site.dog_friendly === false ? "🚫 No Pets" : "Unverified"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Rig Access:</span>
                          <span className="font-bold text-white truncate max-w-[140px]">
                            {site.rig_access.length ? site.rig_access.join(", ") : "Standard"}
                          </span>
                        </div>
                      </div>

                      {/* VOTING SUMMARY PILLS */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2.5 py-1 rounded-lg font-black flex items-center gap-1">
                          ⭐ {primaryCount} Primary
                        </span>
                        <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg font-black flex items-center gap-1">
                          🔄 {backupCount} Backup
                        </span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                      <button
                        onClick={() => handleVote(site.id, "primary")}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          myVote === "primary"
                            ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20"
                            : "bg-white/10 hover:bg-yellow-400/20 hover:text-yellow-300 text-white"
                        }`}
                      >
                        ⭐ {myVote === "primary" ? "Primary ✓" : "Vote Primary"}
                      </button>
                      <button
                        onClick={() => handleVote(site.id, "backup")}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          myVote === "backup"
                            ? "bg-blue-400 text-black shadow-lg shadow-blue-400/20"
                            : "bg-white/10 hover:bg-blue-400/20 hover:text-blue-300 text-white"
                        }`}
                      >
                        🔄 {myVote === "backup" ? "Backup ✓" : "Vote Backup"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: SHARED GEAR CLAIMING */}
        {activeTab === "gear" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">Shared Equipment Coordination</h2>
              <p className="text-xs text-gray-400">Claim what group equipment you can bring so no one doubles up or forgets essentials.</p>
            </div>

            {/* ADD CUSTOM GEAR */}
            <div className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newGearItem}
                onChange={(e) => setNewGearItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newGearItem && handleClaimGear(newGearItem, voterName || "Anonymous")}
                placeholder="Add gear item to bring (e.g. 2kW Generator, Marquee)..."
                className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none flex-1 focus:border-[var(--color-neon-green)]"
              />
              <button
                onClick={() => newGearItem && handleClaimGear(newGearItem, voterName || "Anonymous")}
                disabled={!newGearItem.trim()}
                className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-black hover:bg-[#00e67a] disabled:opacity-40 cursor-pointer"
              >
                + Add Item
              </button>
            </div>

            {/* GEAR LIST */}
            <div className="space-y-2">
              {/* Combine claimed gear and default suggestions */}
              {Array.from(new Set([
                ...room.claimed_gear.map(g => g.item_name),
                ...defaultGearSuggestions
              ])).map((item) => {
                const claim = room.claimed_gear.find(g => g.item_name === item);
                const isClaimedByMe = claim?.claimed_by === (voterName || "Anonymous Camper");

                return (
                  <div 
                    key={item}
                    className="bg-[#0b241a] border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Package size={16} className={claim ? "text-emerald-400" : "text-gray-500"} />
                      <div>
                        <span className="font-bold text-white block">{item}</span>
                        {claim ? (
                          <span className="text-[11px] text-emerald-300 flex items-center gap-1">
                            <Check size={11} /> Claimed by <strong>{claim.claimed_by}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500">Unclaimed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {claim ? (
                        isClaimedByMe ? (
                          <button
                            onClick={() => handleClaimGear(item, "")}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            Unclaim
                          </button>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[11px] font-medium">
                            Taken
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handleClaimGear(item, voterName || "Anonymous Camper")}
                          className="bg-white/10 hover:bg-[var(--color-neon-green)] hover:text-[var(--color-forest-900)] text-white px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        >
                          I&apos;ll Bring This
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SHARED PREP TASKS */}
        {activeTab === "tasks" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">Pre-Departure Task Checklist</h2>
              <p className="text-xs text-gray-400">Keep the crew aligned on vehicle permits, ice runs, and fire restrictions.</p>
            </div>

            {/* ADD TASK */}
            <div className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Add new task (e.g. Call NPWS for fire ban status)..."
                className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none flex-1 focus:border-[var(--color-neon-green)]"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-black hover:bg-[#00e67a] disabled:opacity-40 cursor-pointer"
              >
                + Add Task
              </button>
            </div>

            {/* TASKS LIST */}
            <div className="space-y-2">
              {room.tasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={() => handleToggleTask(task.id, task.completed)}
                  className={`border rounded-xl p-3 flex items-center justify-between text-xs cursor-pointer transition-all ${
                    task.completed 
                      ? "bg-black/30 border-white/5 opacity-60 line-through" 
                      : "bg-[#0b241a] border-white/10 hover:border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {task.completed ? (
                      <CheckSquare size={16} className="text-[var(--color-neon-green)] shrink-0" />
                    ) : (
                      <Square size={16} className="text-gray-400 shrink-0" />
                    )}
                    <span className="font-semibold text-white">{task.title}</span>
                  </div>

                  {task.assigned_to && (
                    <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      @{task.assigned_to}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GROUP NOTES & PREFERENCES */}
        {activeTab === "notes" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">Group Preferences & Trip Notes</h2>
              <p className="text-xs text-gray-400">Share dietary needs, vehicle heights, or arrival windows.</p>
            </div>

            {/* ADD NOTE */}
            <div className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newPrefText}
                onChange={(e) => setNewPrefText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPreference()}
                placeholder="Share note (e.g. Arriving Friday ~8pm, bringing dog leash stake)..."
                className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none flex-1 focus:border-[var(--color-neon-green)]"
              />
              <button
                onClick={handleAddPreference}
                disabled={!newPrefText.trim()}
                className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-black hover:bg-[#00e67a] disabled:opacity-40 cursor-pointer"
              >
                + Post Note
              </button>
            </div>

            {/* NOTES LIST */}
            <div className="space-y-3">
              {room.preferences.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs">
                  No notes yet. Post arrival details or equipment preferences above!
                </div>
              ) : (
                room.preferences.map((p, idx) => (
                  <div key={idx} className="bg-[#0b241a] border border-white/10 rounded-xl p-3.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-emerald-400 font-bold">{p.member_name}</strong>
                      <span className="text-[10px] text-gray-500">Member note</span>
                    </div>
                    <p className="text-gray-200">{p.preference}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
