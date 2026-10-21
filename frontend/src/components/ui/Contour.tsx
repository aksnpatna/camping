"use client";

import React, { useMemo } from "react";

export interface ContourProps {
  latitude: number;
  longitude: number;
  className?: string;
  height?: number;
}

// Simple deterministic integer hash
function hashCoords(lat: number, lng: number): number {
  const rLat = Math.round(lat * 1000);
  const rLng = Math.round(lng * 1000);
  let h = (rLat * 73856093) ^ (rLng * 19349663);
  h = (h ^ (h >> 13)) * 0x5bd1e995;
  return Math.abs(h ^ (h >> 15));
}

// Deterministic PRNG from seed
function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Contour({
  latitude,
  longitude,
  className = "",
  height = 64
}: ContourProps) {
  const paths = useMemo(() => {
    const seed = hashCoords(latitude, longitude);
    const rand = pseudoRandom(seed);

    // Number of harmonic frequencies
    const harmonics = [
      { k: 2, a: 0.08 + rand() * 0.06, phi: rand() * Math.PI * 2 },
      { k: 3, a: 0.05 + rand() * 0.05, phi: rand() * Math.PI * 2 },
      { k: 5, a: 0.02 + rand() * 0.03, phi: rand() * Math.PI * 2 }
    ];

    const cx = 160;
    const cy = height / 2;
    const rings = 6;
    const baseStep = Math.min(cx, cy * 2.5) / (rings + 1.5);

    const generatedPaths: string[] = [];

    for (let r = 1; r <= rings; r++) {
      const baseR = r * baseStep;
      const points: [number, number][] = [];
      const steps = 48;

      for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        let perturbation = 0;
        for (const h of harmonics) {
          perturbation += h.a * Math.sin(h.k * theta + h.phi);
        }
        const radius = baseR * (1 + perturbation);
        // Slight oval distortion for landscape feel
        const x = cx + radius * 1.6 * Math.cos(theta);
        const y = cy + radius * 0.85 * Math.sin(theta);
        points.push([x, y]);
      }

      // Build smooth closed SVG path
      if (points.length > 0) {
        let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
        }
        d += " Z";
        generatedPaths.push(d);
      }
    }

    return generatedPaths;
  }, [latitude, longitude, height]);

  return (
    <div
      className={`w-full overflow-hidden pointer-events-none select-none relative bg-paper-sunk/30 ${className}`}
      style={{ height }}
      aria-hidden="true"
      title="Stationery motif derived from campsite coordinates"
    >
      <svg
        viewBox={`0 0 320 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full stroke-ink"
        style={{ opacity: 0.09 }}
        fill="none"
      >
        {paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            strokeWidth={idx % 2 === 0 ? "1" : "0.75"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

export default Contour;
