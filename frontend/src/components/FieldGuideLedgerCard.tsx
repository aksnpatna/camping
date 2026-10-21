"use client";

import React from "react";
import { 
  Navigation, 
  Compass, 
  Bookmark, 
  Shuffle, 
  ClipboardList, 
  ExternalLink,
  Flame,
  MapPin,
  Sun,
  CloudRain,
  Wind,
  Droplets,
  Moon,
  Radio
} from "lucide-react";
import type { TripCardData, StartLocation } from "./FindWeekendPlanner";
import type { Fact } from "@/types/facts";
import Contour from "./ui/Contour";
import FactRow from "./ui/FactRow";
import Section from "./ui/Section";
import Button from "./ui/Button";


export interface FieldGuideLedgerCardProps {
  card: TripCardData;
  index?: number;
  isCompared?: boolean;
  isSavedOffline?: boolean;
  startLocation?: StartLocation | null;
  onToggleCompare?: (id: number) => void;
  onSaveOffline?: (card: TripCardData) => void;
  onOpenSaveModal?: (id: number, name: string) => void;
  onOpenPlanB?: (card: TripCardData) => void;
  onOpenPrep?: (site: { id: number; name: string }) => void;
  onOpenCheckIn?: (site: { id: number; name: string }) => void;
  onInspectFact?: (info: { fact: Fact; label: string; campsiteName: string }) => void;
  onSelectSiteOnMap?: (id: number) => void;
  className?: string;
}


