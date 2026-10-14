import React from "react";
import { Sun, CloudRain, Wind, Sparkles, Radio } from "lucide-react";

interface WeatherDay {
  dayName: string;
  dateStr: string;
  minTemp: number;
  maxTemp: number;
  rainProb: number;
  gearRecommendation: string;
  conditionIcon: "sun" | "rain" | "wind";
}

interface WeekendWeatherRibbonProps {
  campsiteName: string;
  isForecastWindow: boolean; // true if within 14-day window, false if climatology analog
  tripStartDate?: string;
  days?: WeatherDay[];
}

export default function WeekendWeatherRibbon({
  campsiteName,
  isForecastWindow,
  tripStartDate,
  days
}: WeekendWeatherRibbonProps) {
  // Generate representative 4-day weekend (Fri -> Mon) if not provided
  const sampleDays: WeatherDay[] = days || [
    { dayName: "Fri", dateStr: "Oct 17", minTemp: 13, maxTemp: 23, rainProb: 15, gearRecommendation: "15°C Summer Bag", conditionIcon: "sun" },
    { dayName: "Sat", dateStr: "Oct 18", minTemp: 14, maxTemp: 24, rainProb: 20, gearRecommendation: "15°C Summer Bag", conditionIcon: "sun" },
    { dayName: "Sun", dateStr: "Oct 19", minTemp: 11, maxTemp: 21, rainProb: 35, gearRecommendation: "10°C Mid-Season Bag", conditionIcon: "rain" },
    { dayName: "Mon", dateStr: "Oct 20", minTemp: 12, maxTemp: 22, rainProb: 10, gearRecommendation: "15°C Summer Bag", conditionIcon: "sun" }
  ];

  return (
    <div className="bg-black/50 border border-white/10 rounded-xl p-3 flex flex-col gap-2.5">
      {/* SOURCE & HONESTY HEADER */}
      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-white/10">
        <div className="flex items-center gap-1.5 font-bold">
          {isForecastWindow ? (
            <>
              <Radio size={13} className="text-emerald-400 animate-pulse" />
              <span className="text-emerald-300">Live Numerical Forecast (BOM / Open-Meteo)</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-sky-400" />
              <span className="text-sky-300">30-Year Climatological Historical Normal (Model Analog)</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-gray-400">
          {campsiteName} • {tripStartDate ? `Target: ${tripStartDate}` : "Upcoming Weekend"}
        </span>
      </div>

      {/* 4-DAY WEATHER TILES */}
      <div className="grid grid-cols-4 gap-1.5">
        {sampleDays.map((d, idx) => (
          <div
            key={idx}
            className="bg-black/30 border border-white/5 rounded-lg p-2 flex flex-col items-center text-center gap-1 hover:border-emerald-500/30 transition-all"
          >
            <span className="text-[10px] font-black uppercase text-gray-400">
              {d.dayName}
            </span>
            <span className="text-[9px] text-gray-500">{d.dateStr}</span>

            <div className="my-0.5">
              {d.conditionIcon === "sun" ? (
                <Sun size={18} className="text-amber-400" />
              ) : d.conditionIcon === "rain" ? (
                <CloudRain size={18} className="text-blue-400" />
              ) : (
                <Wind size={18} className="text-cyan-400" />
              )}
            </div>

            <div className="text-xs font-bold text-white">
              {d.maxTemp}° / <span className="text-gray-400 text-[10px]">{d.minTemp}°</span>
            </div>

            <div className="text-[10px] text-blue-300 font-medium flex items-center gap-0.5">
              💧 {d.rainProb}%
            </div>

            <div className="mt-1 pt-1 border-t border-white/5 text-[9px] text-emerald-300/90 font-medium leading-tight">
              🎒 {d.gearRecommendation.replace(" Bag", "")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
