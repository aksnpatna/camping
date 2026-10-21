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
  RefreshCw,
  Dog, 
  MapPin, 
  ArrowLeft,
  Package,
  Calendar,
  AlertCircle
} from "lucide-react";
import { getApiUrl } from "@/config";
import { Badge } from "@/components/ui/Badge";

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

function TripRoomContent({ params }: { params: Promise<{ token: string }> }) {
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
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-eucalypt border-t-transparent rounded-full animate-spin mb-3" />
        <p className="t-body text-ink-muted text-xs">Loading trip room…</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-paper-card border border-clay p-6 rounded-sm max-w-md shadow-sm">
          <AlertCircle className="w-10 h-10 text-clay mx-auto mb-3" />
          <h2 className="font-serif text-lg font-semibold text-ink mb-2">Trip room unavailable</h2>
          <p className="t-body text-xs text-ink-muted mb-5">{error || "Unable to find trip room."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-1.5 bg-eucalypt text-paper px-4 py-2 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Camp Smart Australia
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
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-eucalypt selection:text-paper">
      {/* HEADER */}
      <header className="border-b border-paper-rule bg-paper-tint sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="text-ink-muted hover:text-ink p-1 rounded-sm hover:bg-paper-sunk transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <div className="h-4 w-px bg-paper-rule" />
            <div>
              <div className="flex items-center gap-2">
                <span className="t-micro text-eucalypt bg-eucalypt-tint border border-eucalypt/30 px-1.5 py-0.2 rounded-xs flex items-center gap-1">
                  <Users size={10} /> Trip Room
                </span>
                <span className="t-data text-[11px] text-ink-faint hidden sm:inline">#{room.room_token}</span>
              </div>
              <h1 className="font-serif text-lg sm:text-xl font-semibold text-ink tracking-tight mt-0.5">{room.trip_name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomLink}
              className={`text-xs px-3 py-1.5 rounded-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                copiedLink 
                  ? "bg-eucalypt-tint text-eucalypt border-eucalypt/40" 
                  : "bg-paper-card text-ink border-paper-rule hover:bg-paper-tint"
              }`}
            >
              {copiedLink ? <Check size={14} className="text-eucalypt" /> : <Share2 size={14} className="text-ink-muted" />}
              <span>{copiedLink ? "Link copied" : "Share room"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MEMBER BAR */}
      <div className="bg-paper-tint border-b border-paper-rule py-2 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-ink-muted">
            <Calendar size={13} className="text-eucalypt" />
            <span>Target dates: <strong className="text-ink font-semibold">{room.start_date} → {room.end_date}</strong></span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-ink-muted shrink-0 text-xs">Your name:</span>
            <input 
              type="text"
              value={voterName}
              onChange={(e) => handleSaveNickname(e.target.value)}
              placeholder="e.g. Jack, Sam..."
              className="bg-paper border border-paper-rule rounded-sm px-2.5 py-1 text-xs text-ink outline-none w-36 focus:border-eucalypt transition-colors"
            />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="max-w-6xl mx-auto px-4 pt-3 w-full">
        <div className="flex border-b border-paper-rule gap-1 overflow-x-auto">
          {[
            { id: "campsites", label: `Shortlist (${room.shortlist_campsites.length})`, icon: Star },
            { id: "gear", label: `Shared gear (${room.claimed_gear.length})`, icon: Package },
            { id: "tasks", label: `Prep tasks (${room.tasks.length})`, icon: CheckSquare },
            { id: "notes", label: `Group notes (${room.preferences.length})`, icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs transition-colors whitespace-nowrap cursor-pointer border-b-2 -mb-px ${
                  active 
                    ? "border-ink text-ink font-semibold bg-paper-tint/50" 
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-paper-tint/30"
                }`}
              >
                <Icon size={13} className={active ? "text-eucalypt" : "text-ink-faint"} />
                <span>{tab.label}</span>
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
                <h2 className="t-label font-semibold text-ink">Group shortlist candidates</h2>
                <p className="text-xs text-ink-muted">Vote on your preferred primary campsite and backup option.</p>
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
                    className="bg-paper-card border border-paper-rule rounded-sm p-4 flex flex-col justify-between shadow-xs hover:border-paper-rule-bold transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-serif text-base font-semibold text-ink leading-tight">{site.name}</h3>
                        <Badge tone="neutral">{site.state}</Badge>
                      </div>

                      <p className="text-xs text-ink-muted flex items-center gap-1 mb-3">
                        <MapPin size={12} className="text-eucalypt" />
                        <span>{site.management_type || "Public Reserve"}</span>
                      </p>

                      <div className="space-y-1.5 text-xs text-ink-muted mb-4 bg-paper-tint p-2.5 rounded-sm border border-paper-rule/60">
                        <div className="flex items-center justify-between">
                          <span className="text-ink-faint flex items-center gap-1"><Dog size={11} /> Dog policy:</span>
                          <span className="font-medium text-ink">
                            {site.dog_friendly === true ? "Allowed" : site.dog_friendly === false ? "No dogs" : "Unverified"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-faint">Rig access:</span>
                          <span className="font-medium text-ink truncate max-w-[140px]">
                            {site.rig_access.length ? site.rig_access.join(", ") : "Clearance not recorded"}
                          </span>
                        </div>
                      </div>

                      {/* VOTING SUMMARY BADGES */}
                      <div className="flex items-center gap-2 mb-4">
                        <Badge tone="warn" size="sm" className="flex items-center gap-1">
                          <Star size={10} />
                          <span>{primaryCount} Primary</span>
                        </Badge>
                        <Badge tone="info" size="sm" className="flex items-center gap-1">
                          <RefreshCw size={10} />
                          <span>{backupCount} Backup</span>
                        </Badge>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-paper-rule">
                      <button
                        onClick={() => handleVote(site.id, "primary")}
                        className={`py-1.5 px-2.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer border ${
                          myVote === "primary"
                            ? "bg-ochre-tint text-ochre border-ochre font-bold"
                            : "bg-paper text-ink border-paper-rule hover:bg-paper-tint"
                        }`}
                      >
                        <Star size={11} />
                        <span>{myVote === "primary" ? "Primary (Voted)" : "Vote primary"}</span>
                      </button>
                      <button
                        onClick={() => handleVote(site.id, "backup")}
                        className={`py-1.5 px-2.5 rounded-sm text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer border ${
                          myVote === "backup"
                            ? "bg-trust-official/15 text-trust-official border-trust-official font-bold"
                            : "bg-paper text-ink border-paper-rule hover:bg-paper-tint"
                        }`}
                      >
                        <RefreshCw size={11} />
                        <span>{myVote === "backup" ? "Backup (Voted)" : "Vote backup"}</span>
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
              <h2 className="t-label font-semibold text-ink">Shared equipment coordination</h2>
              <p className="text-xs text-ink-muted">Claim what group equipment you can bring so no one doubles up or forgets essentials.</p>
            </div>

            {/* ADD CUSTOM GEAR */}
            <div className="flex gap-2 mb-5">
              <input 
                type="text"
                value={newGearItem}
                onChange={(e) => setNewGearItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newGearItem && handleClaimGear(newGearItem, voterName || "Anonymous")}
                placeholder="Add gear item to bring (e.g. 2kW Generator, Marquee)..."
                className="bg-paper border border-paper-rule rounded-sm px-3 py-1.5 text-xs text-ink outline-none flex-1 focus:border-eucalypt"
              />
              <button
                onClick={() => newGearItem && handleClaimGear(newGearItem, voterName || "Anonymous")}
                disabled={!newGearItem.trim()}
                className="bg-eucalypt text-paper px-3.5 py-1.5 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 disabled:opacity-40 cursor-pointer"
              >
                + Add item
              </button>
            </div>

            {/* GEAR LIST */}
            <div className="space-y-1.5">
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
                    className="bg-paper-card border border-paper-rule rounded-sm p-2.5 flex items-center justify-between text-xs hover:border-paper-rule-bold transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Package size={14} className={claim ? "text-eucalypt" : "text-ink-faint"} />
                      <div>
                        <span className="font-medium text-ink block">{item}</span>
                        {claim ? (
                          <span className="text-[11px] text-eucalypt flex items-center gap-1 font-medium">
                            <Check size={10} /> Claimed by {claim.claimed_by}
                          </span>
                        ) : (
                          <span className="text-[11px] text-ink-faint">Unclaimed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {claim ? (
                        isClaimedByMe ? (
                          <button
                            onClick={() => handleClaimGear(item, "")}
                            className="bg-clay-tint hover:bg-clay/20 text-clay border border-clay/30 px-2.5 py-1 rounded-xs font-semibold text-[11px] cursor-pointer"
                          >
                            Unclaim
                          </button>
                        ) : (
                          <span className="bg-eucalypt-tint text-eucalypt border border-eucalypt/25 px-2 py-0.5 rounded-xs text-[11px] font-medium">
                            Taken
                          </span>
                        )
                      ) : (
                        <button
                          onClick={() => handleClaimGear(item, voterName || "Anonymous Camper")}
                          className="bg-paper-tint hover:bg-eucalypt hover:text-paper text-ink border border-paper-rule px-2.5 py-1 rounded-xs font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          I&apos;ll bring this
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
              <h2 className="t-label font-semibold text-ink">Pre-departure task checklist</h2>
              <p className="text-xs text-ink-muted">Keep the crew aligned on vehicle permits, ice runs, and fire restrictions.</p>
            </div>

            {/* ADD TASK */}
            <div className="flex gap-2 mb-5">
              <input 
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Add new task (e.g. Call NPWS for fire ban status)..."
                className="bg-paper border border-paper-rule rounded-sm px-3 py-1.5 text-xs text-ink outline-none flex-1 focus:border-eucalypt"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim()}
                className="bg-eucalypt text-paper px-3.5 py-1.5 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 disabled:opacity-40 cursor-pointer"
              >
                + Add task
              </button>
            </div>

            {/* TASKS LIST */}
            <div className="space-y-1.5">
              {room.tasks.map((task) => (
                <div 
                  key={task.id}
                  onClick={() => handleToggleTask(task.id, task.completed)}
                  className={`border rounded-sm p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                    task.completed 
                      ? "bg-paper-tint border-paper-rule/60 opacity-60 line-through" 
                      : "bg-paper-card border-paper-rule hover:border-paper-rule-bold"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {task.completed ? (
                      <CheckSquare size={14} className="text-eucalypt shrink-0" />
                    ) : (
                      <Square size={14} className="text-ink-faint shrink-0" />
                    )}
                    <span className="font-medium text-ink">{task.title}</span>
                  </div>

                  {task.assigned_to && (
                    <span className="t-micro text-ink-muted bg-paper-tint px-1.5 py-0.5 rounded-xs border border-paper-rule">
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
              <h2 className="t-label font-semibold text-ink">Group preferences & trip notes</h2>
              <p className="text-xs text-ink-muted">Share dietary needs, vehicle heights, or arrival windows.</p>
            </div>

            {/* ADD NOTE */}
            <div className="flex gap-2 mb-5">
              <input 
                type="text"
                value={newPrefText}
                onChange={(e) => setNewPrefText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPreference()}
                placeholder="Share note (e.g. Arriving Friday ~8pm, bringing dog leash stake)..."
                className="bg-paper border border-paper-rule rounded-sm px-3 py-1.5 text-xs text-ink outline-none flex-1 focus:border-eucalypt"
              />
              <button
                onClick={handleAddPreference}
                disabled={!newPrefText.trim()}
                className="bg-eucalypt text-paper px-3.5 py-1.5 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 disabled:opacity-40 cursor-pointer"
              >
                + Post note
              </button>
            </div>

            {/* NOTES LIST */}
            <div className="space-y-2">
              {room.preferences.length === 0 ? (
                <div className="text-center py-8 text-ink-muted text-xs">
                  No notes yet. Post arrival details or equipment preferences above.
                </div>
              ) : (
                room.preferences.map((p, idx) => (
                  <div key={idx} className="bg-paper-card border border-paper-rule rounded-sm p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <strong className="text-eucalypt font-semibold">{p.member_name}</strong>
                      <span className="t-micro text-ink-faint">Member note</span>
                    </div>
                    <p className="text-ink">{p.preference}</p>
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

export default function TripRoomPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-ink p-6">
        <div className="w-8 h-8 border-2 border-eucalypt border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-ink-muted text-xs">Loading trip room…</p>
      </div>
    }>
      <TripRoomContent params={params} />
    </React.Suspense>
  );
}