export function FieldGuideLedgerCard({
  card,
  index,
  isCompared,
  isSavedOffline,
  startLocation,
  onToggleCompare,
  onSaveOffline,
  onOpenSaveModal,
  onOpenPlanB,
  onOpenPrep,
  onOpenCheckIn,
  onInspectFact,
  onSelectSiteOnMap,
  className = ""
}: FieldGuideLedgerCardProps) {

  const driveHours = Math.floor(card.driving_time_minutes / 60);
  const driveMins = card.driving_time_minutes % 60;
  const driveText = `${driveHours > 0 ? `${driveHours}h ` : ""}${driveMins}m drive · ${card.driving_distance_km} km`;

  const bookingLabel = 
    card.booking_type === "FIRST_COME_FIRST_SERVED"
      ? "No booking required"
      : card.booking_type === "ONLINE_BOOKING_REQUIRED"
      ? "Direct reservation required"
      : card.booking_type === "FREE_REGISTRATION_REQUIRED"
      ? "Free registration required"
      : "Booking unverified";

  // Navigation Links
  const originParam = startLocation?.latitude && startLocation?.longitude 
    ? `&origin=${startLocation.latitude},${startLocation.longitude}` 
    : "";
  const googleMapsUrl = originParam
    ? `https://www.google.com/maps/dir/?api=1${originParam}&destination=${card.latitude},${card.longitude}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${card.latitude},${card.longitude}`;
  const appleMapsUrl = startLocation?.latitude && startLocation?.longitude
    ? `https://maps.apple.com/?saddr=${startLocation.latitude},${startLocation.longitude}&daddr=${card.latitude},${card.longitude}&dirflg=d`
    : `https://maps.apple.com/?daddr=${card.latitude},${card.longitude}`;

  // Helper to trigger fact inspection
  const inspect = (label: string, fallbackFact: Fact) => {
    if (!onInspectFact) return;
    const fact = card.facts ? (card.facts as unknown as Record<string, Fact>)[label.toLowerCase()] || fallbackFact : fallbackFact;
    onInspectFact({ fact, label, campsiteName: card.name });
  };

  const clearanceValue =
    card.vehicle_clearance === "4WD_ONLY"
      ? "4WD Only"
      : card.vehicle_clearance === "2WD"
      ? "2WD Access"
      : card.rig_access && card.rig_access.length > 0
      ? card.rig_access.join(", ")
      : null;

  const dogValue =
    card.dog_friendly === true
      ? "Permitted"
      : card.dog_friendly === false
      ? "Not allowed"
      : null;

  const campfireValue =
    card.facts?.campfires?.value !== undefined && card.facts?.campfires?.value !== null
      ? (card.facts.campfires.value ? "Permitted" : "Prohibited")
      : card.facilities?.campfires !== undefined
      ? (card.facilities.campfires ? "Permitted" : "Prohibited")
      : null;

  const waterValue =
    card.facts?.water?.value
      ? String(card.facts.water.value)
      : card.facilities?.drinking_water !== undefined
      ? (card.facilities.drinking_water ? "Drinking water" : "None")
      : null;

  const toiletValue =
    card.facts?.toilets?.value
      ? String(card.facts.toilets.value)
      : card.facilities?.toilets
      ? String(card.facilities.toilets)
      : null;

  const telcoValue =
    card.facts?.telco?.value
      ? String(card.facts.telco.value)
      : card.visual_badges?.telco || null;

  const forecastLabel =
    card.forecast_source === "live"
      ? "Live forecast (BOM / Open-Meteo)"
      : "Typical for this date";

  return (
    <div
      className={`bg-paper-card border border-paper-rule rounded-md shadow-sheet hover:shadow-lifted transition-shadow flex flex-col justify-between overflow-hidden text-ink ${className}`}
    >
      {/* 1. CONTOUR MOTIF HEADER */}
      <div className="relative border-b border-paper-rule bg-paper-sunk/30">
        <Contour latitude={card.latitude} longitude={card.longitude} height={52} />
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between">
          <span className="t-micro text-ink-muted bg-paper-card/90 px-1.5 py-0.5 rounded-xs border border-paper-rule">
            {card.highlight_badge || (index !== undefined ? `Site 0${index + 1}` : "Field Guide")}
          </span>
          <div className="flex items-center gap-1">
            {onToggleCompare && (
              <button
                onClick={() => onToggleCompare(card.id)}
                className={`t-micro px-2 py-0.5 rounded-xs border transition-colors cursor-pointer ${
                  isCompared
                    ? "bg-eucalypt text-paper-card border-eucalypt"
                    : "bg-paper-card/90 text-ink-muted border-paper-rule hover:text-ink"
                }`}
                title="Compare attributes side-by-side"
              >
                {isCompared ? "Compared" : "+ Compare"}
              </button>
            )}
            {onSaveOffline && (
              <button
                onClick={() => onSaveOffline(card)}
                className={`t-micro px-2 py-0.5 rounded-xs border transition-colors cursor-pointer ${
                  isSavedOffline
                    ? "bg-ochre text-paper-card border-ochre"
                    : "bg-paper-card/90 text-ink-muted border-paper-rule hover:text-ink"
                }`}
                title={isSavedOffline ? "Saved offline" : "Save offline"}
              >
                {isSavedOffline ? "Saved" : "Offline"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CARD MASTHEAD */}
      <div className="p-4 pb-3 flex flex-col gap-1 border-b border-paper-rule/60">
        <div className="flex items-start justify-between gap-2">
          <h3 className="t-title text-lg font-semibold text-ink leading-snug">
            {card.name}
          </h3>
          <span className="t-data text-xs text-ink-muted px-1.5 py-0.5 bg-paper-sunk rounded-xs shrink-0 border border-paper-rule">
            {card.state}
          </span>
        </div>

        <p className="t-data text-xs text-ink-muted">
          {card.management_type || "Authority not recorded"}
        </p>

        <div className="pt-2 flex items-center justify-between text-xs t-data text-ink-muted border-t border-paper-rule/40 mt-1">
          <span>{driveText}</span>
          <span className="text-ink font-medium">{card.estimated_cost} · {bookingLabel}</span>
        </div>
      </div>

      {/* 3. CARD BODY (LEDGER SECTIONS) */}
      <div className="p-4 flex flex-col gap-3.5">
        {/* WHY IT FITS */}
        {card.why_it_fits && card.why_it_fits.length > 0 && (
          <Section title="Why it fits">
            <p className="t-body text-xs text-ink leading-relaxed">
              {card.why_it_fits.join(". ")}
            </p>
          </Section>
        )}

        {/* WATCH FOR (THE COMPROMISE) */}
        {card.main_compromise && (
          <Section title="Watch for">
            <p className="t-body text-xs text-ochre font-medium leading-relaxed">
              {card.main_compromise}
            </p>
          </Section>
        )}

        {/* CONDITIONS & CAMP CLIMATE */}
        <Section 
          title="Conditions & Climate"
          badge={
            <span className="t-data text-[10px] text-eucalypt font-medium flex items-center gap-1">
              <Radio size={10} className="text-eucalypt animate-pulse" />
              {forecastLabel}
            </span>
          }
        >
          <div className="flex flex-col gap-2 pt-0.5">
            {/* 4-Day Microclimate Tiles */}
            {card.weather_days && card.weather_days.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5">
                {card.weather_days.map((day, i) => {
                  const isRainy = day.conditionIcon === "rain" || day.rainProb >= 40;
                  const isWindy = day.conditionIcon === "wind";
                  return (
                    <div 
                      key={i} 
                      className="bg-paper-card border border-paper-rule rounded-xs p-1.5 text-center flex flex-col items-center justify-between shadow-2xs hover:border-eucalypt/40 transition-colors"
                    >
                      <div className="w-full flex items-center justify-between text-[10px] pb-1 border-b border-paper-rule/40">
                        <span className="t-label font-bold text-ink">{day.dayName}</span>
                        <span className="t-data text-ink-faint text-[9px]">{day.dateStr}</span>
                      </div>

                      <div className="my-1 flex items-center justify-center">
                        {isRainy ? (
                          <CloudRain size={18} className="text-trust-official" />
                        ) : isWindy ? (
                          <Wind size={18} className="text-eucalypt" />
                        ) : (
                          <Sun size={18} className="text-ochre" />
                        )}
                      </div>

                      <div className="t-data text-xs font-bold text-ink leading-none">
                        {day.maxTemp}° <span className="text-ink-faint font-normal text-[10.5px]">/ {day.minTemp}°</span>
                      </div>

                      <div className="w-full pt-1.5 mt-1 border-t border-paper-rule/40 flex items-center justify-between text-[10px] t-data">
                        <span className="text-trust-official font-medium flex items-center gap-0.5" title="Precipitation Probability">
                          <Droplets size={8.5} /> {day.rainProb}%
                        </span>
                        <span className="text-eucalypt font-medium flex items-center gap-0.5" title="Sleeping bag rating recommendation">
                          <Moon size={8.5} /> {day.gearRecommendation}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="t-data text-xs text-ink-faint italic py-1 bg-paper-sunk/30 px-2 rounded-xs border border-paper-rule">
                Forecast coordinates not resolved for this location
              </p>
            )}

            {/* Gear-Fit Bush Telemetry */}
            {card.gear_fit && (
              <div className="bg-paper-sunk/60 border border-paper-rule rounded-xs p-2.5 flex flex-col gap-1.5 text-xs font-sans">
                <div className="flex items-center justify-between border-b border-paper-rule/60 pb-1">
                  <span className="t-label text-[10px] font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Moon size={11} className="text-eucalypt" /> Sleep System Rating
                  </span>
                  <span className="t-data text-[11px] font-semibold text-eucalypt">
                    Min {card.gear_fit.overnight_min_temp}°C Overnight
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <span className="text-ink-muted font-medium">Bag:</span>
                    <span className="t-data text-ink font-semibold truncate" title={card.gear_fit.sleeping_bag_rating}>
                      {card.gear_fit.sleeping_bag_rating}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-ink-muted font-medium">Mat:</span>
                    <span className="t-data text-ink font-semibold">
                      R-Value {card.gear_fit.recommended_mat_r_value}+ Ground
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-paper-rule/40 flex flex-col gap-0.5 text-[10.5px] text-ink-muted t-data">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0"></span>
                    <span className="truncate">{card.gear_fit.campfire_wind_risk}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-trust-official shrink-0"></span>
                    <span className="truncate">{card.gear_fit.dew_frost_index}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Fire row */}
            <div className="flex items-center justify-between py-1 px-1.5 bg-ochre-tint/70 border border-ochre/25 rounded-xs text-xs">
              <span className="t-data text-[11px] text-ink flex items-center gap-1.5">
                <Flame size={12} className="text-ochre" />
                Fire: {card.fire_district || "District unmapped"} ({card.state})
              </span>
              <a
                href={
                  card.state === "NSW"
                    ? "https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans"
                    : card.state === "VIC"
                    ? "https://www.cfa.vic.gov.au/warnings-restrictions/total-fire-bans-fire-danger-ratings"
                    : "https://www.bom.gov.au"
                }
                target="_blank"
                rel="noreferrer"
                className="t-data text-[10px] text-ochre hover:underline flex items-center gap-0.5"
              >
                Agency feed <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </Section>

        {/* SITE FACTS LEDGER */}
        <Section title="Site facts">
          <div className="flex flex-col border border-paper-rule rounded-xs bg-paper-sunk/30 divide-y divide-paper-rule/60">
            <FactRow
              label="Access"
              value={clearanceValue}
              fact={card.facts?.vehicle_access}
              onInspect={() =>
                inspect("Vehicle Access", {
                  value: card.vehicle_clearance,
                  basis: card.vehicle_clearance === "UNVERIFIED" ? "unknown" : "official",
                  confidence: card.vehicle_clearance === "UNVERIFIED" ? 0 : 2,
                  note: clearanceValue ? `Clearance recorded: ${clearanceValue}` : "Clearance not recorded by park authority"
                })
              }
            />

            <FactRow
              label="Water"
              value={waterValue}
              fact={card.facts?.water}
              onInspect={() =>
                inspect("Water", {
                  value: waterValue,
                  basis: card.facilities?.drinking_water !== undefined ? "official" : "unknown",
                  confidence: card.facilities?.drinking_water !== undefined ? 2 : 0,
                  note: waterValue ? `Water status: ${waterValue}` : "Drinking water availability unrecorded — carry sufficient water"
                })
              }
            />

            <FactRow
              label="Toilets"
              value={toiletValue}
              fact={card.facts?.toilets}
              onInspect={() =>
                inspect("Toilets", {
                  value: toiletValue,
                  basis: card.facilities?.toilets ? "official" : "unknown",
                  confidence: card.facilities?.toilets ? 2 : 0,
                  note: toiletValue ? `Toilet type: ${toiletValue}` : "Toilet facilities unrecorded — carry hygiene supplies"
                })
              }
            />

            <FactRow
              label="Campfires"
              value={campfireValue}
              fact={card.facts?.campfires}
              onInspect={() =>
                inspect("Campfires", {
                  value: campfireValue,
                  basis: card.facilities?.campfires !== undefined ? "official" : "unknown",
                  confidence: card.facilities?.campfires !== undefined ? 2 : 0,
                  note: campfireValue ? `Campfires: ${campfireValue}` : "Campfire regulations unrecorded — observe total fire bans"
                })
              }
            />

            <FactRow
              label="Dogs"
              value={dogValue}
              fact={card.facts?.dog_friendly}
              onInspect={() =>
                inspect("Pet Policy", {
                  value: card.dog_friendly,
                  basis: card.dog_friendly !== null ? "rule" : "unknown",
                  confidence: card.dog_friendly !== null ? 3 : 0,
                  note: dogValue ? `Pet policy: ${dogValue}` : "Pet policy unrecorded — verify with local authority"
                })
              }
            />

            <FactRow
              label="Telco"
              value={telcoValue}
              fact={card.facts?.telco}
              onInspect={() =>
                inspect("Telco", {
                  value: telcoValue,
                  basis: telcoValue ? "community" : "unknown",
                  confidence: telcoValue ? 2 : 0,
                  note: telcoValue ? `Carrier signal: ${telcoValue}` : "Mobile coverage unrecorded — download offline maps before departure"
                })
              }
            />
          </div>

          {onOpenCheckIn && (
            <div className="pt-1 flex justify-end">
              <button
                onClick={() => onOpenCheckIn({ id: card.id, name: card.name })}
                className="t-data text-[11px] text-eucalypt hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Report conditions
              </button>
            </div>
          )}
        </Section>
      </div>


      {/* 4. FOOTER & ACTIONS */}
      <div className="p-4 pt-2 border-t border-paper-rule flex flex-col gap-2 bg-paper/50">
        <div className="flex items-center gap-2">
          {/* Direct GPS */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-paper-card border border-paper-rule rounded-sm text-xs t-label text-ink hover:bg-paper-sunk transition-colors"
          >
            <Navigation size={12} className="text-trust-official" /> Google Maps
          </a>
          <a
            href={appleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-paper-card border border-paper-rule rounded-sm text-xs t-label text-ink hover:bg-paper-sunk transition-colors"
          >
            <Compass size={12} className="text-eucalypt" /> Apple Maps
          </a>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {onOpenSaveModal && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenSaveModal(card.id, card.name)}
              className="flex-1"
            >
              <Bookmark size={13} /> Save & Monitor
            </Button>
          )}

          {onOpenPlanB && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenPlanB(card)}
              title="Inspect Plan B alternatives"
            >
              <Shuffle size={13} className="text-ochre" /> Plan B
            </Button>
          )}

          {onOpenPrep && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenPrep({ id: card.id, name: card.name })}
              title="Preparation checklist"
            >
              <ClipboardList size={13} className="text-eucalypt" /> Prep
            </Button>
          )}

          {onSelectSiteOnMap && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelectSiteOnMap(card.id)}
              title="View on Map"
            >
              <MapPin size={13} className="text-eucalypt" /> Map
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}

export default FieldGuideLedgerCard;
