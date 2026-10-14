import React from "react";
import { Sun, CloudRain, Wind, Sparkles, Radio, Droplets, Backpack } from "lucide-react";

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
    { dayName: "Fri", dateStr: "Oct 17", minTemp: 13, maxTemp: 23, rainProb: 15, gearRecommendation: "15°C Quilt", conditionIcon: "sun" },
    { dayName: "Sat", dateStr: "Oct 18", minTemp: 14, maxTemp: 24, rainProb: 20, gearRecommendation: "15°C Quilt", conditionIcon: "sun" },
    { dayName: "Sun", dateStr: "Oct 19", minTemp: 11, maxTemp: 21, rainProb: 35, gearRecommendation: "10°C Bag", conditionIcon: "rain" },
    { dayName: "Mon", dateStr: "Oct 20", minTemp: 12, maxTemp: 22, rainProb: 10, gearRecommendation: "15°C Quilt", conditionIcon: "sun" }
  ];

  return (
    <div className="bg-[#FAF6EF] border border-[#E2DAC8] rounded-xl p-3 flex flex-col gap-2.5 text-[#1E2A24] shadow-xs">
      {/* SOURCE & HONESTY HEADER */}
      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#E2DAC8]">
        <div className="flex items-center gap-1.5 font-bold">
          {isForecastWindow ? (
            <>
              <Radio size={13} className="text-[#2F5D50]" />
              <span className="text-[#2F5D50]">Live Synoptic Forecast (BOM / Open-Meteo)</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-[#1F6FB2]" />
              <span className="text-[#1F6FB2]">30-Yr Climatology Normal (Model Analog)</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-[#536259]">
          {campsiteName} • {tripStartDate ? `Target: ${tripStartDate}` : "Upcoming Weekend"}
        </span>
      </div>

      {/* 4-DAY WEATHER TILES */}
      <div className="grid grid-cols-4 gap-1.5">
        {sampleDays.map((d, idx) => (
          <div
            key={idx}
            className="bg-[#FFFFFF] border border-[#E2DAC8] rounded-xl p-2 flex flex-col items-center text-center gap-1 hover:border-[#2F5D50]/50 transition-all shadow-2xs"
          >
            <span className="text-[10px] font-bold uppercase text-[#1E2A24]">
              {d.dayName}
            </span>
            <span className="text-[9px] text-[#8B9891]">{d.dateStr}</span>

            <div className="my-0.5">
              {d.conditionIcon === "sun" ? (
                <Sun size={18} className="text-[#C9822B]" />
              ) : d.conditionIcon === "rain" ? (
                <CloudRain size={18} className="text-[#1F6FB2]" />
              ) : (
                <Wind size={18} className="text-[#2F5D50]" />
              )}
            </div>

            <div className="text-xs font-black text-[#1E2A24]">
              {d.maxTemp}° / <span className="text-[#8B9891] font-semibold text-[10px]">{d.minTemp}°</span>
            </div>

            <div className="text-[10px] text-[#1F6FB2] font-semibold flex items-center gap-0.5">
              <Droplets size={10} /> {d.rainProb}%
            </div>

            <div className="mt-1 pt-1 border-t border-[#E2DAC8] text-[9px] text-[#2F5D50] font-bold leading-tight flex items-center gap-1">
              <Backpack size={10} /> {d.gearRecommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
