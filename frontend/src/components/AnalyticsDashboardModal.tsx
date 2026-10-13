"use client";

import React, { useState, useEffect } from "react";
import { X, Activity, Users, Globe, Mail, Copy, Check, RefreshCw, Compass } from "lucide-react";
import { getApiUrl } from "@/config";

interface AnalyticsSummary {
  total_events: number;
  unique_ips: number;
  unique_sessions: number;
  total_leads: number;
  top_pages: { path: string; hits: number }[];
  recent_events: {
    id: number;
    event_type: string;
    path: string;
    ip_address?: string;
    user_email?: string;
    created_at: string;
  }[];
  recent_leads: {
    id: number;
    email: string;
    source: string;
    status: string;
    trips_count: number;
    first_ip?: string;
    last_active_at: string;
    created_at: string;
    meta_data?: Record<string, unknown>;
  }[];
}

export default function AnalyticsDashboardModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "traffic">("leads");
  const [copied, setCopied] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/analytics/summary`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch analytics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    fetch(`${getApiUrl()}/analytics/summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json) setData(json);
      })
      .catch((e) => console.error("Failed to fetch analytics", e));

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyEmails = () => {
    if (!data?.recent_leads) return;
    const emailList = data.recent_leads.map((l) => l.email).join("\n");
    navigator.clipboard.writeText(emailList);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0b1b14] border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--color-neon-green)]/10 text-[var(--color-neon-green)] rounded-xl border border-[var(--color-neon-green)]/30">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
                <span>Audience Telemetry & Lead Captures</span>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-[var(--color-neon-green)] px-2 py-0.5 rounded-full border border-emerald-500/30">
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Visitor IP tracking, page engagement & camper emails for future communications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-emerald-400" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* METRICS HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-black/20 border-b border-white/10">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5 mb-1">
              <Compass size={13} className="text-cyan-400" /> Total Hits
            </div>
            <div className="text-xl font-black text-white">
              {data?.total_events ?? (loading ? "..." : 0)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5 mb-1">
              <Globe size={13} className="text-emerald-400" /> Unique IPs
            </div>
            <div className="text-xl font-black text-white">
              {data?.unique_ips ?? (loading ? "..." : 0)}
            </div>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5 mb-1">
              <Users size={13} className="text-amber-400" /> Active Sessions
            </div>
            <div className="text-xl font-black text-white">
              {data?.unique_sessions ?? (loading ? "..." : 0)}
            </div>
          </div>

          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/40">
            <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
              <Mail size={13} className="text-[var(--color-neon-green)]" /> Captured Leads
            </div>
            <div className="text-xl font-black text-[var(--color-neon-green)]">
              {data?.total_leads ?? (loading ? "..." : 0)}
            </div>
          </div>
        </div>

        {/* TABS HEADER */}
        <div className="flex border-b border-white/10 bg-black/30 px-4">
          <button
            onClick={() => setActiveTab("leads")}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "leads"
                ? "border-[var(--color-neon-green)] text-[var(--color-neon-green)] bg-white/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Mail size={14} /> Captured Camper Emails ({data?.total_leads || 0})
          </button>
          <button
            onClick={() => setActiveTab("traffic")}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "traffic"
                ? "border-[var(--color-neon-green)] text-[var(--color-neon-green)] bg-white/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Activity size={14} /> Page Hits & Visitor IPs
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "leads" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Targeted Leads for Marketing & Trip Advisories
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Captured from Plan B condition alerts, shortlist saves & pack downloads
                  </p>
                </div>
                {data?.recent_leads && data.recent_leads.length > 0 && (
                  <button
                    onClick={handleCopyEmails}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={13} className="text-gray-300" /> Export CSV / Copy All
                      </>
                    )}
                  </button>
                )}
              </div>

              {data?.recent_leads && data.recent_leads.length > 0 ? (
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-400 text-[11px] uppercase tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Camper Email</th>
                        <th className="py-2.5 px-3">Lead Source</th>
                        <th className="py-2.5 px-3">Trips Count</th>
                        <th className="py-2.5 px-3">Visitor IP</th>
                        <th className="py-2.5 px-3">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-sans">
                      {data.recent_leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            {lead.email}
                          </td>
                          <td className="py-2.5 px-3 text-gray-300 font-mono text-[11px]">
                            <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold">
                              {lead.source}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-emerald-300 font-bold">
                            {lead.trips_count} {lead.trips_count === 1 ? "trip" : "trips"}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">
                            {lead.first_ip || "Internal/Local"}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 text-[11px]">
                            {new Date(lead.last_active_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No camper emails captured yet. Once users click &quot;Save &amp; Monitor&quot; or save a trip, their emails will appear here automatically.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* TOP HIT PAGES */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Top Visited Pages & Campgrounds
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data?.top_pages?.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-black/40 border border-white/10 p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-gray-200 truncate pr-2">{p.path}</span>
                      <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[11px] shrink-0 font-mono">
                        {p.hits} hits
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECENT TRAFFIC STREAM */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Live Event Stream
                </h3>
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-gray-400 text-[11px] uppercase tracking-wider font-mono">
                      <tr>
                        <th className="py-2 px-3">Event</th>
                        <th className="py-2 px-3">Path</th>
                        <th className="py-2 px-3">Visitor IP</th>
                        <th className="py-2 px-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                      {data?.recent_events?.map((ev) => (
                        <tr key={ev.id} className="hover:bg-white/5">
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 uppercase">
                              {ev.event_type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-200 truncate max-w-[200px]">
                            {ev.path}
                          </td>
                          <td className="py-2 px-3 text-gray-400">
                            {ev.ip_address || "Localhost"}
                          </td>
                          <td className="py-2 px-3 text-gray-400 font-sans text-xs">
                            {new Date(ev.created_at).toLocaleTimeString("en-AU", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-neon-green)] animate-ping" />
            Zero-third-party tracker footprint (Stored strictly in Camp Smart PostgreSQL)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
