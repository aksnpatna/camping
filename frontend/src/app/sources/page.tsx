import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ExternalLink, Database, Flame, CloudSun, Map } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sources & Licences | Camp Smart Australia",
  description: "Complete list of authoritative public datasets, emergency fire feeds, meteorological models, and open-source cartography powering Camp Smart Australia.",
};

interface DatasetSource {
  name: string;
  category: "campsites" | "fire" | "weather" | "cartography";
  publisher: string;
  license: string;
  licenseUrl?: string;
  sourceUrl?: string;
  description: string;
  attribution: string;
}

const SOURCES: DatasetSource[] = [
  {
    name: "National & State Park Spatial Registries",
    category: "campsites",
    publisher: "NSW NPWS, Parks Victoria, QPWS (QLD), DBCA (WA), SA NPWS, Tasmania PWS, NT Parks",
    license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    description: "Statutory boundaries, designated camping precincts, national park management identities, and published facility guidelines.",
    attribution: "Derived from official state park authority open-data registers under CC-BY 4.0."
  },
  {
    name: "OpenStreetMap (OSM) Geographic Baseline",
    category: "cartography",
    publisher: "OpenStreetMap Foundation & Contributors",
    license: "Open Database License (ODbL) 1.0",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/",
    sourceUrl: "https://www.openstreetmap.org",
    description: "Public road geometry, unsealed trail categorisation, and track access clearance. Kept in a strictly separable layer in compliance with ODbL.",
    attribution: "© OpenStreetMap contributors. Data available under the Open Database License."
  },
  {
    name: "Australian Fire Danger Rating System (AFDRS) Feeds",
    category: "fire",
    publisher: "NSW RFS, CFA Victoria, QFD (QLD), CFS (SA), DFES (WA), TFS (TAS)",
    license: "Government Open Data / Public Safety Feeds",
    description: "Live fire danger ratings (FDR) and statutory Total Fire Ban (TOBAN) declarations fetched directly from state emergency jurisdictions.",
    attribution: "Live state emergency feeds monitored in real time. If feeds degrade or disconnect, Camp Smart immediately displays an explicit status unavailable notice."
  },
  {
    name: "Synoptic Meteorological Observations & Forecasts",
    category: "weather",
    publisher: "Bureau of Meteorology (BOM) & Open-Meteo",
    license: "CC BY 4.0 / Open-Meteo Weather API",
    licenseUrl: "https://open-meteo.com/en/terms",
    sourceUrl: "http://www.bom.gov.au",
    description: "Numerical weather prediction, synoptic rain probabilities, wind gusts, and 30-year climatology analog models for long-range trips.",
    attribution: "Bureau of Meteorology public meteorological data combined with Open-Meteo ensemble forecasts."
  },
  {
    name: "CARTO Positron Vector Tiles",
    category: "cartography",
    publisher: "CARTO & MapLibre GL",
    license: "Creative Commons Attribution 4.0 (CC BY 4.0)",
    licenseUrl: "https://carto.com/basemaps/",
    description: "High-contrast, printed-paper aesthetic vector basemap rendered through client-side MapLibre GL WebGL shaders.",
    attribution: "© CARTO, © OpenStreetMap contributors."
  }
];

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-eucalypt selection:text-paper">
      {/* HEADER */}
      <header className="w-full bg-paper-tint border-b border-paper-rule px-6 py-3.5 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-eucalypt hover:text-ink transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back to Trip Finder</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="font-serif text-sm font-bold tracking-tight text-ink">CAMP SMART</span>
            <span className="t-micro text-ink-muted font-mono">AU</span>
          </div>
        </div>
      </header>

      {/* CONTENT HERO */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-paper-card rounded-sm p-6 sm:p-10 border border-paper-rule shadow-xs mb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-eucalypt-tint text-eucalypt border border-eucalypt/30 text-xs font-semibold mb-3">
            <ShieldCheck size={14} />
            <span>Authoritative provenance & licence compliance</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
            Sources & Licences
          </h1>
          <p className="text-ink-muted text-sm sm:text-base leading-relaxed max-w-2xl">
            Camp Smart Australia is built on an answer-first principle: every campground recommendation, fire rating, and microclimate warning states where the data came from. We do not generate synthetic facts.
          </p>
          <div className="t-data text-xs text-ink-faint mt-4">
            Last Updated: October 2026 • Public Provenance Register
          </div>
        </div>

        {/* SOURCES LIST */}
        <div className="space-y-6 mb-10">
          {SOURCES.map((src, idx) => (
            <div key={idx} className="bg-paper-card border border-paper-rule rounded-sm p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {src.category === "campsites" && <Database size={16} className="text-eucalypt" />}
                  {src.category === "fire" && <Flame size={16} className="text-clay" />}
                  {src.category === "weather" && <CloudSun size={16} className="text-ochre" />}
                  {src.category === "cartography" && <Map size={16} className="text-ink-muted" />}
                  <h2 className="font-serif text-base font-semibold text-ink">{src.name}</h2>
                </div>
                <span className="t-micro text-ink-faint">{src.license}</span>
              </div>

              <div className="t-data text-xs text-ink-muted mb-3">
                Publisher: <strong className="text-ink">{src.publisher}</strong>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed mb-4">
                {src.description}
              </p>

              <div className="pt-3 border-t border-paper-rule/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-[11px] text-ink-faint italic">{src.attribution}</span>
                {src.licenseUrl && (
                  <a
                    href={src.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-eucalypt hover:underline shrink-0"
                  >
                    <span>View licence</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* DATA TRUTH GUARANTEE */}
        <div className="bg-paper-tint border border-paper-rule rounded-sm p-6 text-xs text-ink-muted space-y-2">
          <h3 className="font-serif text-sm font-semibold text-ink">Our Data Truth Policy</h3>
          <p className="leading-relaxed">
            When facility records (water, toilets, campfires, or vehicle clearance) are missing from park registries, Camp Smart Australia deliberately marks them as <em>&ldquo;Not verified yet&rdquo;</em> or <em>&ldquo;Clearance not recorded&rdquo;</em>. We never infer, invent, or hallucinate missing ground conditions.
          </p>
          <div className="pt-3 flex items-center justify-between">
            <Link href="/" className="text-xs font-semibold text-eucalypt hover:underline">
              &larr; Return to Trip Finder
            </Link>
            <Link href="/terms" className="text-xs font-semibold text-ink-muted hover:text-ink">
              Terms of Service
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
