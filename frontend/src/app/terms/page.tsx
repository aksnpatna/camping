import React from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Flame, CloudLightning, ShieldAlert, PhoneCall } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service & Bush Safety Disclaimers | Camp Smart Australia",
  description: "Terms of use, bushfire warnings, official emergency contacts, and conditions of service for Camp Smart Australia.",
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-clay-tint text-clay border border-clay/30 text-xs font-semibold mb-3">
            <AlertTriangle size={14} />
            <span>Mandatory bush safety & fire warning notice</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
            Terms of Service & Bush Safety
          </h1>
          <p className="text-ink-muted text-sm sm:text-base leading-relaxed max-w-2xl">
            Camp Smart Australia provides condition-aware algorithmic planning and alternative sites. Camping in the Australian wilderness involves genuine, inherent hazards. Please read these terms before embarking.
          </p>
          <div className="t-data text-xs text-ink-faint mt-4">
            Last Updated: October 2026 • Legal Terms of Use
          </div>
        </div>

        {/* EMERGENCY HOTLINES BANNER */}
        <div className="bg-paper-card text-ink p-6 rounded-sm shadow-xs mb-8 border border-paper-rule">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xs bg-clay-tint text-clay border border-clay/30">
              <PhoneCall size={20} />
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-ink">Australian Emergency Services Directory</h2>
              <p className="text-xs text-ink-muted">If you are in immediate life-threatening danger, dial Triple Zero immediately.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-paper-tint p-3 rounded-xs border border-paper-rule">
              <div className="font-bold text-clay text-sm mb-1">Emergency: 000</div>
              <p className="text-ink-muted">Police, Ambulance, Fire. (112 on mobile without carrier coverage).</p>
            </div>
            <div className="bg-paper-tint p-3 rounded-xs border border-paper-rule">
              <div className="font-bold text-ochre text-sm mb-1">SES Assistance: 132 500</div>
              <p className="text-ink-muted">State Emergency Service for flash floods, storm damage, and fallen trees.</p>
            </div>
            <div className="bg-paper-tint p-3 rounded-xs border border-paper-rule">
              <div className="font-bold text-eucalypt text-sm mb-1">Bushfire Information Lines</div>
              <p className="text-ink-muted">NSW RFS: 1800 679 737 | VIC VicEmergency: 1800 226 226 | QLD: 13 74 68</p>
            </div>
          </div>
        </div>

        {/* DETAILED TERMS & SAFETY RULES */}
        <div className="bg-paper-card rounded-sm p-6 sm:p-10 border border-paper-rule shadow-xs space-y-8 text-xs sm:text-sm leading-relaxed text-ink-muted">
          
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <Flame className="text-clay" size={18} />
              <span>1. Bushfire Danger & Total Fire Bans (Non-Negotiable)</span>
            </h2>
            <p className="mb-2.5">
              Australia experiences extreme bushfire weather. Campers are personally and legally responsible for verifying and complying with Total Fire Bans (TOBAN):
            </p>
            <ul className="space-y-2 pl-4 list-disc marker:text-clay">
              <li>
                <strong className="text-ink">Total Fire Bans Override Everything:</strong> When a Total Fire Ban is declared in a fire area or national park, NO wood fires, charcoal BBQs, or open flames are permitted anywhere outside, including in designated iron fire pits. Heavy criminal penalties apply under Australian state laws.
              </li>
              <li>
                <strong className="text-ink">Live Degradation Rule:</strong> If government emergency feeds (RFS, CFA, QFD) are unreachable or undergoing maintenance, Camp Smart deliberately renders an immediate &ldquo;Fire Status Unavailable&rdquo; warning. We never simulate or guess fire danger. In this event, campers must independently confirm status with local park rangers before lighting a campfire.
              </li>
              <li>
                <strong className="text-ink">Catastrophic Fire Days:</strong> Campgrounds located in districts under Extreme or Catastrophic Fire Danger Ratings should be immediately evacuated or avoided.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <CloudLightning className="text-eucalypt" size={18} />
              <span>2. Microclimate, Flash Floods & Weather Unpredictability</span>
            </h2>
            <p className="mb-2.5">
              Australian mountainous and coastal microclimates can change in minutes:
            </p>
            <ul className="space-y-2 pl-4 list-disc marker:text-eucalypt">
              <li>
                <strong className="text-ink">Riparian & Creek Flood Risks:</strong> Never pitch tents on dry riverbeds, low gravel sandbars, or beneath steep narrow catchments when rain is predicted anywhere upstream.
              </li>
              <li>
                <strong className="text-ink">Valley Inversion & Overnight Cold:</strong> Downscaled microclimate models show cold-air drainage pools in valley floors can plunge nocturnal temperatures 4°C to 8°C below town forecasts. Campers must pack sleeping bags with appropriate ISO/EN lower limits.
              </li>
              <li>
                <strong className="text-ink">Falling Branches (Widow-Makers):</strong> High winds and extreme drought cause Australian Eucalyptus and Gum trees to drop heavy limbs without warning. Never pitch under large overhanging limbs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <ShieldAlert className="text-eucalypt" size={18} />
              <span>3. Vehicle Clearance & Road Conditions</span>
            </h2>
            <p className="mb-2.5">
              Camp Smart tracks rig clearance recommendations (2WD friendly, high-clearance AWD, or low-range 4WD required).
            </p>
            <p className="mb-2.5">
              Gravel roads, unmaintained forestry trails, and river fords deteriorate rapidly after rainfall. Drivers are exclusively responsible for assessing corrugations, mud ruts, water depth, and tyre pressures. Never enter floodwaters in any vehicle.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>4. Informational Purpose & Limitation of Liability</span>
            </h2>
            <p className="mb-2.5">
              Camp Smart Australia is an automated advisory and planning tool provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis for outdoor enthusiasts.
            </p>
            <p className="mb-2.5">
              To the maximum extent permitted under Australian Consumer Law, Camp Smart Australia and its contributors shall not be liable for any direct, indirect, incidental, or consequential loss, personal injury, property damage, tow recovery fees, or campground closures arising from reliance on site listings, microclimate predictions, or automated alternative alerts.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>5. Community Ground Reports & Intellectual Property</span>
            </h2>
            <p className="mb-2.5">
              When submitting ground check-ins or beta feedback, you warrant that your report is accurate, based on recent firsthand observation, and free of defamatory or abusive material.
            </p>
            <p>
              Campground geospatial layers and OpenStreetMap derivations are maintained in accordance with the Open Database License (ODbL).
            </p>
          </section>

          <div className="pt-6 border-t border-paper-rule flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/privacy"
              className="text-xs font-semibold text-eucalypt hover:underline"
            >
              Read our Privacy Policy & Data Commitments &rarr;
            </Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-sm bg-eucalypt text-paper text-xs font-semibold hover:bg-eucalypt/90 transition-colors"
            >
              Back to Trip Finder
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
