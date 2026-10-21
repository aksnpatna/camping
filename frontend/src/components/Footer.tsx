"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ExternalLink, MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export default function Footer({ onOpenFeedback }: { onOpenFeedback?: () => void }) {
  return (
    <footer className="w-full bg-paper-tint text-ink border-t-2 border-paper-rule mt-16 font-sans">
      <div className="max-w-6xl mx-auto px-6 py-12">
        
        {/* TOP ROW: BRAND & SAFETY ALERT */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-paper-rule">
          
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-ink">
                CAMP SMART <span className="t-micro text-ink-muted font-mono">AU</span>
              </span>
              <Badge tone="ok">Field Guide</Badge>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed max-w-md">
              Campground finder for Australian campers. Live fire ratings, forecasts, and where every answer came from.
            </p>
            <div className="flex items-center gap-2 text-xs text-ink-faint pt-1">
              <span>Built for Australian campers and bush explorers.</span>
            </div>
          </div>

          {/* ESSENTIAL LINKS */}
          <div className="space-y-2.5">
            <div className="t-micro text-ink font-semibold">
              Legal & Transparency
            </div>
            <ul className="space-y-2 text-xs text-ink-muted">
              <li>
                <Link href="/privacy" className="hover:text-eucalypt transition-colors">
                  Privacy Policy & Data Rights
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-eucalypt transition-colors">
                  Terms of Service & Bush Safety
                </Link>
              </li>
              <li>
                <Link href="/sources" className="hover:text-eucalypt transition-colors">
                  Sources & Licences
                </Link>
              </li>
              {onOpenFeedback && (
                <li>
                  <button
                    onClick={onOpenFeedback}
                    className="flex items-center gap-1.5 hover:text-eucalypt transition-colors cursor-pointer text-left"
                  >
                    <MessageSquarePlus size={14} className="text-eucalypt" />
                    <span>Report campground conditions</span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* OFFICIAL FIRE & EMERGENCY FEEDS */}
          <div className="space-y-2.5">
            <div className="t-micro text-ink font-semibold flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-clay" />
              <span>Official Emergency Feeds</span>
            </div>
            <ul className="space-y-1.5 text-xs text-ink-muted">
              <li>
                <a
                  href="https://www.rfs.nsw.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-ink transition-colors"
                >
                  <span>NSW Rural Fire Service</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.cfa.vic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-ink transition-colors"
                >
                  <span>CFA Victoria Warnings</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.bom.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-ink transition-colors"
                >
                  <span>Bureau of Meteorology (BOM)</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              </li>
              <li className="pt-1 text-[11px] text-clay font-bold">
                Emergency Hotline: Dial 000
              </li>
            </ul>
          </div>

        </div>

        {/* BOTTOM ROW: SAFETY DISCLAIMER */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-ink-faint leading-relaxed text-center md:text-left">
          <p className="max-w-3xl">
            <strong className="text-ink-muted">Safety Disclaimer:</strong> Camp Smart Australia provides condition-aware guidance based on open meteorological models and public feeds. Wild conditions, river levels, and bushfires change rapidly. In severe fire or storm conditions, always prioritize official broadcasts from state emergency services and local park rangers.
          </p>
          <div className="t-data text-ink-faint shrink-0 text-[11px]">
            © 2026 Camp Smart Australia
          </div>
        </div>

      </div>
    </footer>
  );
}
