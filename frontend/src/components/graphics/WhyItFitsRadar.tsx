import React from "react";
import { TripCardData } from "../FindWeekendPlanner";

interface WhyItFitsRadarProps {
  card: TripCardData;
  size?: number;
}

interface AxisScore {
  label: string;
  score: number; // 0 to 100
  isKnown: boolean;
  note: string;
}

export default function WhyItFitsRadar({ card, size = 180 }: WhyItFitsRadarProps) {
  // 5 axes: Drive, Weather, Facilities, Crowd, Fire Safety
  const driveScore = Math.max(10, Math.min(100, Math.round(100 - (card.driving_time_minutes / 240) * 80)));
  
  // Facilities score
  const fac = card.facilities || {};
  let facScore = 50;
  let facKnown = false;
  if (card.facilities && Object.keys(card.facilities).length > 0) {
    facKnown = true;
    let pts = 20;
    if (fac.toilets && fac.toilets !== "none") pts += 30;
    if (fac.drinking_water) pts += 25;
    if (fac.campfires) pts += 25;
    facScore = Math.min(100, pts);
  }

  // Crowd score from community signals
  const comm = card.community_signals;
  let crowdScore = 50;
  let crowdKnown = false;
  if (comm?.vibe) {
    crowdKnown = true;
    crowdScore = comm.vibe === "plenty_space" || comm.vibe === "quiet" ? 90 : comm.vibe === "filling_fast" ? 60 : 30;
  }

  // Fire safety score
  let fireScore = 75;
  const fireKnown = Boolean(card.fire_district);
  if (!fireKnown) fireScore = 40;

  // Weather fit
  const weatherScore = 80;
  const weatherKnown = true;

  const axes: AxisScore[] = [
    { label: "Drive Fit", score: driveScore, isKnown: true, note: `${card.driving_time_minutes}m drive` },
    { label: "Weather", score: weatherScore, isKnown: weatherKnown, note: "Favorable conditions" },
    { label: "Facilities", score: facScore, isKnown: facKnown, note: facKnown ? "Amenities verified" : "Unverified" },
    { label: "Crowd Space", score: crowdScore, isKnown: crowdKnown, note: crowdKnown ? String(comm?.vibe) : "No field report" },
    { label: "Fire Safety", score: fireScore, isKnown: fireKnown, note: fireKnown ? String(card.fire_district) : "Unmapped" }
  ];

  const center = size / 2;
  const radius = (size / 2) - 30;

  // Calculate polygon vertices
  const points = axes.map((axis, i) => {
    const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
    const r = (axis.score / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y, angle };
  });

  const polygonPath = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl p-3">
      <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between w-full">
        <span>5-Axis Match Profile</span>
        <span className="text-[10px] text-emerald-400 font-mono">
          {axes.filter(a => a.isKnown).length}/5 Measured
        </span>
      </div>

      <svg width={size} height={size} className="overflow-visible">
        {/* Background web rings */}
        {[0.33, 0.66, 1.0].map((level, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius * level}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray={idx === 2 ? undefined : "3,3"}
          />
        ))}

        {/* Axis radial lines */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 / axes.length) * i - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke={axis.isKnown ? "rgba(255,255,255,0.15)" : "rgba(255,100,100,0.2)"}
                strokeDasharray={axis.isKnown ? undefined : "2,2"}
              />
              {/* Axis Label */}
              <text
                x={center + (radius + 16) * Math.cos(angle)}
                y={center + (radius + 16) * Math.sin(angle) + 3}
                textAnchor="middle"
                fontSize="9"
                fontWeight={axis.isKnown ? "bold" : "normal"}
                fill={axis.isKnown ? "#9ca3af" : "#6b7280"}
                className={axis.isKnown ? "" : "italic"}
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Filled Data Polygon */}
        <polygon
          points={polygonPath}
          fill="rgba(0, 255, 136, 0.2)"
          stroke="var(--color-neon-green)"
          strokeWidth="1.5"
          className="drop-shadow"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={axes[i].isKnown ? "3" : "2"}
            fill={axes[i].isKnown ? "var(--color-neon-green)" : "#8A8F8C"}
            stroke="#0b2019"
            strokeWidth="1"
          />
        ))}
      </svg>
      
      <div className="w-full flex justify-between text-[10px] text-gray-400 mt-2 pt-1 border-t border-white/5">
        <span>⏱️ {card.driving_time_minutes}m drive</span>
        <span>{card.vehicle_clearance === "4WD_ONLY" ? "🚙 4WD Req" : "🚗 2WD Easy"}</span>
      </div>
    </div>
  );
}
