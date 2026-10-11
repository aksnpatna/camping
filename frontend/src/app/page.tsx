"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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

  // Routing State
  const [startLocation, setStartLocation] = useState({ longitude: 151.2093, latitude: -33.8688 }); // Default to Sydney CBD
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.Geometry | GeoJSON.Feature | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

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
              <h2 className="text-xl font-bold text-neon-green">My Saved Trips</h2>
              <button onClick={() => setShowDashboard(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="flex flex-col gap-2 mb-6">
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={dashEmail}
                onChange={e => setDashEmail(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-neon-green"
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Access Token (from email)" 
                  value={dashToken}
                  onChange={e => setDashToken(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-neon-green"
                />
                <button 
                  onClick={async () => {
                    if (!dashEmail || !dashToken) {
                      setDashError("Email and token required");
                      return;
                    }
                    setLoadingTrips(true);
                    setDashError("");
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
                  className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#00e67a]"
                >
                  Load
                </button>
              </div>
              {dashError && <div className="text-red-400 text-xs text-center mt-1">{dashError}</div>}
            </div>

            {loadingTrips ? (
              <div className="text-center text-sm text-gray-400 py-4 animate-pulse">Loading your trips...</div>
            ) : myTrips ? (
              myTrips.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-4">No trips found for this email.</div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {myTrips.map(trip => (
                    <div key={trip.id} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-white">{trip.campsite_name}</h3>
                        <a href={`/pack/${trip.campsite_id}`} target="_blank" rel="noreferrer" className="text-xs bg-neon-green/20 text-neon-green px-2 py-1 rounded hover:bg-neon-green hover:text-black transition-colors">Offline Pack</a>
                      </div>
                      <div className="text-xs text-gray-400 mb-3">
                        {trip.start_date} to {trip.end_date}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {trip.plan_b_active ? (
                            <span className="text-neon-green flex items-center gap-1 font-semibold">🟢 Plan B Monitor Active</span>
                          ) : (
                            <span className="text-gray-500">⚪ Monitor Inactive</span>
                          )}
                          {trip.is_shortlist && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-bold">
                              Shortlist Candidate
                            </span>
                          )}
                        </div>
                      </div>

                      {/* PLAN B ALERT BANNER WITH ALTERNATIVES */}
                      {trip.alerts && trip.alerts.length > 0 && (
                        <div className="mt-3 bg-red-950/60 border border-red-500/50 p-3 rounded-xl text-xs space-y-2">
                          <div className="flex items-center gap-1.5 text-red-300 font-bold">
                            <span className="animate-pulse">🚨</span>
                            <span>{trip.alerts[0].details}</span>
                          </div>
                          {trip.alerts[0].suggested_alternatives && trip.alerts[0].suggested_alternatives.length > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-red-500/20">
                              <span className="text-[11px] text-gray-300 font-bold block">
                                Recommended Plan B Alternatives:
                              </span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {trip.alerts[0].suggested_alternatives.map((alt) => (
                                  <div key={alt.id} className="bg-black/50 p-2.5 rounded-lg border border-white/10 flex items-start justify-between gap-2">
                                    <div>
                                      <div className="font-bold text-white text-[11px]">{alt.name} ({alt.state})</div>
                                      <div className="text-[10px] text-gray-400 mt-0.5">{alt.reason}</div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const s = campsites.find(c => c.id === alt.id);
                                        if (s) {
                                          setSelectedSite(s);
                                          setShowDashboard(false);
                                          setViewMode("map");
                                        }
                                      }}
                                      className="text-[10px] bg-white/10 hover:bg-white/20 text-[var(--color-neon-green)] px-2.5 py-1 rounded font-bold shrink-0 cursor-pointer"
                                    >
                                      View Site →
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center text-sm text-gray-500 py-4">Enter your email to view your planned trips and active Plan B weather alerts.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
