"use client";

import React, { useState, useMemo } from "react";
import { 
  Sun, 
  Moon, 
  CloudRain, 
  Wind, 
  Sparkles, 
  Flame, 
  Tent, 
  ShieldCheck, 
  Thermometer, 
  Droplets, 
  Calendar,
  AlertTriangle,
  Zap,
  Activity
} from "lucide-react";

export interface WeatherHUDData {
  tempMax: number;
  tempMin: number;
  precipProb: number;
  windSpeed: number;
  uvIndex: number;
  description: string;
}

export interface FuturisticWeatherHUDProps {
  liveWeather: WeatherHUDData | null;
  futureWeather: WeatherHUDData | null;
  loadingLive: boolean;
  loadingFuture: boolean;
  selectedStartDate?: string;
  selectedEndDate?: string;
  campsiteElevation?: number;
  campsiteName?: string;
}

type DayPhase = "dawn" | "midday" | "dusk" | "night";

export default function FuturisticWeatherHUD({
  liveWeather,
  futureWeather,
  loadingLive,
  loadingFuture,
  selectedStartDate,
  selectedEndDate,
  campsiteElevation,
  campsiteName
}: FuturisticWeatherHUDProps) {
  // Mode: "live" or "predictive"
  const [mode, setMode] = useState<"live" | "predictive">(selectedStartDate ? "predictive" : "live");
  const [activePhase, setActivePhase] = useState<DayPhase>("night");
  const [expandedDetails, setExpandedDetails] = useState(false);

  // Active dataset depending on mode
  const currentData = mode === "predictive" && futureWeather ? futureWeather : liveWeather;
  const isLoading = mode === "predictive" ? loadingFuture : loadingLive;

  // Phase-specific telemetry calculations based on actual atmospheric physics & camping impacts
  const phaseTelemetry = useMemo(() => {
    if (!currentData) return null;

    const { tempMax, tempMin, windSpeed, precipProb, uvIndex } = currentData;

    switch (activePhase) {
      case "dawn": {
        const dawnTemp = Math.round(tempMin + (tempMax - tempMin) * 0.05);
        const dewRisk = tempMin <= 4 ? "Extreme Frost Risk" : tempMin <= 9 ? "Heavy Morning Dew" : "Low Condensation";
        const dewColor = tempMin <= 4 ? "text-cyan-300" : tempMin <= 9 ? "text-blue-300" : "text-emerald-300";
        return {
          phaseName: "Dawn",
          timeLabel: "06:00 AM",
          tagline: "Morning Chill & Ground Condensation",
          temp: dawnTemp,
          feelsLike: dawnTemp - 1,
          icon: <Sun size={20} className="text-amber-300 animate-pulse" />,
          telemetry: [
            {
              label: "Ground Condensation",
              value: dewRisk,
              color: dewColor,
              icon: <Droplets size={14} />,
              note: tempMin <= 9 ? "Ground tarp under tent floor essential to prevent damp seep." : "Standard tent floor adequate."
            },
            {
              label: "Morning Breeze",
              value: `${Math.round(windSpeed * 0.5)} km/h`,
              color: "text-gray-200",
              icon: <Wind size={14} />,
              note: "Gentle morning valley airflow."
            },
            {
              label: "Sunrise Light",
              value: "Soft Diffuse",
              color: "text-amber-200",
              icon: <Sun size={14} />,
              note: "Ideal for camp wake-up and brewing coffee."
            },
            {
              label: "Clothing Layer",
              value: dawnTemp < 10 ? "Fleece + Thermal" : "Light Layer",
              color: "text-emerald-300",
              icon: <ShieldCheck size={14} />,
              note: "Pack a warm outer layer for packing down camp."
            }
          ]
        };
      }
      case "midday": {
        const middayTemp = tempMax;
        const uvWarning = uvIndex >= 8 ? "Extreme (8+) - Shade Req" : uvIndex >= 6 ? "High (6-7)" : "Moderate (3-5)";
        return {
          phaseName: "Midday",
          timeLabel: "01:00 PM",
          tagline: "Peak Solar Intensity & Active Hours",
          temp: middayTemp,
          feelsLike: Math.round(middayTemp + (uvIndex > 7 ? 2 : 0)),
          icon: <Sun size={20} className="text-yellow-400" />,
          telemetry: [
            {
              label: "Solar UV Index",
              value: `${uvIndex} (${uvWarning})`,
              color: uvIndex >= 8 ? "text-rose-400" : "text-yellow-300",
              icon: <Sun size={14} />,
              note: uvIndex >= 8 ? "Pitch tarp/gazebo for canopy shade; SPF 50+ mandatory." : "Standard sun protection."
            },
            {
              label: "Hydration Need",
              value: middayTemp >= 28 ? "High (3L/person)" : "Moderate (2L/person)",
              color: middayTemp >= 28 ? "text-amber-300" : "text-emerald-300",
              icon: <Droplets size={14} />,
              note: "Keep water cool under shaded tent fly."
            },
            {
              label: "Peak Wind",
              value: `${windSpeed} km/h`,
              color: windSpeed > 25 ? "text-amber-300" : "text-gray-200",
              icon: <Wind size={14} />,
              note: windSpeed > 25 ? "Secure awning guy lines before heading on trails." : "Calm midday breeze."
            },
            {
              label: "Rain Probability",
              value: `${precipProb}%`,
              color: precipProb > 40 ? "text-blue-300" : "text-emerald-300",
              icon: <CloudRain size={14} />,
              note: precipProb > 40 ? "Pack rain gear for afternoon walk." : "Low precipitation risk."
            }
          ]
        };
      }
      case "dusk": {
        const duskTemp = Math.round(tempMax * 0.6 + tempMin * 0.4);
        const fireSafe = windSpeed <= 15 ? "Prime Fire Conditions" : windSpeed <= 25 ? "Breezy: Use Shielded Fire Pit" : "High Wind Hazard (No Open Fire)";
        const fireColor = windSpeed <= 15 ? "text-emerald-300" : windSpeed <= 25 ? "text-amber-300" : "text-rose-400";
        return {
          phaseName: "Dusk",
          timeLabel: "06:30 PM",
          tagline: "Campfire Window & Temperature Transition",
          temp: duskTemp,
          feelsLike: duskTemp,
          icon: <Flame size={20} className="text-orange-400" />,
          telemetry: [
            {
              label: "Campfire Safety Factor",
              value: fireSafe,
              color: fireColor,
              icon: <Flame size={14} />,
              note: windSpeed > 25 ? "Embers can ignite dry bush; use gas stove only." : "Verify current local park fire ban."
            },
            {
              label: "Cooling Rate",
              value: "Rapid (-2°C / hr)",
              color: "text-cyan-300",
              icon: <Thermometer size={14} />,
              note: "Zip up inner tent mesh before insects gather at dusk."
            },
            {
              label: "Cooking Breeze",
              value: `${Math.round(windSpeed * 0.75)} km/h`,
              color: "text-gray-200",
              icon: <Wind size={14} />,
              note: "Set up windbreak around camping stove."
            },
            {
              label: "Sunset Ambience",
              value: "Golden Hour Glow",
              color: "text-amber-300",
              icon: <Sun size={14} />,
              note: "Best window for campsite photos and settling in."
            }
          ]
        };
      }
      case "night":
      default: {
        const nightTemp = tempMin;
        let sleepRating = "10°C Comfort Bag";
        let sleepColor = "text-emerald-300";
        let sleepNote = "Comfortable standard sleeping bag and uninsulated mat.";

        if (nightTemp <= 4) {
          sleepRating = "❄️ 0°C Rated Bag + R4+ Mat";
          sleepColor = "text-cyan-300 font-bold";
          sleepNote = "Cold air sinks in valley floor. Insulated sleeping pad is vital to block ground freeze.";
        } else if (nightTemp <= 10) {
          sleepRating = "🏕️ 5°C 3-Season Bag";
          sleepColor = "text-[var(--color-neon-green)]";
          sleepNote = "Standard thermal base layer and beanie recommended for sound sleep.";
        } else if (nightTemp >= 18) {
          sleepRating = "🌙 Summer Sheet / Open Quilt";
          sleepColor = "text-amber-200";
          sleepNote = "Warm overnight conditions; keep tent mesh vented for airflow.";
        }

        const stargazeClarity = precipProb <= 20 ? "95% Crystal Clear" : precipProb <= 50 ? "60% Scattered Stars" : "Overcast Horizon";

        return {
          phaseName: "Night",
          timeLabel: "11:00 PM",
          tagline: "Overnight Sleep Comfort & Dark Sky Clarity",
          temp: nightTemp,
          feelsLike: nightTemp - 1,
          icon: <Moon size={20} className="text-indigo-300" />,
          telemetry: [
            {
              label: "Sleeping Bag Comfort",
              value: sleepRating,
              color: sleepColor,
              icon: <Tent size={14} />,
              note: sleepNote
            },
            {
              label: "Dark Sky & Stargazing",
              value: stargazeClarity,
              color: precipProb <= 20 ? "text-indigo-300 font-bold" : "text-gray-300",
              icon: <Sparkles size={14} />,
              note: precipProb <= 20 ? "Exceptional celestial visibility away from urban glow." : "Intermittent cloud cover."
            },
            {
              label: "Overnight Low",
              value: `${nightTemp}°C`,
              color: nightTemp <= 6 ? "text-cyan-300" : "text-gray-200",
              icon: <Thermometer size={14} />,
              note: "Lowest temperature recorded between 4:30 AM and 6:00 AM."
            },
            {
              label: "Peg Strain Index",
              value: windSpeed > 25 ? "High (Guy-lines Required)" : "Stable / Calm",
              color: windSpeed > 25 ? "text-amber-300" : "text-emerald-300",
              icon: <Wind size={14} />,
              note: "Check tent tension before retiring for the evening."
            }
          ]
        };
      }
    }
  }, [currentData, activePhase]);

  // Phase options for the interactive scrubber
  const PHASES: { id: DayPhase; label: string; icon: React.ReactNode; time: string }[] = [
    { id: "dawn", label: "Dawn", icon: <Sun size={13} />, time: "06:00" },
    { id: "midday", label: "Midday", icon: <Sun size={13} className="text-yellow-400" />, time: "13:00" },
    { id: "dusk", label: "Dusk", icon: <Flame size={13} className="text-orange-400" />, time: "18:30" },
    { id: "night", label: "Night", icon: <Moon size={13} className="text-indigo-300" />, time: "23:00" },
  ];

  return (
    <div className="w-full bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 rounded-2xl p-3.5 border border-white/15 shadow-xl backdrop-blur-md relative overflow-hidden flex flex-col gap-3 transition-all">
      {/* BACKGROUND ATMOSPHERIC RADIAL GLOW */}
      <div 
        className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700 ${
          activePhase === "night" ? "bg-indigo-500" :
          activePhase === "dawn" ? "bg-cyan-400" :
          activePhase === "midday" ? "bg-amber-400" : "bg-orange-500"
        }`} 
      />

      {/* HEADER: MODE TOGGLE & LIVE TELEMETRY BADGE */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-200">
            <Activity size={13} className="text-[var(--color-neon-green)] animate-pulse" />
            <span>Atmospheric Telemetry</span>
          </div>

          {mode === "predictive" ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
              <Sparkles size={11} /> Climatology AI
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <Zap size={11} /> Live Radar Sync
            </span>
          )}
        </div>

        {/* MODE SWITCHER */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px] font-semibold">
          <button
            onClick={() => setMode("live")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
              mode === "live"
                ? "bg-[var(--color-neon-green)] text-[var(--color-forest-900)] font-black shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            ⚡ Live
          </button>
          <button
            onClick={() => setMode("predictive")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              mode === "predictive"
                ? "bg-purple-500 text-white font-black shadow"
                : "text-gray-400 hover:text-white"
            }`}
            title="Seasonal Microclimate Prediction for Future Trip Dates"
          >
            🔮 Future Date
          </button>
        </div>
      </div>

      {/* CLIMATOLOGY ALERT BANNER IF IN PREDICTIVE MODE */}
      {mode === "predictive" && (
        <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-purple-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-purple-400 shrink-0" />
            <span>
              {selectedStartDate 
                ? `Climatological envelope for ${selectedStartDate} ${selectedEndDate ? `to ${selectedEndDate}` : ""}`
                : "Future trip dates mode: 10-year climatological analog baseline"}
            </span>
          </div>
          <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
            P10-P90 Model
          </span>
        </div>
      )}

      {/* MAIN ATMOSPHERIC SNAPSHOT DISPLAY */}
      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-400 text-xs animate-pulse">
          <div className="w-6 h-6 border-2 border-[var(--color-neon-green)] border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing microclimate sensors & terrain data...</span>
        </div>
      ) : currentData && phaseTelemetry ? (
        <>
          {/* PRIMARY CURRENT READING CARD */}
          <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                {phaseTelemetry.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white tracking-tight">{phaseTelemetry.temp}°C</span>
                  <span className="text-xs text-gray-400 font-mono">Feels {phaseTelemetry.feelsLike}°C</span>
                </div>
                <div className="text-xs font-semibold text-[var(--color-neon-green)] flex items-center gap-1.5">
                  <span>{currentData.description}</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">{phaseTelemetry.tagline}</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-gray-400 font-semibold">{phaseTelemetry.phaseName} Phase</div>
              <div className="text-sm font-black text-white font-mono">{phaseTelemetry.timeLabel}</div>
            </div>
          </div>

          {/* INTERACTIVE 24-HOUR CAMPING DIURNAL SCRUBBER */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
              <span className="font-semibold text-gray-300">Camping Diurnal Cycle</span>
              <span className="text-[10px] text-[var(--color-neon-green)]">Tap phase to inspect</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
              {PHASES.map(p => {
                const isActive = activePhase === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePhase(p.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all text-center cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-b from-white/20 to-white/10 text-white font-black shadow-lg border border-white/30 scale-[1.02]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px]">
                      {p.icon}
                      <span>{p.label}</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-70 mt-0.5">{p.time}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CAMPER TELEMETRY HUD TILES (4 IMPACT TILES) */}
          <div className="grid grid-cols-2 gap-2">
            {phaseTelemetry.telemetry.map((t, idx) => (
              <div 
                key={idx}
                className="bg-white/5 hover:bg-white/10 transition-colors rounded-xl p-2.5 border border-white/10 flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span className="truncate">{t.label}</span>
                  <span className="text-gray-300 shrink-0">{t.icon}</span>
                </div>
                <div className={`text-xs md:text-sm font-extrabold truncate ${t.color}`}>
                  {t.value}
                </div>
                <div className="text-[10px] text-gray-400 leading-tight line-clamp-2 mt-0.5">
                  {t.note}
                </div>
              </div>
            ))}
          </div>

          {/* QUICK SUMMARY EXPANDER (MICROCLIMATE & ELEVATION INSIGHTS) */}
          <div className="pt-1">
            <button
              onClick={() => setExpandedDetails(!expandedDetails)}
              className="w-full text-[11px] text-gray-400 hover:text-white flex items-center justify-between px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 transition-all cursor-pointer"
            >
              <span className="font-semibold flex items-center gap-1.5">
                <Thermometer size={13} className="text-[var(--color-neon-green)]" />
                <span>Microclimate Envelope & Terrain Impact</span>
              </span>
              <span className="text-xs font-mono">{expandedDetails ? "▲ Hide" : "▼ Expand"}</span>
            </button>

            {expandedDetails && (
              <div className="mt-2 p-3 rounded-xl bg-black/50 border border-white/10 text-xs text-gray-300 space-y-2 animate-in fade-in duration-200">
                <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-white/10">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Day High</span>
                    <strong className="text-white text-sm">{currentData.tempMax}°C</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Night Low</span>
                    <strong className="text-cyan-300 text-sm">{currentData.tempMin}°C</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Max Wind</span>
                    <strong className="text-amber-300 text-sm">{currentData.windSpeed} km/h</strong>
                  </div>
                </div>

                <div className="text-[11px] text-gray-300 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <span className="text-[var(--color-neon-green)] shrink-0">📍</span>
                    <span>
                      <strong>Terrain Factor ({campsiteName || "Campground"}):</strong> {campsiteElevation ? `~${campsiteElevation}m elevation` : "Valley basin"}. Expect overnight temperature inversion where cold air settles in low-lying campsite zones.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-400 shrink-0">⚠️</span>
                    <span>
                      <strong>Packing Rule:</strong> Always prepare for night temperatures 3°C to 5°C colder than regional town forecasts.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-4 text-center text-xs text-gray-400 flex flex-col items-center gap-1">
          <AlertTriangle size={16} className="text-amber-400" />
          <span>Live atmospheric feed unavailable. Check park alerts prior to departure.</span>
        </div>
      )}
    </div>
  );
}
