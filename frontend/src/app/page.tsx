"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Campsite } from '@/components/Map';
const CampingMap = dynamic(() => import('@/components/Map'), { ssr: false });
import TripCard from '@/components/TripCard';
import SearchFilter, { FilterParams } from '@/components/SearchFilter';

interface SavedTripDashboard {
  id: number;
  campsite_id: number;
  campsite_name: string;
  state: string;
  start_date: string;
  end_date: string;
  plan_b_active: boolean;
}

export default function Home() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [selectedSite, setSelectedSite] = useState<Campsite | null>(null);
  const [filters, setFilters] = useState<FilterParams>({ dog_friendly: null, rig_access: null });

  // Dashboard State
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashEmail, setDashEmail] = useState("");
  const [myTrips, setMyTrips] = useState<SavedTripDashboard[] | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);

  // Routing State
  const [startLocation, setStartLocation] = useState({ longitude: 151.2093, latitude: -33.8688 }); // Default to Sydney CBD
  const [routeGeoJson, setRouteGeoJson] = useState<any>(null);
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
    if (selectedSite) {
      // Fetch OSRM route
      fetch(`https://router.project-osrm.org/route/v1/driving/${startLocation.longitude},${startLocation.latitude};${selectedSite.longitude},${selectedSite.latitude}?overview=full&geometries=geojson`)
        .then(res => res.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            setRouteGeoJson(data.routes[0].geometry);
            setRouteDistance(data.routes[0].distance);
          }
        })
        .catch(err => console.error("OSRM Routing Error:", err));
    } else {
      setRouteGeoJson(null);
      setRouteDistance(null);
    }
  }, [selectedSite, startLocation]);

  useEffect(() => {
    // Fetch canonical campsites from our FastAPI backend
    const fetchCampsites = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
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
    <main className="relative w-screen h-screen overflow-hidden bg-[var(--color-forest-900)]">
      {/* Dynamic Map Component */}
      <CampingMap 
        campsites={campsites} 
        onSelectCampsite={setSelectedSite}
        routeGeoJson={routeGeoJson}
        startLocation={startLocation}
      />

      {/* My Trips Button */}
      <div className="absolute top-4 left-4 z-10 pointer-events-auto">
        <button 
          onClick={() => setShowDashboard(true)}
          className="glass-panel px-5 py-3 rounded-2xl font-bold text-white hover:bg-white/10 transition-colors shadow-lg flex items-center justify-center whitespace-nowrap bg-black/40 backdrop-blur-md border border-white/10"
        >
          ⛺ My Trips
        </button>
      </div>

      {/* Filter Panel */}
      <div className="absolute top-20 md:top-4 right-4 left-4 md:left-auto md:w-80 z-10 pointer-events-auto">
        <SearchFilter onFilterChange={(newFilters) => setFilters(newFilters)} />
      </div>

      {/* Answer-First Overlay */}
      {selectedSite && (
        <TripCard 
          key={selectedSite.id}
          campsite={selectedSite} 
          onClose={() => setSelectedSite(null)}
          routeDistance={routeDistance}
        />
      )}

      {/* Brand Header */}
      <div className="absolute bottom-6 right-6 pointer-events-none z-10 flex flex-col items-end">
        <h1 className="text-3xl font-black text-white tracking-tighter">
          CAMP SMART <span className="text-[var(--color-neon-green)]">AU</span>
        </h1>
        <p className="text-gray-400 font-medium text-sm">Condition-Aware Trip Engine</p>
      </div>

      {/* My Trips Dashboard Modal */}
      {showDashboard && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/20 p-6 rounded-2xl w-full max-w-md text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-neon-green">My Saved Trips</h2>
              <button onClick={() => setShowDashboard(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={dashEmail}
                onChange={e => setDashEmail(e.target.value)}
                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-neon-green"
              />
              <button 
                onClick={async () => {
                  if (!dashEmail) return;
                  setLoadingTrips(true);
                  try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8021/api/v1"}/saved-trips/dashboard/${encodeURIComponent(dashEmail)}`);
                    if (res.ok) {
                      setMyTrips(await res.json());
                    }
                  } catch (e) {}
                  setLoadingTrips(false);
                }}
                className="bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#00e67a]"
              >
                Load
              </button>
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
                      <div className="flex items-center gap-2 text-xs">
                        {trip.plan_b_active ? (
                          <span className="text-neon-green flex items-center gap-1 font-semibold">🟢 Plan B Monitor Active</span>
                        ) : (
                          <span className="text-gray-500">⚪ Monitor Inactive</span>
                        )}
                      </div>
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
