"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  X, 
  Share2, 
  Check, 
  CheckSquare, 
  Square, 
  ShieldCheck, 
  Star, 
  Dog,
  MapPin,
  Car
} from "lucide-react";
import { getApiUrl } from "@/config";
import type { TripCardData } from "./FindWeekendPlanner";

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

interface TripRoomModalProps {
  initialCards: TripCardData[];
  onClose: () => void;
}

export default function TripRoomModal({
  initialCards,
  onClose
}: TripRoomModalProps) {
  const [room, setRoom] = useState<TripRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voterName, setVoterName] = useState("");
  const [gearItemName, setGearItemName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [prefName, setPrefName] = useState("");
  const [prefText, setPrefText] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"campsites" | "gear" | "tasks" | "notes">("campsites");

  // Load existing room or create a new room from initial shortlist
  useEffect(() => {
    let isCancelled = false;
    const initRoom = async () => {
      setLoading(true);
      try {
        const apiUrl = getApiUrl();
        const storedToken = localStorage.getItem("campsmart_active_room_token");
        if (storedToken) {
          const res = await fetch(`${apiUrl}/trips/rooms/${storedToken}`);
          if (res.ok) {
            const data = await res.json();
            if (!isCancelled) {
              setRoom(data);
              setLoading(false);
              return;
            }
          }
        }

        // Create new room
        const shortlistIds = initialCards.map(c => c.id);
        const createRes = await fetch(`${apiUrl}/trips/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trip_name: "Weekend Camping Shortlist",
            created_by_email: "organizer@campsmart.au",
            start_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
            end_date: new Date(Date.now() + 86400000 * 9).toISOString().split("T")[0],
            shortlist_campsite_ids: shortlistIds
          })
        });

        if (createRes.ok) {
          const newRoom = await createRes.json();
          if (!isCancelled) {
            setRoom(newRoom);
            localStorage.setItem("campsmart_active_room_token", newRoom.room_token);
          }
        }
      } catch (err) {
        console.error("Error creating/fetching trip room:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    initRoom();
    return () => {
      isCancelled = true;
    };
  }, [initialCards]);

  const handleVote = async (campsiteId: number, voteType: "primary" | "backup") => {
    if (!room) return;
    const name = voterName.trim() || "Anonymous Camper";
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/trips/rooms/${room.room_token}/vote`, {
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
    } catch (e) {
      console.error("Failed to vote:", e);
    }
  };

  const handleClaimGear = async () => {
    if (!room || !gearItemName.trim()) return;
    const name = voterName.trim() || "Anonymous Camper";
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/trips/rooms/${room.room_token}/claim-gear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: gearItemName.trim(),
          claimer_name: name
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setGearItemName("");
      }
    } catch (e) {
      console.error("Failed to claim gear:", e);
    }
  };

  const handleAddTask = async () => {
    if (!room || !taskTitle.trim()) return;
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/trips/rooms/${room.room_token}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          assigned_to: voterName.trim() || null,
          completed: false
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setTaskTitle("");
      }
    } catch (e) {
      console.error("Failed to add task:", e);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    if (!room) return;
    try {
      const apiUrl = getApiUrl();
      const target = room.tasks.find(t => t.id === taskId);
      if (!target) return;
      const res = await fetch(`${apiUrl}/trips/rooms/${room.room_token}/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          title: target.title,
          assigned_to: target.assigned_to,
          completed: !currentCompleted
        })
      });
      if (res.ok) {
        setRoom(await res.json());
      }
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  };

  const handleAddPreference = async () => {
    if (!room || !prefText.trim()) return;
    const member = prefName.trim() || voterName.trim() || "Camper";
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/trips/rooms/${room.room_token}/preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_name: member,
          preference: prefText.trim()
        })
      });
      if (res.ok) {
        setRoom(await res.json());
        setPrefText("");
      }
    } catch (e) {
      console.error("Failed to add preference:", e);
    }
  };

  const copyRoomLink = () => {
    if (!room) return;
    const shareUrl = `${window.location.origin}/?room=${room.room_token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 animate-fadeIn">
      <div className="bg-[#0b1f17] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col text-white shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 md:p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--color-neon-green)] bg-[var(--color-neon-green)]/10 border border-[var(--color-neon-green)]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Users size={12} /> Phase 2 • Shared Trip Room
              </span>
              {room && (
                <span className="text-xs text-gray-400 font-mono">
                  Room #{room.room_token}
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-1">
              {room?.trip_name || "Weekend Shortlist"}
            </h2>
            <p className="text-xs text-gray-300">
              Invite your group to vote on Primary vs Backup campsites, claim gear, and divide prep tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomLink}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check size={14} className="text-[var(--color-neon-green)]" /> : <Share2 size={14} />}
              <span>{copiedLink ? "Link Copied!" : "Copy Invite Link"}</span>
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 text-xl font-bold rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* YOUR NAME INPUT BAR */}
        <div className="bg-black/25 border-b border-white/10 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-medium">Your Name:</span>
            <input
              type="text"
              placeholder="e.g. Sam, Sarah..."
              value={voterName}
              onChange={e => setVoterName(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[var(--color-neon-green)] w-36"
            />
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("campsites")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "campsites"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              ⭐ Campsite Voting ({room?.shortlist_campsites.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("gear")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "gear"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              🎒 Shared Gear ({room?.claimed_gear.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "tasks"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              📋 Tasks ({room?.tasks.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "notes"
                  ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              💬 Group Notes ({room?.preferences.length || 0})
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {loading ? (
            <div className="text-center py-16 text-gray-400 animate-pulse text-sm">
              Loading shared room data...
            </div>
          ) : activeTab === "campsites" ? (
            /* TAB 1: SHORTLIST CAMPSITE VOTING */
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Vote for your top destination (Primary Pick) and fallback site (Backup Pick).</span>
                <span className="font-mono text-gray-300">Total Votes: {room?.votes.length || 0}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {room?.shortlist_campsites.map((site) => {
                  const pVotes = room.primary_votes[String(site.id)] || 0;
                  const bVotes = room.backup_votes[String(site.id)] || 0;

                  return (
                    <div 
                      key={site.id} 
                      className="bg-black/30 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-black text-white">{site.name}</h4>
                          <span className="text-[11px] bg-white/10 text-gray-300 px-2 py-0.5 rounded font-medium">
                            {site.state}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-gray-300 mb-4">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-gray-400" />
                            <span>{site.management_type || "National Park"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Dog size={13} className={site.dog_friendly ? "text-emerald-400" : "text-gray-400"} />
                            <span>{site.dog_friendly === true ? "Dogs Allowed" : site.dog_friendly === false ? "No Dogs Allowed" : "Pet Policy Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Car size={13} className="text-gray-400" />
                            <span>{site.rig_access.length > 0 ? site.rig_access.join(", ") : "Standard vehicle"}</span>
                          </div>
                        </div>

                        {/* LIVE VOTE TALLIES */}
                        <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-2.5 rounded-xl text-xs mb-4">
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                            <Star size={14} className="fill-amber-400 text-amber-400" />
                            <span>{pVotes} Primary</span>
                          </div>
                          <span className="text-gray-500">•</span>
                          <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                            <ShieldCheck size={14} className="text-sky-400" />
                            <span>{bVotes} Backup</span>
                          </div>
                        </div>
                      </div>

                      {/* VOTING BUTTONS */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => handleVote(site.id, "primary")}
                          className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Star size={13} /> Vote Primary
                        </button>
                        <button
                          onClick={() => handleVote(site.id, "backup")}
                          className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck size={13} /> Vote Backup
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === "gear" ? (
            /* TAB 2: SHARED GEAR CLAIMS */
            <div className="space-y-6">
              <div className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-white">Claim Equipment to Bring</h3>
                <p className="text-xs text-gray-400">
                  Avoid duplicates! Tag items you are bringing for the whole group (e.g. stove, esky, gazebo).
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Item name (e.g. 2-Burner Gas Stove, 60L Esky)..."
                    value={gearItemName}
                    onChange={e => setGearItemName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleClaimGear()}
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-neon-green)]"
                  />
                  <button
                    onClick={handleClaimGear}
                    className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[#00e67a] cursor-pointer"
                  >
                    Claim Gear
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Claimed Items ({room?.claimed_gear.length || 0})
                </h4>
                {room?.claimed_gear.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 italic">No gear claimed yet. Be the first to claim an item!</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {room?.claimed_gear.map((claim, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{claim.item_name}</span>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-medium">
                          Brought by {claim.claimed_by}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "tasks" ? (
            /* TAB 3: GROUP TASKS */
            <div className="space-y-6">
              <div className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-white">Add Group Preparation Task</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Task (e.g. Buy 20kg party ice, Download offline map)..."
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddTask()}
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[var(--color-neon-green)]"
                  />
                  <button
                    onClick={handleAddTask}
                    className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[#00e67a] cursor-pointer"
                  >
                    Add Task
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Trip Tasks ({room?.tasks.length || 0})
                </h4>
                {room?.tasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t.id, t.completed)}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {t.completed ? (
                        <CheckSquare className="text-[var(--color-neon-green)] shrink-0" size={16} />
                      ) : (
                        <Square className="text-gray-500 shrink-0" size={16} />
                      )}
                      <span className={t.completed ? "line-through text-gray-500" : "text-white font-medium"}>
                        {t.title}
                      </span>
                    </div>
                    {t.assigned_to && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        @{t.assigned_to}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* TAB 4: GROUP NOTES & PREFERENCES */
            <div className="space-y-6">
              <div className="bg-black/30 border border-white/10 p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-white">Add Member Preference or Note</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Your Name..."
                    value={prefName}
                    onChange={e => setPrefName(e.target.value)}
                    className="bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Note (e.g. Leaving 6am Saturday, bringing dog)..."
                    value={prefText}
                    onChange={e => setPrefText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddPreference()}
                    className="sm:col-span-2 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddPreference}
                    className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[#00e67a] cursor-pointer"
                  >
                    Post Note
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Shared Notes ({room?.preferences.length || 0})
                </h4>
                {room?.preferences.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 italic">No notes posted yet.</div>
                ) : (
                  <div className="space-y-2">
                    {room?.preferences.map((p, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-3.5 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-[var(--color-neon-green)]">{p.member_name}</span>
                        <p className="text-gray-300">{p.preference}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Votes and tasks update in real time for everyone using this link.
          </span>
          <button
            onClick={onClose}
            className="bg-white/15 hover:bg-white/25 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer"
          >
            Close Room
          </button>
        </div>

      </div>
    </div>
  );
}
