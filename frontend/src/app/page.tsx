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
import BetaFeedbackModal from '@/components/BetaFeedbackModal';
import { getApiUrl } from '@/config';
import { Compass, Map, Bookmark, MessageSquarePlus } from "lucide-react";

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

export interface UserLocation {
  longitude: number;
  latitude: number;
  city?: string;
  state?: string;
  isDetected?: boolean;
  source?: "gps" | "ip" | "default";
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [myTrips, setMyTrips] = useState<SavedTripDashboard[] | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [dashError, setDashError] = useState("");
  const [requestingMagicLink, setRequestingMagicLink] = useState(false);
  const [magicLinkFeedback, setMagicLinkFeedback] = useState("");

  // Routing & Geolocation State
  const [startLocation, setStartLocation] = useState<UserLocation>({
    longitude: 151.2093,
    latitude: -33.8688,
    city: "Sydney",
    state: "NSW",
    isDetected: false,
    source: "default"
  });
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
    if (typeof window === "undefined") return;

    let isMounted = true;

    const AU_CITIES = [
      { city: "Sydney", state: "NSW", lat: -33.8688, lng: 151.2093 },
      { city: "Melbourne", state: "VIC", lat: -37.8136, lng: 144.9631 },
      { city: "Brisbane", state: "QLD", lat: -27.4698, lng: 153.0251 },
      { city: "Perth", state: "WA", lat: -31.9505, lng: 115.8605 },
      { city: "Adelaide", state: "SA", lat: -34.9285, lng: 138.6007 },
      { city: "Hobart", state: "TAS", lat: -42.8821, lng: 147.3272 },
      { city: "Darwin", state: "NT", lat: -12.4634, lng: 130.8456 },
      { city: "Canberra", state: "ACT", lat: -35.2809, lng: 149.1300 },
      { city: "Gold Coast", state: "QLD", lat: -28.0167, lng: 153.4000 },
      { city: "Newcastle", state: "NSW", lat: -32.9283, lng: 151.7817 },
      { city: "Wollongong", state: "NSW", lat: -34.4278, lng: 150.8931 },
      { city: "Geelong", state: "VIC", lat: -38.1499, lng: 144.3617 },
      { city: "Cairns", state: "QLD", lat: -16.9186, lng: 145.7781 },
    ];

    const resolveNearestCity = (lat: number, lng: number) => {
      let nearest = AU_CITIES[0];
      let minDist = Infinity;
      for (const c of AU_CITIES) {
        const d = Math.hypot(lat - c.lat, lng - c.lng);
        if (d < minDist) {
          minDist = d;
          nearest = c;
        }
      }
      return nearest;
    };

