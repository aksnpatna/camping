import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Mail, EyeOff, Trash2, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Camp Smart Australia",
  description: "Privacy commitments, data retention standards, and compliance with the Australian Privacy Act 1988 (Cth) and Spam Act 2003.",
};

export default function PrivacyPolicyPage() {
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
            <span>Australian Privacy Act 1988 & Spam Act 2003 Compliant</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink tracking-tight mb-3">
            Privacy Policy & Data Standards
          </h1>
          <p className="text-ink-muted text-sm sm:text-base leading-relaxed max-w-2xl">
            Camp Smart Australia is an answer-first, condition-aware trip guide. We believe in minimal data footprint, zero monetization of user location data, and full camper sovereignty over saved information.
          </p>
          <div className="t-data text-xs text-ink-faint mt-4">
            Last Updated: October 2026 • Effective Immediately
          </div>
        </div>

        {/* PILLARS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-paper-card p-5 rounded-sm border border-paper-rule">
            <div className="w-8 h-8 rounded-xs bg-eucalypt-tint text-eucalypt flex items-center justify-center mb-2.5">
              <EyeOff size={16} />
            </div>
            <h3 className="font-serif font-semibold text-sm text-ink mb-1">Zero data selling</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              We never sell, rent, or trade your email address, campsite searches, or location records to ad networks or data brokers.
            </p>
          </div>

          <div className="bg-paper-card p-5 rounded-sm border border-paper-rule">
            <div className="w-8 h-8 rounded-xs bg-eucalypt-tint text-eucalypt flex items-center justify-center mb-2.5">
              <Lock size={16} />
            </div>
            <h3 className="font-serif font-semibold text-sm text-ink mb-1">Passwordless auth</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              We don&apos;t store passwords. Sign-in uses short-lived, SHA-256 hashed magic links that expire automatically.
            </p>
          </div>

          <div className="bg-paper-card p-5 rounded-sm border border-paper-rule">
            <div className="w-8 h-8 rounded-xs bg-eucalypt-tint text-eucalypt flex items-center justify-center mb-2.5">
              <Mail size={16} />
            </div>
            <h3 className="font-serif font-semibold text-sm text-ink mb-1">1-click unsubscribe</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Every automated alternative weather or fire warning email includes an immediate 1-click opt-out link.
            </p>
          </div>
        </div>

        {/* DETAILED SECTIONS */}
        <div className="bg-paper-card rounded-sm p-6 sm:p-10 border border-paper-rule shadow-xs space-y-8 text-xs sm:text-sm leading-relaxed text-ink-muted">
          
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>1. What Information We Collect</span>
            </h2>
            <p className="mb-2.5">
              We adhere strictly to the principle of data minimisation. We only collect information strictly required to compute your trips, provide weather briefings, and notify you of dangerous condition shifts:
            </p>
            <ul className="space-y-2 pl-4 list-disc marker:text-eucalypt">
              <li>
                <strong className="text-ink">Camper Email Address:</strong> Collected only when you voluntarily save a trip, request a dashboard magic link, or coordinate a Trip Room.
              </li>
              <li>
                <strong className="text-ink">Trip Preferences & Gear Profile:</strong> Dates, party size, dog-friendly requirements, and 2WD/4WD vehicle rig access to calculate feasibility.
              </li>
              <li>
                <strong className="text-ink">Community Ground Reports:</strong> Voluntary condition reports (water levels, road passability, toilet cleanliness, and telco coverage).
              </li>
              <li>
                <strong className="text-ink">Security & Abuse Telemetry:</strong> Anonymized client IP addresses and user agents recorded strictly for sliding-window rate limiting, DDoS mitigation, and approximate regional forecast routing.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>2. How Your Information Is Used</span>
            </h2>
            <ul className="space-y-2 pl-4 list-disc marker:text-eucalypt">
              <li>
                <strong className="text-ink">Automated Weather & Fire Monitoring:</strong> Hourly background evaluations check whether severe conditions (rain &gt;70%, extreme wind, heatwaves &gt;35°C, or catastrophic bushfire danger) threaten your planned campground.
              </li>
              <li>
                <strong className="text-ink">Collaborative Trip Rooms:</strong> Syncing equipment claims, camp checklists, and voting shortlists between group members.
              </li>
              <li>
                <strong className="text-ink">System Hardening:</strong> Throttling malicious bot floods, blocking repeated credential probing, and shielding our self-hosted infrastructure.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>3. Compliance with the Australian Spam Act 2003</span>
            </h2>
            <p className="mb-2.5">
              We respect your inbox. Automated emails dispatched by Camp Smart Australia fall strictly under safety condition notifications and transactional login requests:
            </p>
            <div className="bg-paper-tint p-4 rounded-sm border border-paper-rule space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-eucalypt shrink-0 mt-0.5" />
                <span>We never send unsolicited third-party commercial marketing or partner advertising.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-eucalypt shrink-0 mt-0.5" />
                <span>Every condition alert email carries a direct 1-click unsubscribe link.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-eucalypt shrink-0 mt-0.5" />
                <span>You can toggle or pause alternative monitoring at any time directly inside your Camper Dashboard.</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>4. Data Retention & Deletion Rights</span>
            </h2>
            <p className="mb-2.5">
              You retain full ownership of your data under the Australian Privacy Principles:
            </p>
            <p className="mb-2.5">
              Trip records remain in your account until your planned departure date has passed or until you choose to delete them. Security audit logs are automatically aged out.
            </p>
            <div className="flex items-center gap-3 p-4 bg-clay-tint border border-clay/30 rounded-sm text-clay">
              <Trash2 size={18} className="shrink-0" />
              <div className="text-xs">
                <strong>Right to Erasure:</strong> To request immediate deletion of all email records, trip history, and saved preferences, submit a request via our in-app feedback drawer or email our data controller at <code className="bg-paper px-1 py-0.5 rounded-xs font-mono font-bold text-ink">privacy@smartcampingau.com</code>.
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-eucalypt"></span>
              <span>5. Third-Party Integrations & Public Feeds</span>
            </h2>
            <p className="mb-2.5">
              To deliver live condition telemetry, our servers interface with public, authoritative Australian agencies:
            </p>
            <ul className="space-y-1 pl-4 list-disc marker:text-eucalypt text-xs">
              <li>Bureau of Meteorology (BOM) & Open-Meteo for numerical weather forecasts.</li>
              <li>State Rural Fire Services (NSW RFS, VIC CFA, QLD QFD, etc.) for live fire danger ratings.</li>
              <li>OpenStreetMap (OSM) for geographic baseline road geometries in an ODbL-compliant separable layer.</li>
            </ul>
          </section>

          <div className="pt-6 border-t border-paper-rule flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/terms"
              className="text-xs font-semibold text-eucalypt hover:underline"
            >
              Read our Terms of Service & Bush Safety Disclaimers &rarr;
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
