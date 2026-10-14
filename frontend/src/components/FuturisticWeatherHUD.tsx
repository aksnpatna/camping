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
  sleepingBagRating?: string;
  matRValue?: number;
  dewFrostIndex?: string;
  campfireWindRisk?: string;
  pegStrainFactor?: string;
  valleyInversionActive?: boolean;
  terrainNotes?: string[];
  forecastType?: string;
  aiConditionSummary?: string;
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
  onDateChange?: (date: string) => void;
}

type DayPhase = "dawn" | "midday" | "dusk" | "night";

export default function FuturisticWeatherHUD({
  liveWeather,
  futureWeather,
  loadingLive,
  loadingFuture,
  selectedStartDate,
  campsiteElevation,
  campsiteName,
  onDateChange
}: FuturisticWeatherHUDProps) {
  // Mode: "live" or "predictive"
  const [mode, setMode] = useState<"live" | "predictive">(selectedStartDate ? "predictive" : "live");
  const [prevSelectedDate, setPrevSelectedDate] = useState<string | undefined>(selectedStartDate);
  const [targetDate, setTargetDate] = useState<string>(selectedStartDate || "");
  const [activePhase, setActivePhase] = useState<DayPhase>("night");
  const [expandedDetails, setExpandedDetails] = useState(false);

  // Sync targetDate when selectedStartDate prop changes during render
  if (selectedStartDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedStartDate);
    setTargetDate(selectedStartDate || "");
  }

  const handlePredictiveMode = () => {
    setMode("predictive");
    let chosenDate = targetDate;
    if (!chosenDate) {
      const d = new Date();
      const day = d.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      chosenDate = d.toISOString().split("T")[0];
      setTargetDate(chosenDate);
    }
    if (onDateChange) {
      onDateChange(chosenDate);
    }
  };

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
        const dewColor = tempMin <= 4 ? "text-[#1F6FB2] font-bold" : tempMin <= 9 ? "text-[#1F6FB2]" : "text-[#2F5D50]";
        return {
          phaseName: "Dawn",
          timeLabel: "06:00 AM",
          tagline: "Morning Chill & Ground Condensation",
          temp: dawnTemp,
          feelsLike: dawnTemp - 1,
          icon: <Sun size={20} className="text-[#C9822B]" />,
          telemetry: [
            {
              label: "Ground Condensation",
              value: dewRisk,
              color: dewColor,
              icon: <Droplets size={14} className="text-[#1F6FB2]" />,
              note: tempMin <= 9 ? "Ground tarp under tent floor essential to prevent damp seep." : "Standard tent floor adequate."
            },
            {
              label: "Morning Breeze",
              value: `${Math.round(windSpeed * 0.5)} km/h`,
              color: "text-[#1E2A24]",
              icon: <Wind size={14} className="text-[#536259]" />,
              note: "Gentle morning valley airflow."
            },
            {
              label: "Sunrise Light",
              value: "Soft Diffuse",
              color: "text-[#C9822B]",
              icon: <Sun size={14} className="text-[#C9822B]" />,
              note: "Ideal for camp wake-up and brewing coffee."
            },
            {
              label: "Clothing Layer",
              value: dawnTemp < 10 ? "Fleece + Thermal" : "Light Layer",
              color: "text-[#2F5D50] font-bold",
              icon: <ShieldCheck size={14} className="text-[#2F5D50]" />,
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
          icon: <Sun size={20} className="text-[#C9822B]" />,
          telemetry: [
            {
              label: "Solar UV Index",
              value: `${uvIndex} (${uvWarning})`,
              color: uvIndex >= 8 ? "text-[#A83232] font-bold" : "text-[#C9822B]",
              icon: <Sun size={14} className="text-[#C9822B]" />,
              note: uvIndex >= 8 ? "Pitch tarp/gazebo for canopy shade; SPF 50+ mandatory." : "Standard sun protection."
            },
            {
              label: "Hydration Need",
              value: middayTemp >= 28 ? "High (3L/person)" : "Moderate (2L/person)",
              color: middayTemp >= 28 ? "text-[#C9822B] font-bold" : "text-[#2F5D50]",
              icon: <Droplets size={14} className="text-[#1F6FB2]" />,
              note: "Keep water cool under shaded tent fly."
            },
            {
              label: "Peak Wind",
              value: `${windSpeed} km/h`,
              color: windSpeed > 25 ? "text-[#C9822B] font-bold" : "text-[#1E2A24]",
              icon: <Wind size={14} className="text-[#536259]" />,
              note: windSpeed > 25 ? "Secure awning guy lines before heading on trails." : "Calm midday breeze."
            },
            {
              label: "Rain Probability",
              value: `${precipProb}%`,
              color: precipProb > 40 ? "text-[#1F6FB2] font-bold" : "text-[#2F5D50]",
              icon: <CloudRain size={14} className="text-[#1F6FB2]" />,
              note: precipProb > 40 ? "Pack rain gear for afternoon walk." : "Low precipitation risk."
            }
          ]
        };
      }
      case "dusk": {
        const duskTemp = Math.round(tempMax * 0.6 + tempMin * 0.4);
        const fireSafe = windSpeed <= 15 ? "Prime Fire Conditions" : windSpeed <= 25 ? "Breezy: Use Shielded Fire Pit" : "High Wind Hazard (No Open Fire)";
        const fireColor = windSpeed <= 15 ? "text-[#2F5D50] font-bold" : windSpeed <= 25 ? "text-[#C9822B]" : "text-[#A83232] font-bold";
        return {
          phaseName: "Dusk",
          timeLabel: "06:30 PM",
          tagline: "Campfire Window & Temperature Transition",
          temp: duskTemp,
          feelsLike: duskTemp,
          icon: <Flame size={20} className="text-[#C9822B]" />,
          telemetry: [
            {
              label: "Campfire Safety Factor",
              value: fireSafe,
              color: fireColor,
              icon: <Flame size={14} className="text-[#C9822B]" />,
              note: windSpeed > 25 ? "Embers can ignite dry bush; use gas stove only." : "Verify current local park fire ban."
            },
            {
              label: "Cooling Rate",
              value: "Rapid (-2°C / hr)",
              color: "text-[#1F6FB2]",
              icon: <Thermometer size={14} className="text-[#1F6FB2]" />,
              note: "Zip up inner tent mesh before insects gather at dusk."
            },
            {
              label: "Cooking Breeze",
              value: `${Math.round(windSpeed * 0.75)} km/h`,
              color: "text-[#1E2A24]",
              icon: <Wind size={14} className="text-[#536259]" />,
              note: "Set up windbreak around camping stove."
            },
            {
              label: "Sunset Ambience",
              value: "Golden Hour Glow",
              color: "text-[#C9822B]",
              icon: <Sun size={14} className="text-[#C9822B]" />,
              note: "Best window for campsite photos and settling in."
            }
          ]
        };
      }
      case "night":
      default: {
        const nightTemp = tempMin;
        let sleepRating = currentData.sleepingBagRating || "10°C Comfort Bag";
        let sleepColor = "text-[#2F5D50] font-bold";
        let sleepNote = currentData.matRValue 
          ? `Physics-modeled requirement: R-value ≥ ${currentData.matRValue} insulated sleeping pad.`
          : "Comfortable standard sleeping bag and uninsulated mat.";

        if (!currentData.sleepingBagRating) {
          if (nightTemp <= 4) {
            sleepRating = "❄️ 0°C Rated Bag + R4+ Mat";
            sleepColor = "text-[#1F6FB2] font-bold";
            sleepNote = "Cold air sinks in valley floor. Insulated sleeping pad is vital to block ground freeze.";
          } else if (nightTemp <= 10) {
            sleepRating = "🏕️ 5°C 3-Season Bag";
            sleepColor = "text-[#2F5D50] font-bold";
            sleepNote = "Standard thermal base layer and beanie recommended for sound sleep.";
          } else if (nightTemp >= 18) {
            sleepRating = "🌙 Summer Sheet / Open Quilt";
            sleepColor = "text-[#C9822B]";
            sleepNote = "Warm overnight conditions; keep tent mesh vented for airflow.";
          }
        } else {
          if (nightTemp <= 4) sleepColor = "text-[#1F6FB2] font-bold";
          else if (nightTemp <= 10) sleepColor = "text-[#2F5D50] font-bold";
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
    { id: "dawn", label: "Dawn", icon: <Sun size={13} className="text-[#C9822B]" />, time: "06:00" },
    { id: "midday", label: "Midday", icon: <Sun size={13} className="text-[#C9822B]" />, time: "13:00" },
    { id: "dusk", label: "Dusk", icon: <Flame size={13} className="text-[#C9822B]" />, time: "18:30" },
    { id: "night", label: "Night", icon: <Moon size={13} className="text-[#1F6FB2]" />, time: "23:00" },
  ];

  return (
    <div className="w-full shrink-0 bg-[#FAF6EF] rounded-2xl p-3.5 border border-[#E2DAC8] shadow-xs flex flex-col gap-3 transition-all text-[#1E2A24]">
      {/* HEADER: MODE TOGGLE & LIVE TELEMETRY BADGE */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E2DAC8] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFFFF] border border-[#E2DAC8] text-xs font-bold text-[#1E2A24]">
            <Activity size={13} className="text-[#2F5D50]" />
            <span>Atmospheric Telemetry</span>
          </div>

          {mode === "predictive" ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#8A5818] bg-[#FFF9EE] px-2 py-0.5 rounded-full border border-[#F0D5A8]">
              <Sparkles size={11} className="text-[#C9822B]" /> Climatology AI
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#2F5D50] bg-[#EBF2EE] px-2 py-0.5 rounded-full border border-[#2F5D50]/20">
              <Zap size={11} className="text-[#2F5D50]" /> Live Radar Sync
            </span>
          )}
        </div>

        {/* MODE SWITCHER */}
        <div className="flex items-center bg-[#F6F1E7] p-0.5 rounded-lg border border-[#E2DAC8] text-[11px] font-semibold">
          <button
            onClick={() => setMode("live")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
              mode === "live"
                ? "bg-[#2F5D50] text-white font-bold shadow-xs"
                : "text-[#536259] hover:text-[#1E2A24]"
            }`}
          >
            ⚡ Live
          </button>
          <button
            onClick={handlePredictiveMode}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              mode === "predictive"
                ? "bg-[#C9822B] text-white font-bold shadow-xs"
                : "text-[#536259] hover:text-[#1E2A24]"
            }`}
            title="Seasonal Microclimate Prediction for Future Trip Dates"
          >
            🔮 Future Date
          </button>
        </div>
      </div>

      {/* CLIMATOLOGY ALERT BANNER IF IN PREDICTIVE MODE */}
      {mode === "predictive" && (
        <div className="bg-[#FFF9EE] border border-[#F0D5A8] rounded-xl p-2.5 text-xs text-[#8A5818] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={14} className="text-[#C9822B] shrink-0" />
            <span className="font-bold text-[#1E2A24] text-xs">Trip Date:</span>
            <input 
              type="date"
              value={targetDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const val = e.target.value;
                setTargetDate(val);
                if (onDateChange) onDateChange(val);
              }}
              className="bg-[#FFFFFF] border border-[#E2DAC8] text-[#1E2A24] text-xs font-semibold rounded-lg px-2.5 py-1 outline-none focus:border-[#2F5D50] cursor-pointer"
            />
            {targetDate && (
              <span className="text-[11px] text-[#8A5818] font-medium">
                ({new Date(targetDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8A5818] bg-[#FFFFFF] px-2 py-0.5 rounded-full font-mono font-bold border border-[#F0D5A8]">
              P10-P90 Climatology Analog
            </span>
          </div>
        </div>
      )}

      {/* MAIN ATMOSPHERIC SNAPSHOT DISPLAY */}
      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-[#536259] text-xs animate-pulse">
          <div className="w-6 h-6 border-2 border-[#2F5D50] border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing microclimate sensors & terrain data...</span>
        </div>
      ) : currentData && phaseTelemetry ? (
        <>
          {/* PRIMARY CURRENT READING CARD */}
          <div className="bg-[#FFFFFF] rounded-xl p-3 border border-[#E2DAC8] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#FAF6EF] border border-[#E2DAC8] flex items-center justify-center shadow-xs">
                {phaseTelemetry.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-[#1E2A24] tracking-tight">{phaseTelemetry.temp}°C</span>
                  <span className="text-xs text-[#536259] font-mono">Feels {phaseTelemetry.feelsLike}°C</span>
                </div>
                <div className="text-xs font-bold text-[#2F5D50] flex items-center gap-1.5">
                  <span>{currentData.description}</span>
                  <span className="text-[#E2DAC8]">•</span>
                  <span className="text-[#536259] font-medium">{phaseTelemetry.tagline}</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-[#536259] font-semibold">{phaseTelemetry.phaseName} Phase</div>
              <div className="text-sm font-black text-[#1E2A24] font-mono">{phaseTelemetry.timeLabel}</div>
            </div>
          </div>

          {/* PHASE 3: AI CAMPING CONDITION SYNTHESIS BRIEFING */}
          {currentData.aiConditionSummary && (
            <div className="bg-[#FFFFFF] border border-[#2F5D50]/20 rounded-xl p-3 shadow-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2F5D50] uppercase tracking-wider">
                  <Sparkles size={12} className="text-[#2F5D50]" />
                  <span>Camper Condition Synthesis</span>
                </div>
                <span className="text-[9px] font-mono font-bold text-[#2F5D50] bg-[#EBF2EE] px-1.5 py-0.5 rounded border border-[#2F5D50]/20">
                  Microclimate Model
                </span>
              </div>
              <p className="text-xs text-[#536259] leading-relaxed font-medium">
                {currentData.aiConditionSummary}
              </p>
            </div>
          )}

          {/* INTERACTIVE 24-HOUR CAMPING DIURNAL SCRUBBER */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#536259] px-1">
              <span className="font-bold text-[#1E2A24]">Camping Diurnal Cycle</span>
              <span className="text-[10px] text-[#2F5D50] font-semibold">Tap phase to inspect</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 bg-[#FFFFFF] p-1 rounded-xl border border-[#E2DAC8]">
              {PHASES.map(p => {
                const isActive = activePhase === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePhase(p.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all text-center cursor-pointer ${
                      isActive
                        ? "bg-[#2F5D50] text-white font-bold shadow-xs border border-[#2F5D50]"
                        : "text-[#536259] hover:text-[#1E2A24] hover:bg-[#FAF6EF]"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[11px]">
                      {p.icon}
                      <span>{p.label}</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-80 mt-0.5">{p.time}</span>
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
                className="bg-[#FFFFFF] hover:bg-[#FAF6EF]/60 transition-colors rounded-xl p-2.5 border border-[#E2DAC8] flex flex-col justify-between gap-1 shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-[#536259]">
                  <span className="truncate font-medium">{t.label}</span>
                  <span className="shrink-0">{t.icon}</span>
                </div>
                <div className={`text-xs md:text-sm font-bold truncate ${t.color}`}>
                  {t.value}
                </div>
                <div className="text-[10px] text-[#536259] leading-tight line-clamp-2 mt-0.5">
                  {t.note}
                </div>
              </div>
            ))}
          </div>

          {/* QUICK SUMMARY EXPANDER (MICROCLIMATE & ELEVATION INSIGHTS) */}
          <div className="pt-1">
            <button
              onClick={() => setExpandedDetails(!expandedDetails)}
              className="w-full text-[11px] text-[#536259] hover:text-[#1E2A24] flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#FFFFFF] border border-[#E2DAC8] transition-all cursor-pointer shadow-xs"
            >
              <span className="font-bold flex items-center gap-1.5 text-[#1E2A24]">
                <Thermometer size={13} className="text-[#2F5D50]" />
                <span>Microclimate Envelope & Terrain Impact</span>
              </span>
              <span className="text-xs font-mono font-semibold">{expandedDetails ? "▲ Hide" : "▼ Expand"}</span>
            </button>

            {expandedDetails && (
              <div className="mt-2 p-3 rounded-xl bg-[#FFFFFF] border border-[#E2DAC8] text-xs text-[#536259] space-y-2 shadow-xs">
                <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-[#E2DAC8]">
                  <div>
                    <span className="text-[10px] text-[#536259] block">Day High</span>
                    <strong className="text-[#1E2A24] text-sm font-bold">{currentData.tempMax}°C</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#536259] block">Night Low</span>
                    <strong className="text-[#1F6FB2] text-sm font-bold">{currentData.tempMin}°C</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#536259] block">Max Wind</span>
                    <strong className="text-[#C9822B] text-sm font-bold">{currentData.windSpeed} km/h</strong>
                  </div>
                </div>

                <div className="text-[11px] text-[#536259] space-y-1.5">
                  {currentData.terrainNotes && currentData.terrainNotes.length > 0 ? (
                    currentData.terrainNotes.map((note, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#2F5D50] shrink-0 font-bold">•</span>
                        <span>{note}</span>
                      </div>
                    ))
                  ) : (
                    <div key="terrain-default" className="flex items-start gap-1.5">
                      <span className="text-[#2F5D50] shrink-0 font-bold">•</span>
                      <span>
                        <strong className="text-[#1E2A24]">Terrain Factor ({campsiteName || "Campground"}):</strong> {campsiteElevation ? `~${campsiteElevation}m elevation` : "Valley basin"}. Expect overnight temperature inversion where cold air settles in low-lying campsite zones.
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-1.5 pt-1 border-t border-[#E2DAC8]/60 text-[#8A5818]">
                    <AlertTriangle size={13} className="text-[#C9822B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#8A5818]">Packing Rule:</strong> Always prepare for night temperatures 3°C to 5°C colder than regional town forecasts.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-4 text-center text-xs text-[#536259] flex flex-col items-center gap-1">
          <AlertTriangle size={16} className="text-[#C9822B]" />
          <span>Live atmospheric feed unavailable. Check park alerts prior to departure.</span>
        </div>
      )}
    </div>
  );
}