    // 1. IP Geolocation (Fast, non-blocking default)
    const fetchIpLocation = async () => {
      try {
        const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
          const data = await res.json();
          if (data.success && isMounted) {
            setStartLocation(prev => {
              if (prev.source === "gps") return prev;
              return {
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                city: data.city || "Sydney",
                state: data.region_code || "NSW",
                isDetected: true,
                source: "ip"
              };
            });
          }
        }
      } catch {
        // Fallback gracefully
      }
    };

    fetchIpLocation();

    // 2. High-accuracy Browser GPS (if permission granted by user)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const nearest = resolveNearestCity(lat, lng);
          setStartLocation({
            latitude: lat,
            longitude: lng,
            city: nearest.city,
            state: nearest.state,
            isDetected: true,
            source: "gps"
          });
        },
        (error) => {
          console.warn("Geolocation permission not granted or unavailable; using IP/default.", error.message);
        },
        { timeout: 6000, maximumAge: 300000, enableHighAccuracy: false }
      );
    }

    return () => {
      isMounted = false;
    };
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
    <main className="relative w-screen h-screen overflow-hidden bg-[#F6F1E7] text-[#1E2A24] flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="w-full bg-[#FFFFFF] border-b border-[#E2DAC8] px-4 md:px-6 py-3 flex items-center justify-between z-30 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setViewMode("planner");
              setSelectedSite(null);
              setRouteGeoJson(null);
              setRouteDistance(null);
            }} 
            className="text-xl md:text-2xl font-black text-[#1E2A24] tracking-tight flex items-center gap-1.5 cursor-pointer text-left"
          >
            <span>CAMP SMART</span>
            <span className="text-[#2F5D50] bg-[#EBF2EE] border border-[#2F5D50]/20 text-xs px-2 py-0.5 rounded-md font-black tracking-widest uppercase">AU</span>
          </button>
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] bg-[#FAF6EF] text-[#536259] border border-[#E2DAC8] px-2.5 py-1 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2F5D50]"></span>
            Field Guide • Condition-Aware Trip Engine
          </span>
        </div>

        {/* VIEW MODE TOGGLE */}
        <div className="bg-[#EFE9DD] border border-[#E2DAC8] p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => {
              setViewMode("planner");
              setSelectedSite(null);
              setRouteGeoJson(null);
              setRouteDistance(null);
            }}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "planner"
                ? "bg-[#2F5D50] text-white shadow-xs"
                : "text-[#536259] hover:text-[#1E2A24]"
            }`}
          >
            <Compass size={14} className={viewMode === "planner" ? "text-[#C9822B]" : ""} /> 
            <span>3 Best Trips</span>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "map"
                ? "bg-[#2F5D50] text-white shadow-xs"
                : "text-[#536259] hover:text-[#1E2A24]"
            }`}
          >
            <Map size={14} className={viewMode === "map" ? "text-[#C9822B]" : ""} /> 
            <span>Interactive Map</span>
          </button>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDashboard(true)}
            className="bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] px-3.5 py-1.5 rounded-xl font-bold text-[#1E2A24] text-xs md:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Bookmark size={14} className="text-[#2F5D50]" /> 
            <span>My Trips</span>
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            className="bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] px-3 py-1.5 rounded-xl font-bold text-[#1E2A24] text-xs md:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Share beta feedback or report an issue"
          >
            <MessageSquarePlus size={14} className="text-[#C9822B]" />
            <span className="hidden sm:inline">Feedback</span>
          </button>
          <Link
            href="/explore/nsw"
            className="hidden sm:inline-flex bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] px-3 py-1.5 rounded-xl font-semibold text-[#536259] text-xs transition-all shadow-xs"
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
              onUpdateStartLocation={(loc) => setStartLocation(loc)}
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
                  setViewMode("map");
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
              selectedCampsite={selectedSite}
            />

            {/* Filter Panel */}
            <div className="absolute top-4 right-4 left-4 md:left-auto md:w-80 z-10 pointer-events-auto">
              <SearchFilter onFilterChange={(newFilters) => setFilters(newFilters)} />
            </div>
          </div>
        )}

        {/* Answer-First Overlay (Active only when a site is selected in Map view) */}
        {selectedSite && viewMode === "map" && (
          <TripCard 
            key={selectedSite.id}
            campsite={selectedSite} 
            onClose={() => {
              setSelectedSite(null);
              setRouteGeoJson(null);
              setRouteDistance(null);
            }}
            routeDistance={routeDistance}
            startLocation={startLocation}
          />
        )}
      </div>

      {/* My Trips Dashboard Modal */}
      {showDashboard && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E2DAC8] p-6 rounded-2xl w-full max-w-lg text-[#1E2A24] shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-[#1E2A24] flex items-center gap-2">
                  <Bookmark className="text-[#2F5D50]" size={20} />
                  <span>My Saved Trips & Condition Monitor</span>
                </h2>
                <p className="text-xs text-[#536259]">Track weather shifts, group shortlists, and 1-click Plan B backups</p>
              </div>
              <button onClick={() => setShowDashboard(false)} className="text-[#536259] hover:text-[#1E2A24] p-2 text-lg">✕</button>
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
                  className="flex-1 bg-[#FAF6EF] border border-[#E2DAC8] rounded-lg px-3 py-2 text-sm text-[#1E2A24] outline-none focus:border-[#2F5D50]"
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
                  className="bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] px-3 py-2 rounded-lg font-bold text-xs text-[#1E2A24] transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-xs"
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
                  className="flex-1 bg-[#FAF6EF] border border-[#E2DAC8] rounded-lg px-3 py-2 text-sm text-[#1E2A24] outline-none focus:border-[#2F5D50] font-mono text-xs"
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
                  className="bg-[#2F5D50] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#24493F] cursor-pointer shrink-0 shadow-xs"
                >
                  Load
                </button>
              </div>
              {magicLinkFeedback && (
                <div className="bg-[#EBF2EE] border border-[#2F5D50]/30 text-[#2F5D50] text-xs p-2 rounded-lg text-center font-medium">
                  {magicLinkFeedback}
                </div>
              )}
              {dashError && <div className="text-[#B3261E] text-xs text-center mt-1">{dashError}</div>}
              {actionMessage && (
                <div className="bg-[#EBF2EE] border border-[#2F5D50]/30 text-[#2F5D50] text-xs p-2.5 rounded-lg text-center font-bold">
                  {actionMessage}
                </div>
              )}
            </div>

            {loadingTrips ? (
              <div className="text-center text-sm text-[#536259] py-6 animate-pulse">Loading your trips and condition monitors...</div>
            ) : myTrips ? (
              myTrips.length === 0 ? (
                <div className="text-center text-sm text-[#536259] py-6">No trips found for this email.</div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {myTrips.map(trip => (
                    <div key={trip.id} className="bg-[#FAF6EF] border border-[#E2DAC8] p-4 rounded-xl flex flex-col justify-between shadow-xs">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <h3 className="font-bold text-[#1E2A24] text-base">{trip.campsite_name}</h3>
                            <div className="text-xs text-[#536259] mt-0.5">
                              {trip.state} • {trip.start_date} to {trip.end_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {trip.room_token && (
                              <Link 
                                href={`/trip/${trip.room_token}`}
                                target="_blank"
                                className="text-xs bg-[#EBF2EE] text-[#2F5D50] border border-[#2F5D50]/30 px-2.5 py-1 rounded-lg font-bold hover:bg-[#DFEBE5] transition-all flex items-center gap-1"
                              >
                                Room ↗
                              </Link>
                            )}
                            <a 
                              href={`/pack/${trip.campsite_id}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs bg-[#FFFFFF] text-[#1E2A24] border border-[#E2DAC8] px-2.5 py-1 rounded-lg font-bold hover:bg-[#FAF6EF] transition-all shadow-xs"
                            >
                              Pack List
                            </a>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-y border-[#E2DAC8]/60 my-2">
                          <div className="flex items-center gap-2">
                            {trip.plan_b_active ? (
                              <span className="text-[#2E7D32] flex items-center gap-1 font-bold">
                                🟢 Plan B Active
                              </span>
                            ) : (
                              <span className="text-[#8B9891]">⚪ Monitor Inactive</span>
                            )}
                            {trip.is_shortlist && (
                              <span className="bg-[#FAF2E6] text-[#9A5C0E] border border-[#E8CFA9] text-[10px] px-2 py-0.5 rounded font-bold">
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
                            className="text-[11px] bg-[#FAF2E6] hover:bg-[#F3E5D0] text-[#9A5C0E] border border-[#E8CFA9] px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Simulate severe condition shift to test Plan B alternatives"
                          >
                            <span>⚡ {simulatingTripId === trip.id ? "Simulating..." : "Test Condition Shift"}</span>
                          </button>
                        </div>

                        {/* PLAN B ALERT BANNER WITH 1-CLICK ALTERNATIVE SWITCHING */}
                        {trip.alerts && trip.alerts.length > 0 && (
                          <div className="mt-3 bg-[#FDF2F2] border border-[#F5C2C2] p-3.5 rounded-xl text-xs space-y-2.5 shadow-xs">
                            <div className="flex items-center gap-2 text-[#B3261E] font-bold">
                              <span className="text-base">⚠️</span>
                              <span>{trip.alerts[0].details}</span>
                            </div>

                            {trip.alerts[0].suggested_alternatives && trip.alerts[0].suggested_alternatives.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-[#F5C2C2]">
                                <span className="text-[11px] text-[#536259] font-bold block uppercase tracking-wider">
                                  Safe Alternative Campsites:
                                </span>
                                <div className="grid grid-cols-1 gap-2">
                                  {trip.alerts[0].suggested_alternatives.map((alt) => (
                                    <div key={alt.id} className="bg-[#FFFFFF] p-3 rounded-xl border border-[#E2DAC8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                                      <div>
                                        <div className="font-bold text-[#1E2A24] text-xs flex items-center gap-1.5">
                                          <span>{alt.name}</span>
                                          <span className="text-[10px] text-[#2F5D50] bg-[#EBF2EE] px-1.5 py-0.2 rounded border border-[#2F5D50]/20 uppercase font-mono">{alt.state}</span>
                                        </div>
                                        <div className="text-[11px] text-[#536259] mt-0.5">{alt.reason}</div>
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
                                          className="text-[11px] bg-[#FAF6EF] hover:bg-[#EFE9DD] border border-[#E2DAC8] text-[#1E2A24] px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
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
                                          className="flex-1 sm:flex-none text-[11px] bg-[#2F5D50] text-white hover:bg-[#24493F] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
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
              <div className="text-center text-sm text-[#536259] py-6">Enter your email and token to view your planned trips, test Plan B shifts, and switch campgrounds.</div>
            )}
          </div>
        </div>
      )}
      {/* BETA FEEDBACK DRAWER & FLOATING TRIGGER */}
      <BetaFeedbackModal 
        isOpen={showFeedback ? true : undefined} 
        onClose={() => setShowFeedback(false)} 
        currentCampsiteName={selectedSite?.name || null} 
      />
    </main>
  );
}
