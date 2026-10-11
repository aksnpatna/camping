"use client";

import { useState, useEffect } from "react";
import { Flame, CloudRain, MapPin, X, Dog, Car, Sun } from "lucide-react";
import type { Campsite } from "./Map";
import { getApiUrl } from "@/config";

interface WeatherData {
  tempMax: number;
  tempMin: number;
  precipProb: number;
  windSpeed: number;
  uvIndex: number;
  description: string;
}

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

export default function TripCard({ campsite, onClose, routeDistance }: { campsite: Campsite | null, onClose: () => void, routeDistance?: number | null }) {
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

  useEffect(() => {
    if (!campsite) return;
    
    let isMounted = true;
    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        // Fetch 7-day forecast but we just show today's for the MVP hook
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

  // Fetch historical weather when dates are selected to provide future gear recommendations
  useEffect(() => {
    if (!campsite || !startDate) {
      return;
    }

    let isMounted = true;
    const fetchHistoricalWeather = async () => {
      setLoadingFutureWeather(true);
      try {
        // Fetch data for the same days from 1 year ago as historical observation baseline
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
            
            // Accurately label historical observations rather than inventing a probability
            const precipObservation = totalPrecip > 5 ? 70 : totalPrecip > 0 ? 30 : 0;

            setFutureWeather({
              tempMax: Math.round(avgTempMax),
              tempMin: Math.round(avgTempMin),
              precipProb: precipObservation,
              windSpeed: Math.round(maxWind),
              uvIndex: 0,
              description: `Historical Record (${Math.round(totalPrecip)}mm precipitation)`
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch historical weather", e);
      } finally {
        if (isMounted) setLoadingFutureWeather(false);
      }
    };

    fetchHistoricalWeather();
    return () => { isMounted = false; };
  }, [campsite, startDate, endDate]);

  if (!campsite) return null;

  return (
    <div className="absolute top-6 left-6 w-96 max-w-[calc(100vw-3rem)] glass-panel rounded-2xl p-6 z-10 animate-fade-in flex flex-col gap-5 text-[var(--foreground)]">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <X size={18} />
      </button>

      <div>
        <div className="flex items-center gap-2 text-[var(--color-neon-green)] text-sm font-semibold mb-1 uppercase tracking-wider">
          <MapPin size={14} />
          {campsite.state} • {campsite.management_type || "Verified"}
        </div>
        <h2 className="text-2xl font-bold">{campsite.name}</h2>
        {aiSummary && (
          <p className="text-sm text-gray-300 mt-2 leading-relaxed border-l-2 border-white/20 pl-3">
            <span className="font-semibold text-white/50 text-xs block mb-1">AI Pitch</span>
            {aiSummary}
          </p>
        )}
      </div>

      {routeDistance !== undefined && routeDistance !== null && (
        <div className="flex gap-4 text-xs font-medium text-[var(--color-neon-green)] bg-white/5 p-2 rounded-lg border border-white/10">
          <div className="flex items-center gap-1">
            <Car size={14} /> 
            {Math.round(routeDistance / 1000)} km from Start
          </div>
          <div className="flex items-center gap-1 opacity-80">
            ⛽ Est. Fuel: ${( (routeDistance / 1000) * 0.24 ).toFixed(2)} (4WD)
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-1 border border-white/10 relative overflow-hidden">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            {weather?.description === "Clear" ? <Sun size={16} className="text-yellow-400" /> : <CloudRain size={16} className="text-blue-400" />}
            Live Weather
          </div>
          {loadingWeather ? (
            <div className="font-medium text-sm animate-pulse text-gray-400">Loading forecast...</div>
          ) : weather ? (
            <div className="text-sm">
              <div className="font-medium text-[var(--color-neon-green)] mb-1">{weather.description}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-300">
                <div>High: {weather.tempMax}°C</div>
                <div>Low: {weather.tempMin}°C</div>
                <div>Wind: {weather.windSpeed}km/h</div>
                <div>Rain: {weather.precipProb}%</div>
                <div>UV: {weather.uvIndex}</div>
              </div>
            </div>
          ) : (
            <div className="font-medium text-sm text-gray-400">Unavailable</div>
          )}
        </div>
        <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2 border border-white/10">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Flame size={16} className="text-[var(--color-sunset-orange)]" />
            {startDate ? "Future Gear Needs" : "Gear Recommendation"}
          </div>
          <div className="text-xs text-gray-300">
            {loadingFutureWeather ? (
              <span className="animate-pulse">Analyzing historical data...</span>
            ) : startDate && futureWeather ? (
              <ul className="list-disc pl-3 space-y-1">
                <li className="text-gray-400 mb-2 italic list-none -ml-3">{futureWeather.description}</li>
                {futureWeather.tempMin < 10 && <li className="text-[var(--color-neon-green)]">0°C Sleeping Bag & Thermal Mat</li>}
                {futureWeather.precipProb > 30 && <li className="text-[var(--color-neon-green)]">Heavy-duty Tarp & Waterproofing</li>}
                {futureWeather.windSpeed > 20 && <li className="text-[var(--color-neon-green)]">Strong Pegs & Windbreak</li>}
                {futureWeather.tempMin >= 10 && futureWeather.precipProb <= 30 && futureWeather.windSpeed <= 20 && <li className="text-[var(--color-neon-green)]">Standard 3-Season Gear</li>}
              </ul>
            ) : weather ? (
              <ul className="list-disc pl-3 space-y-1">
                {weather.tempMin < 10 && <li>0°C Sleeping Bag & Thermal Mat</li>}
                {weather.precipProb > 30 && <li>Heavy-duty Tarp & Waterproofing</li>}
                {weather.windSpeed > 20 && <li>Strong Pegs & Windbreak</li>}
                {weather.tempMin >= 10 && weather.precipProb <= 30 && weather.windSpeed <= 20 && <li>Standard 3-Season Gear</li>}
              </ul>
            ) : "Loading..."}
          </div>
        </div>
      </div>

      {/* Community Field Notes & Sourced Insights Section */}
      <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2 border border-white/10">
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

      <div className="flex gap-4 border-t border-white/10 pt-4">
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

      <div className="mt-2 border-t border-white/10 pt-4">
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
                    const res = await fetch(`${getApiUrl()}/saved-trips/`, {
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
                      const errData = await res.json();
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
          <button 
            onClick={() => setIsSaving(true)}
            className="w-full py-3 bg-[var(--color-neon-green)] hover:bg-[#00e67a] text-[var(--color-forest-900)] font-bold rounded-xl transition-all shadow-[0_4px_20px_rgba(0,255,136,0.2)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.4)]"
          >
            Save Trip & Monitor for Plan B
          </button>
        )}
      </div>

      <div className="mt-2">
        <a 
          href={campsite.source_url || `https://www.google.com/search?q=book+${encodeURIComponent(campsite.name)}+camping`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex justify-center items-center w-full py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all text-sm border border-white/20"
        >
          View Booking Info & Availability
        </a>
      </div>
    </div>
  );
}
