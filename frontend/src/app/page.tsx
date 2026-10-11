"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Campsite } from '@/components/Map';
const CampingMap = dynamic(() => import('@/components/Map'), { ssr: false });
import TripCard from '@/components/TripCard';
import SearchFilter, { FilterParams } from '@/components/SearchFilter';
import FindWeekendPlanner from '@/components/FindWeekendPlanner';
import { getApiUrl } from '@/config';

interface PlanBAlertAlternative {
  id: number;
  name: string;
  state: string;
  management_type: string;
  dog_friendly: boolean | null;
  reason: string;
}

interface PlanBAlertItem {
  id: number;
  alert_type: string;
  details: string;
  triggered_at: string;
  delivery_status: string;
  suggested_alternatives: PlanBAlertAlternative[];
}

interface SavedTripDashboard {
  id: number;
  campsite_id: number;
  campsite_name: string;
  state: string;
  start_date: string;
  end_date: string;
  plan_b_active: boolean;
  is_shortlist?: boolean;
  room_token?: string | null;
  alerts?: PlanBAlertItem[];
}

export default function Home() {
  const [viewMode, setViewMode] = useState<"planner" | "map">("planner");
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [selectedSite, setSelectedSite] = useState<Campsite | null>(null);
  const [filters, setFilters] = useState<FilterParams>({ dog_friendly: null, rig_access: null });

  // Dashboard State
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashEmail, setDashEmail] = useState("");
  const [dashToken, setDashToken] = useState("");
  const [myTrips, setMyTrips] = useState<SavedTripDashboard[] | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [dashError, setDashError] = useState("");
  const [requestingMagicLink, setRequestingMagicLink] = useState(false);
  const [magicLinkFeedback, setMagicLinkFeedback] = useState("");

  // Routing State
  const [startLocation, setStartLocation] = useState({ longitude: 151.2093, latitude: -33.8688 }); // Default to Sydney CBD
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.Geometry | GeoJSON.Feature | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  // Plan B Action States
  const [switchingTripId, setSwitchingTripId] = useState<number | null>(null);
  const [simulatingTripId, setSimulatingTripId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      if (roomParam) {
        router.replace(`/trip/${roomParam}`);
        return;
      }
      const emailParam = params.get("email");
      const tokenParam = params.get("token");
      if (emailParam && tokenParam) {
        setTimeout(async () => {
          setDashEmail(emailParam);
          setDashToken(tokenParam);
          setShowDashboard(true);
          setLoadingTrips(true);
          setDashError("");
          try {
            const res = await fetch(`${getApiUrl()}/saved-trips/dashboard/${encodeURIComponent(emailParam)}?token=${encodeURIComponent(tokenParam)}`);
            if (res.ok) {
              setMyTrips(await res.json());
            } else {
              setDashError("Invalid magic token or expired session");
            }
          } catch {
            setDashError("Network error loading trips.");
          } finally {
            setLoadingTrips(false);
          }
        }, 0);
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setStartLocation({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude
        });
      }, (error) => {
        console.warn("Geolocation denied or unavailable, defaulting to Sydney.", error);
      });
    }
  }, []);

  useEffect(() => {
    if (!selectedSite) {
      return;
    }
    let isCancelled = false;
    // Fetch OSRM route
    fetch(`https://router.project-osrm.org/route/v1/driving/${startLocation.longitude},${startLocation.latitude};${selectedSite.longitude},${selectedSite.latitude}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        if (!isCancelled && data.routes && data.routes.length > 0) {
          setRouteGeoJson(data.routes[0].geometry);
          setRouteDistance(data.routes[0].distance);
        }
      })
      .catch(err => console.error("OSRM Routing Error:", err));

    return () => {
      isCancelled = true;
    };
  }, [selectedSite, startLocation]);

  useEffect(() => {
    // Fetch canonical campsites from our FastAPI backend
    const fetchCampsites = async () => {
      try {
        const apiUrl = getApiUrl();
        const params = new URLSearchParams();
        if (filters.state) {
          params.append('state', filters.state);
        }
        if (filters.dog_friendly !== null) {
          params.append('dog_friendly', filters.dog_friendly.toString());
        }
        if (filters.rig_access !== null) {
          params.append('rig_access', filters.rig_access);
        }

        const res = await fetch(`${apiUrl}/campsites?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          console.log("FETCHED CAMPSITES COUNT:", data.length);
          setCampsites(data);
        } else {
          console.error("Backend returned error:", res.status);
        }
      } catch (err) {
        console.error("Failed to fetch campsites from API. Is the backend running?", err);
      }
    };
    
    fetchCampsites();
  }, [filters]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[var(--color-forest-900)] flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="w-full bg-black/60 border-b border-white/10 px-4 md:px-6 py-3.5 flex items-center justify-between z-30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setViewMode("planner")} 
            className="text-xl md:text-2xl font-black text-white tracking-tighter flex items-center gap-1.5 cursor-pointer text-left"
          >
            <span>CAMP SMART</span>
            <span className="text-[var(--color-neon-green)]">AU</span>
          </button>
          <span className="hidden lg:inline-block text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
            Condition-Aware Trip Engine
          </span>
        </div>

        {/* VIEW MODE TOGGLE */}
        <div className="bg-white/10 border border-white/15 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setViewMode("planner")}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "planner"
                ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow-md"
                : "text-gray-300 hover:text-white"
            }`}
          >
            🎯 3 Best Trips
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "map"
                ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] shadow-md"
                : "text-gray-300 hover:text-white"
            }`}
          >
            🗺️ Interactive Map
          </button>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDashboard(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/10 px-3.5 py-1.5 rounded-xl font-bold text-white text-xs md:text-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            ⛺ My Trips
          </button>
          <Link
            href="/explore/nsw"
            className="hidden sm:inline-flex bg-white/5 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-xl font-semibold text-gray-300 text-xs transition-all"
          >
            Fire Rules
          </Link>
        </div>
      </header>

      {/* MAIN VIEW CONTAINER */}
      <div className="relative flex-1 w-full h-[calc(100vh-61px)] overflow-hidden">
        {viewMode === "planner" ? (
          <div className="w-full h-full overflow-y-auto">
            <FindWeekendPlanner 
              startLocation={startLocation}
              onSelectSiteOnMap={(campsiteId) => {
                const s = campsites.find(c => c.id === campsiteId);
                if (s) {
                  setSelectedSite(s);
                  setViewMode("map");
                }
              }}
              onOpenSaveModal={(campsiteId) => {
                const s = campsites.find(c => c.id === campsiteId);
                if (s) {
                  setSelectedSite(s);
                }
              }}
            />
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Dynamic Map Component */}
            <CampingMap 
              campsites={campsites} 
              onSelectCampsite={setSelectedSite}
              routeGeoJson={routeGeoJson}
              startLocation={startLocation}
              selectedState={filters.state}
            />

            {/* Filter Panel */}
            <div className="absolute top-4 right-4 left-4 md:left-auto md:w-80 z-10 pointer-events-auto">
              <SearchFilter onFilterChange={(newFilters) => setFilters(newFilters)} />
            </div>
          </div>
        )}

        {/* Answer-First Overlay (Active when a site is selected) */}
        {selectedSite && (
          <TripCard 
            key={selectedSite.id}
            campsite={selectedSite} 
            onClose={() => {
              setSelectedSite(null);
              setRouteGeoJson(null);
              setRouteDistance(null);
            }}
            routeDistance={routeDistance}
          />
        )}
      </div>

      {/* My Trips Dashboard Modal */}
      {showDashboard && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-[var(--color-neon-green)] flex items-center gap-2">
                  <span>My Saved Trips & Condition Monitor</span>
                </h2>
                <p className="text-xs text-gray-400">Track weather shifts, group shortlists, and 1-click Plan B backups</p>
              </div>
              <button onClick={() => setShowDashboard(false)} className="text-gray-400 hover:text-white p-2">✕</button>
            </div>
            
            <div className="flex flex-col gap-2.5 mb-6">
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  value={dashEmail}
                  onChange={e => {
                    setDashEmail(e.target.value);
                    setDashError("");
                    setMagicLinkFeedback("");
                  }}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-neon-green"
                />
                <button
                  type="button"
                  disabled={requestingMagicLink || !dashEmail}
                  onClick={async () => {
                    if (!dashEmail) {
                      setDashError("Please enter your email first");
                      return;
                    }
                    setRequestingMagicLink(true);
                    setDashError("");
                    setMagicLinkFeedback("");
                    try {
                      const res = await fetch(`${getApiUrl()}/auth/request-magic-link`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: dashEmail })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setMagicLinkFeedback("✨ Magic sign-in link dispatched! Auto-filling session token...");
                        if (data.token) {
                          setDashToken(data.token);
                          // Auto load trips immediately
                          setLoadingTrips(true);
                          const dashRes = await fetch(`${getApiUrl()}/saved-trips/dashboard/${encodeURIComponent(dashEmail)}?token=${encodeURIComponent(data.token)}`);
                          if (dashRes.ok) {
                            setMyTrips(await dashRes.json());
                          }
                          setLoadingTrips(false);
                        }
                      } else {
                        setDashError("Failed to dispatch magic link. Please check email address.");
                      }
                    } catch {
                      setDashError("Network error requesting magic link.");
                    } finally {
                      setRequestingMagicLink(false);
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-lg font-bold text-xs text-white transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {requestingMagicLink ? "Sending..." : "Send Magic Link 📧"}
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Access Token (from email)" 
                  value={dashToken}
                  onChange={e => setDashToken(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-neon-green font-mono text-xs"
                />
                <button 
                  onClick={async () => {
                    if (!dashEmail || !dashToken) {
                      setDashError("Email and token required");
                      return;
                    }
                    setLoadingTrips(true);
                    setDashError("");
                    setActionMessage("");
                    try {
                      const res = await fetch(`${getApiUrl()}/saved-trips/dashboard/${encodeURIComponent(dashEmail)}?token=${encodeURIComponent(dashToken)}`);
                      if (res.ok) {
                        setMyTrips(await res.json());
                      } else {
                        setDashError("Invalid token or email");
                      }
                    } catch {
                      setDashError("Network error. Please try again.");
                    }
                    setLoadingTrips(false);
                  }}
                  className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#00e67a] cursor-pointer shrink-0"
                >
                  Load
                </button>
              </div>
              {magicLinkFeedback && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-2 rounded-lg text-center font-medium">
                  {magicLinkFeedback}
                </div>
              )}
              {dashError && <div className="text-red-400 text-xs text-center mt-1">{dashError}</div>}
              {actionMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-2.5 rounded-lg text-center font-bold">
                  {actionMessage}
                </div>
              )}
            </div>

            {loadingTrips ? (
              <div className="text-center text-sm text-gray-400 py-6 animate-pulse">Loading your trips and condition monitors...</div>
            ) : myTrips ? (
              myTrips.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-6">No trips found for this email.</div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {myTrips.map(trip => (
                    <div key={trip.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <h3 className="font-bold text-white text-base">{trip.campsite_name}</h3>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {trip.state} • {trip.start_date} to {trip.end_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {trip.room_token && (
                              <Link 
                                href={`/trip/${trip.room_token}`}
                                target="_blank"
                                className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold hover:bg-emerald-500/30 transition-all flex items-center gap-1"
                              >
                                Room ↗
                              </Link>
                            )}
                            <a 
                              href={`/pack/${trip.campsite_id}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs bg-white/10 text-gray-200 border border-white/15 px-2.5 py-1 rounded-lg font-bold hover:bg-white/20 transition-all"
                            >
                              Pack List
                            </a>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-y border-white/5 my-2">
                          <div className="flex items-center gap-2">
                            {trip.plan_b_active ? (
                              <span className="text-[var(--color-neon-green)] flex items-center gap-1 font-bold">
                                🟢 Plan B Active
                              </span>
                            ) : (
                              <span className="text-gray-500">⚪ Monitor Inactive</span>
                            )}
                            {trip.is_shortlist && (
                              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-bold">
                                Shortlist
                              </span>
                            )}
                          </div>

                          {/* SIMULATE ALERT BUTTON */}
                          <button
                            onClick={async () => {
                              if (!dashToken) return;
                              setSimulatingTripId(trip.id);
                              setActionMessage("");
                              try {
                                const res = await fetch(`${getApiUrl()}/saved-trips/${trip.id}/simulate-alert?token=${encodeURIComponent(dashToken)}`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    alert_type: "WEATHER_WARNING",
                                    reason: "Severe gale warning & heavy downpour (90% rain, 70km/h wind gusts)"
                                  })
                                });
                                if (res.ok) {
                                  // Refresh dashboard
                                  const dRes = await fetch(`${getApiUrl()}/saved-trips/dashboard/${encodeURIComponent(dashEmail)}?token=${encodeURIComponent(dashToken)}`);
                                  if (dRes.ok) setMyTrips(await dRes.json());
                                  setActionMessage("🚨 Weather shift simulated! Plan B alternatives generated.");
                                }
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setSimulatingTripId(null);
                              }
                            }}
                            disabled={simulatingTripId === trip.id}
                            className="text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Simulate severe condition shift to test Plan B alternatives"
                          >
                            <span>⚡ {simulatingTripId === trip.id ? "Simulating..." : "Test Condition Shift"}</span>
                          </button>
                        </div>

                        {/* PLAN B ALERT BANNER WITH 1-CLICK ALTERNATIVE SWITCHING */}
                        {trip.alerts && trip.alerts.length > 0 && (
                          <div className="mt-3 bg-red-950/70 border border-red-500/40 p-3.5 rounded-xl text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-red-300 font-bold">
                              <span className="animate-pulse text-base">🚨</span>
                              <span>{trip.alerts[0].details}</span>
                            </div>

                            {trip.alerts[0].suggested_alternatives && trip.alerts[0].suggested_alternatives.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-red-500/20">
                                <span className="text-[11px] text-gray-300 font-bold block uppercase tracking-wider">
                                  Safe Alternative Campsites:
                                </span>
                                <div className="grid grid-cols-1 gap-2">
                                  {trip.alerts[0].suggested_alternatives.map((alt) => (
                                    <div key={alt.id} className="bg-black/60 p-3 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                      <div>
                                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                          <span>{alt.name}</span>
                                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 uppercase font-mono">{alt.state}</span>
                                        </div>
                                        <div className="text-[11px] text-gray-300 mt-0.5">{alt.reason}</div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                        <button
                                          onClick={() => {
                                            const s = campsites.find(c => c.id === alt.id);
                                            if (s) {
                                              setSelectedSite(s);
                                              setShowDashboard(false);
                                              setViewMode("map");
                                            }
                                          }}
                                          className="text-[11px] bg-white/10 hover:bg-white/20 text-gray-300 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
                                        >
                                          Map
                                        </button>

                                        {/* 1-CLICK CAMPSITE SWITCHER */}
                                        <button
                                          onClick={async () => {
                                            if (!dashToken) return;
                                            setSwitchingTripId(trip.id);
                                            setActionMessage("");
                                            try {
                                              const res = await fetch(`${getApiUrl()}/saved-trips/${trip.id}/switch-campsite?token=${encodeURIComponent(dashToken)}`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ new_campsite_id: alt.id })
                                              });
                                              if (res.ok) {
                                                const dRes = await fetch(`${getApiUrl()}/saved-trips/dashboard/${encodeURIComponent(dashEmail)}?token=${encodeURIComponent(dashToken)}`);
                                                if (dRes.ok) setMyTrips(await dRes.json());
                                                setActionMessage(`✓ Successfully switched trip to ${alt.name}!`);
                                              }
                                            } catch (e) {
                                              console.error(e);
                                            } finally {
                                              setSwitchingTripId(null);
                                            }
                                          }}
                                          disabled={switchingTripId === trip.id}
                                          className="flex-1 sm:flex-none text-[11px] bg-[var(--color-neon-green)] text-[var(--color-forest-900)] hover:bg-[#00e67a] px-3 py-1.5 rounded-lg font-black transition-all cursor-pointer disabled:opacity-50"
                                        >
                                          {switchingTripId === trip.id ? "Switching..." : "⚡ Switch Here"}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center text-sm text-gray-500 py-6">Enter your email and token to view your planned trips, test Plan B shifts, and switch campgrounds.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
