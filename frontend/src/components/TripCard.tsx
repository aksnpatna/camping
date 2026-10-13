"use client";

import { useState, useEffect } from "react";
import { MapPin, X, Dog, Car, Clock, ExternalLink, Navigation, Compass } from "lucide-react";
import type { Campsite } from "./Map";
import { getApiUrl } from "@/config";
import FuturisticWeatherHUD, { type WeatherHUDData } from "./FuturisticWeatherHUD";
import GroundCheckInModal from "./GroundCheckInModal";

type WeatherData = WeatherHUDData;

interface CamperObservation {
  category: string;
  observation: string;
  source_attribution: string;
}

interface InsightsData {
  sentiment_score?: number | null;
  nearest_fuel: string;
  nearest_grocery: string;
  top_activities: string[];
  observations?: CamperObservation[];
  retrieved_at?: string;
}

export default function TripCard({ 
  campsite, 
  onClose, 
  routeDistance,
  startLocation 
}: { 
  campsite: Campsite | null; 
  onClose: () => void; 
  routeDistance?: number | null;
  startLocation?: { latitude?: number; longitude?: number; city?: string; state?: string } | null;
}) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  
  // Plan B form state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [futureWeather, setFutureWeather] = useState<WeatherData | null>(null);
  const [loadingFutureWeather, setLoadingFutureWeather] = useState(false);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  useEffect(() => {
    if (!campsite) return;
    
    let isMounted = true;
    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        try {
          const microRes = await fetch(`${getApiUrl()}/weather/microclimate?campsite_id=${campsite.id}&date=${todayStr}&latitude=${campsite.latitude}&longitude=${campsite.longitude}`);
          if (microRes.ok) {
            const data = await microRes.json();
            if (isMounted) {
              setWeather({
                tempMax: Math.round(data.temp_max),
                tempMin: Math.round(data.temp_min),
                precipProb: data.rain_probability,
                windSpeed: Math.round(data.wind_max_kmh),
                uvIndex: data.uv_index_max,
                description: "Live Radar Sync",
                sleepingBagRating: data.sleeping_bag_rating,
                matRValue: data.recommended_mat_r_value,
                dewFrostIndex: data.dew_frost_index,
                campfireWindRisk: data.campfire_wind_risk,
                pegStrainFactor: data.peg_strain_factor,
                valleyInversionActive: data.valley_inversion_active,
                terrainNotes: data.terrain_notes,
                forecastType: data.forecast_type,
                aiConditionSummary: data.ai_condition_summary,
              });
              return;
            }
          }
        } catch {
          // Graceful fallback to client Open-Meteo
        }

        // Fetch 7-day forecast but we just show today's for the fallback hook
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${campsite.latitude}&longitude=${campsite.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max&timezone=auto`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.daily) {
            const code = data.daily.weathercode[0];
            // Simple WMO weather code mapping
            let desc = "Clear";
            if (code >= 1 && code <= 3) desc = "Partly Cloudy";
            if (code >= 45 && code <= 48) desc = "Foggy";
            if (code >= 51 && code <= 67) desc = "Rainy";
            if (code >= 71 && code <= 77) desc = "Snow";
            if (code >= 95) desc = "Stormy";

            setWeather({
              tempMax: Math.round(data.daily.temperature_2m_max[0]),
              tempMin: Math.round(data.daily.temperature_2m_min[0]),
              precipProb: data.daily.precipitation_probability_max[0],
              windSpeed: Math.round(data.daily.windspeed_10m_max[0]),
              uvIndex: Math.round(data.daily.uv_index_max[0]),
              description: desc
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch weather", e);
      } finally {
        if (isMounted) setLoadingWeather(false);
      }
    };

    
    const fetchAiSummary = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/campsites/${campsite.id}/ai-summary`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setAiSummary(data.summary);
        }
      } catch (e) {
        console.error("Failed to fetch AI summary", e);
      }
    };

    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const res = await fetch(`${getApiUrl()}/campsites/${campsite.id}/insights`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setInsights(data);
        }
      } catch (e) {
        console.error("Failed to fetch insights", e);
      } finally {
        if (isMounted) setLoadingInsights(false);
      }
    };

    fetchWeather();
    fetchAiSummary();
    fetchInsights();
    return () => { isMounted = false; };
  }, [campsite]);

  // Fetch high-res future forecast or climatological analog when dates are selected
  useEffect(() => {
    if (!campsite || !startDate) {
      return;
    }

    let isMounted = true;
    const fetchFutureWeather = async () => {
      setLoadingFutureWeather(true);
      try {
        const tripDate = new Date(startDate);
        const today = new Date();
        const diffDays = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Priority 1: Backend Microclimate Predictor API (elevation downscaling & terrain physics)
        try {
          const microRes = await fetch(`${getApiUrl()}/weather/microclimate?campsite_id=${campsite.id}&date=${startDate}&latitude=${campsite.latitude}&longitude=${campsite.longitude}`);
          if (microRes.ok) {
            const data = await microRes.json();
            if (isMounted) {
              setFutureWeather({
                tempMax: Math.round(data.temp_max),
                tempMin: Math.round(data.temp_min),
                precipProb: data.rain_probability,
                windSpeed: Math.round(data.wind_max_kmh),
                uvIndex: data.uv_index_max,
                description: data.forecast_type === "numerical_ensemble" 
                  ? `Physics Ensemble Forecast (${diffDays}d out)` 
                  : `Microclimate Climatology Normal`,
                sleepingBagRating: data.sleeping_bag_rating,
                matRValue: data.recommended_mat_r_value,
                dewFrostIndex: data.dew_frost_index,
                campfireWindRisk: data.campfire_wind_risk,
                pegStrainFactor: data.peg_strain_factor,
                valleyInversionActive: data.valley_inversion_active,
                terrainNotes: data.terrain_notes,
                forecastType: data.forecast_type,
                aiConditionSummary: data.ai_condition_summary
              });
              return;

            }
          }
        } catch {
          // Graceful fallback to direct client numerical/archive endpoints if backend microclimate unreachable
        }

        // Priority 2: Client-side numerical weather prediction within 16-day window
        if (diffDays >= 0 && diffDays <= 15) {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${campsite.latitude}&longitude=${campsite.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max&forecast_days=16&timezone=auto`);
          if (res.ok) {
            const data = await res.json();
            const dayIndex = Math.min(diffDays, (data.daily?.time?.length || 1) - 1);
            if (isMounted && data.daily && data.daily.time) {
              const code = data.daily.weathercode[dayIndex];
              let desc = "Forecast Clear";
              if (code >= 1 && code <= 3) desc = "Forecast Partly Cloudy";
              if (code >= 45 && code <= 48) desc = "Forecast Foggy";
              if (code >= 51 && code <= 67) desc = "Forecast Rain Likely";
              if (code >= 71 && code <= 77) desc = "Forecast Snow Likely";
              if (code >= 95) desc = "Forecast Storm Warning";

              setFutureWeather({
                tempMax: Math.round(data.daily.temperature_2m_max[dayIndex]),
                tempMin: Math.round(data.daily.temperature_2m_min[dayIndex]),
                precipProb: data.daily.precipitation_probability_max[dayIndex] || 0,
                windSpeed: Math.round(data.daily.windspeed_10m_max[dayIndex] || 15),
                uvIndex: Math.round(data.daily.uv_index_max[dayIndex] || 5),
                description: `${desc} (${diffDays}d out)`
              });
              return;
            }
          }
        }

        // 2. Beyond 16 days: Multi-year climatological historical baseline
        const pastStart = new Date(startDate);
        pastStart.setFullYear(pastStart.getFullYear() - 1);
        const pastEnd = endDate ? new Date(endDate) : new Date(startDate);
        pastEnd.setFullYear(pastEnd.getFullYear() - 1);
        
        const sdStr = pastStart.toISOString().split('T')[0];
        const edStr = pastEnd.toISOString().split('T')[0];

        const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${campsite.latitude}&longitude=${campsite.longitude}&start_date=${sdStr}&end_date=${edStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto`);
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.daily && data.daily.temperature_2m_max.length > 0) {
            const avgTempMax = data.daily.temperature_2m_max.reduce((a:number,b:number)=>a+b,0) / data.daily.temperature_2m_max.length;
            const avgTempMin = data.daily.temperature_2m_min.reduce((a:number,b:number)=>a+b,0) / data.daily.temperature_2m_min.length;
            const maxWind = Math.max(...data.daily.windspeed_10m_max);
            const totalPrecip = data.daily.precipitation_sum.reduce((a:number,b:number)=>a+b,0);
            
            const precipObservation = totalPrecip > 5 ? 70 : totalPrecip > 0 ? 30 : 10;

            setFutureWeather({
              tempMax: Math.round(avgTempMax),
              tempMin: Math.round(avgTempMin),
              precipProb: precipObservation,
              windSpeed: Math.round(maxWind),
              uvIndex: 6,
              description: `Climatology Model (${Math.round(totalPrecip)}mm baseline)`
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch future weather", e);
      } finally {
        if (isMounted) setLoadingFutureWeather(false);
      }
    };

    fetchFutureWeather();
    return () => { isMounted = false; };
  }, [campsite, startDate, endDate]);

  if (!campsite) return null;

  return (
    <div className="absolute top-4 left-4 md:top-6 md:left-6 w-96 max-w-[calc(100vw-2rem)] md:max-w-md max-h-[calc(100%-2rem)] md:max-h-[calc(100%-3rem)] glass-panel rounded-2xl z-20 animate-fade-in flex flex-col text-[var(--foreground)] shadow-2xl overscroll-contain overflow-hidden border border-white/20">
      {/* Sticky Header with Title and Close Button */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-white/10 flex justify-between items-start shrink-0">
        <div className="pr-4">
          <div className="flex items-center gap-2 text-[var(--color-neon-green)] text-xs font-semibold mb-0.5 uppercase tracking-wider">
            <MapPin size={13} />
            {campsite.state} • {campsite.management_type || "Verified"}
          </div>
          <h2 className="text-xl md:text-2xl font-bold leading-tight">{campsite.name}</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          aria-label="Close campsite details"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 p-5 pt-3 overflow-y-auto overflow-x-hidden flex flex-col gap-4 custom-scrollbar">
        {routeDistance !== undefined && routeDistance !== null && (
          <div className="flex gap-4 text-xs font-medium text-[var(--color-neon-green)] bg-white/5 p-2 rounded-lg border border-white/10 shrink-0">
            <div className="flex items-center gap-1">
              <Car size={14} /> 
              {Math.round(routeDistance / 1000)} km from Start
            </div>
            <div className="flex items-center gap-1 opacity-80">
              ⛽ Est. Fuel: ${( (routeDistance / 1000) * 0.24 ).toFixed(2)} (4WD)
            </div>
          </div>
        )}

        {/* ONE-TAP DIRECT GPS NAVIGATION & QUICK GROUND REPORT */}
        <div className="flex flex-col gap-2 shrink-0">
          {(() => {
            const originParam = startLocation?.latitude && startLocation?.longitude 
              ? `&origin=${startLocation.latitude},${startLocation.longitude}` 
              : "";
            const googleMapsUrl = originParam 
              ? `https://www.google.com/maps/dir/?api=1${originParam}&destination=${campsite.latitude},${campsite.longitude}&travelmode=driving`
              : `https://www.google.com/maps/search/?api=1&query=${campsite.latitude},${campsite.longitude}`;
            const appleMapsUrl = startLocation?.latitude && startLocation?.longitude 
              ? `https://maps.apple.com/?saddr=${startLocation.latitude},${startLocation.longitude}&daddr=${campsite.latitude},${campsite.longitude}&dirflg=d`
              : `https://maps.apple.com/?daddr=${campsite.latitude},${campsite.longitude}`;

            return (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                >
                  <Navigation size={13} className="text-cyan-400" /> Google Maps
                </a>
                <a
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                >
                  <Compass size={13} className="text-emerald-300" /> Apple Maps
                </a>
              </div>
            );
          })()}
          <button
            onClick={() => setShowCheckInModal(true)}
            className="w-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[var(--color-neon-green)] py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            📡 Report Ground Conditions (10s Check-in)
          </button>
        </div>

        {/* FUTURISTIC INTERACTIVE ATMOSPHERIC TELEMETRY HUD */}
        <div className="shrink-0 w-full">
          <FuturisticWeatherHUD 
            liveWeather={weather}
            futureWeather={futureWeather}
            loadingLive={loadingWeather}
            loadingFuture={loadingFutureWeather}
            selectedStartDate={startDate}
            selectedEndDate={endDate}
            campsiteName={campsite.name}
            onDateChange={(date) => setStartDate(date)}
          />
        </div>

        {aiSummary && (
          <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-white/20 pl-3 shrink-0">
            <span className="font-semibold text-white/50 text-xs block mb-1">AI Pitch</span>
            {aiSummary}
          </p>
        )}

        {/* Community Field Notes & Sourced Insights Section */}
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2 border border-white/10 shrink-0">
          <div className="flex justify-between items-center text-sm text-gray-300">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <span>Verified Field Notes</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-mono">Sourced</span>
            </span>
            {insights?.retrieved_at && (
              <span className="text-[10px] text-gray-400">
                Checked {new Date(insights.retrieved_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          
          {loadingInsights ? (
            <div className="text-xs text-gray-400 animate-pulse py-2">Scanning verified field reports & town amenities...</div>
          ) : insights ? (
            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400 block mb-0.5">⛽ Fuel</span>
                  <span className="text-white font-medium">{insights.nearest_fuel}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">🛒 Groceries</span>
                  <span className="text-white font-medium">{insights.nearest_grocery}</span>
                </div>
              </div>

              {insights.observations && insights.observations.length > 0 && (
                <div className="border-t border-white/10 pt-2 space-y-1.5">
                  <span className="text-gray-400 block text-[11px] font-semibold uppercase tracking-wider">Ground Truth Observations</span>
                  {insights.observations.map((obs, i) => (
                    <div key={i} className="bg-black/30 p-2 rounded-lg border border-white/5 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-emerald-300 font-bold uppercase">{obs.category}</span>
                        <span className="text-gray-500 italic">via {obs.source_attribution}</span>
                      </div>
                      <div className="text-gray-200 text-xs">{obs.observation}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-2">
                <span className="text-gray-400 block mb-1">Top Activities</span>
                <div className="flex flex-wrap gap-1">
                  {insights.top_activities.map((act, i) => (
                    <span key={i} className="bg-white/10 px-2 py-0.5 rounded text-white text-[11px]">{act}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">Field notes currently unavailable</div>
          )}
        </div>

        <div className="flex gap-4 border-t border-white/10 pt-4 shrink-0">
          {campsite.dog_friendly && (
            <div className="flex items-center gap-2 text-sm bg-white/5 px-3 py-1.5 rounded-full font-medium">
              <Dog size={14} /> Pet Friendly
            </div>
          )}
          {campsite.rig_access && campsite.rig_access.length > 0 && (
            <div className="flex items-center gap-2 text-sm bg-white/5 px-3 py-1.5 rounded-full font-medium">
              <Car size={14} /> {campsite.rig_access.join(', ')}
            </div>
          )}
        </div>

        <div className="mt-2 border-t border-white/10 pt-4 shrink-0">

        {saveSuccess ? (
          <div className="p-4 bg-neon-green/10 border border-neon-green/30 rounded-xl text-center flex flex-col gap-3">
            <div>
              <p className="text-neon-green font-bold text-sm">Trip Saved!</p>
              <p className="text-gray-300 text-xs mt-1">We will alert you if the weather turns bad.</p>
            </div>
            <a 
              href={`/pack/${campsite.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-2 px-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
            >
              Get Offline Pack (PDF)
            </a>
          </div>
        ) : isSaving ? (
          <div className="flex flex-col gap-3">
            <input 
              type="email" 
              placeholder="Your Email for Alerts" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-green"
            />
            <div className="flex gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-green"
              />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 bg-slate-900 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-green"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsSaving(false)}
                className="w-1/3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!email || !startDate || !endDate) return;
                  setSaveError("");
                  try {
                    const res = await fetch(`${getApiUrl()}/saved-trips`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        campsite_id: campsite.id,
                        user_email: email,
                        start_date: startDate,
                        end_date: endDate,
                        plan_b_alert_active: true
                      })
                    });
                    if (res.ok) {
                      setSaveSuccess(true);
                    } else {
                      const errData = await res.json().catch(() => ({}));
                      setSaveError(errData.detail || "Failed to save trip");
                    }
                  } catch (e) { console.error(e); setSaveError("Network error"); }
                }}
                className="w-2/3 py-2 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] font-bold rounded-lg transition-all text-sm"
              >
                Confirm & Monitor
              </button>
            </div>
            {saveError && <div className="text-red-400 text-xs text-center">{saveError}</div>}
          </div>
        ) : (
          <div className="space-y-3">
            {/* AVAILABILITY STRATEGY & BOOKING WINDOW */}
            {(() => {
              const mLower = (campsite.management_type || "").toLowerCase();
              const feeLower = (campsite.fees || "").toLowerCase();
              const isFree = feeLower.includes("$0") || feeLower.includes("free");

              let badgeText = "Operator Booking";
              let badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/30";
              let strategy = "Bookings open via operator portal. Weekend sites typically fill 1–2 weeks ahead in warm seasons.";

              if (mLower.includes("forestry") || mLower.includes("state forest") || (mLower.includes("council") && isFree)) {
                badgeText = "No Booking Required (First-Come)";
                badgeColor = "bg-emerald-500/20 text-[var(--color-neon-green)] border-emerald-500/30";
                strategy = "100% Free & Unreserved. Arrive before 4:00 PM on Friday to secure a prime creek or forest camp.";
              } else if (mLower.includes("npws") || mLower.includes("national park") || mLower.includes("parks australia")) {
                if (isFree) {
                  badgeText = "Free Permit ($0)";
                  badgeColor = "bg-teal-500/20 text-teal-300 border-teal-500/30";
                  strategy = "Online registration required ($0 entry). Generally available outside peak public holiday weekends.";
                } else {
                  badgeText = "Online Booking Required (NPWS)";
                  badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                  strategy = "180-day advance booking window via NPWS. Popular beach and valley spots book 2–3 weeks in advance.";
                }
              }

              return (
                <div className="bg-black/40 border border-emerald-500/20 p-3 rounded-xl text-xs">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Clock size={12} /> Availability Strategy
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    {strategy}
                  </p>
                </div>
              );
            })()}

            <button 
              onClick={() => setIsSaving(true)}
              className="w-full py-3 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] font-bold rounded-xl transition-all shadow-[0_4px_20px_rgba(0,255,136,0.2)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.4)] cursor-pointer"
            >
              Save Trip & Monitor for Plan B
            </button>
          </div>
        )}
      </div>

      <div className="mt-2">
        <a 
          href={campsite.booking_url || campsite.source_url || `https://www.google.com/search?q=book+${encodeURIComponent(campsite.name)}+camping`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center items-center gap-1.5 w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-xs border border-white/20 cursor-pointer"
        >
          <span>View Booking / Permit Details</span>
          <ExternalLink size={13} />
        </a>
      </div>
      </div>

      {showCheckInModal && (
        <GroundCheckInModal
          campsiteId={campsite.id}
          campsiteName={campsite.name}
          onClose={() => setShowCheckInModal(false)}
          onCheckInSuccess={() => {
            setShowCheckInModal(false);
          }}
        />
      )}
    </div>
  );
}
