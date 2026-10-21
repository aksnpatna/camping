"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, AlertTriangle, ShieldCheck, Printer, Radio } from "lucide-react";

interface Campsite {
  id: number;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  management_type: string;
  dog_friendly: boolean | null;
  rig_access: string[];
  source_url: string;
}

export default function OfflinePackFallback({ id }: { id: string }) {
  const [cachedSite] = useState<Campsite | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(`campsmart_offline_pack_${id}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  if (!cachedSite) {
    return (
      <div className="bg-paper-page text-ink min-h-screen max-w-xl mx-auto flex flex-col justify-center items-center text-center p-8 border border-paper-rule rounded-sm mt-12 font-sans">
        <Radio size={28} className="text-ochre mb-3" />
        <h1 className="text-xl font-bold font-serif mb-2">Offline & No Local Pack Cached</h1>
        <p className="text-ink-muted text-sm mb-4">
          You appear to be offline and this campsite pack wasn&apos;t previously saved to this device.
        </p>
        <Link 
          href="/" 
          className="bg-eucalypt text-paper-card px-4 py-2 rounded-xs font-semibold text-xs t-label hover:bg-eucalypt/90 transition-colors"
        >
          Return to Cached Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-3xl mx-auto font-sans print:p-0 print:m-0">
      <div className="flex justify-between items-center mb-8 print:hidden border-b border-paper-rule pb-4">
        <div>
          <h1 className="text-xl font-bold font-serif text-black">Your Offline Trip Pack (Cached)</h1>
          <span className="inline-flex items-center gap-1.5 text-xs bg-paper-tint text-eucalypt font-semibold px-2 py-0.5 rounded-xs border border-eucalypt/30 t-label mt-1">
            <Radio size={12} /> Loaded from Local Device Storage
          </span>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xs hover:bg-neutral-800 transition-colors text-xs font-semibold t-label cursor-pointer"
        >
          <Printer size={16} /> Print to PDF
        </button>
      </div>

      <div className="border-2 border-black p-8 rounded-none print:border-none print:p-0">
        <div className="text-center border-b-2 border-black pb-6 mb-6">
          <h1 className="text-3xl font-bold font-serif uppercase tracking-tight mb-2">{cachedSite.name}</h1>
          <div className="flex items-center justify-center gap-2 text-base font-medium text-gray-700">
            <MapPin size={18} /> {cachedSite.state} • {cachedSite.management_type || "Authority not recorded"}
          </div>
        </div>

        <div className="mb-8 bg-gray-100 p-4 rounded-none border border-black">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1 t-label">GPS Coordinates</h2>
          <p className="text-2xl font-mono t-data">{cachedSite.latitude.toFixed(5)}, {cachedSite.longitude.toFixed(5)}</p>
          <p className="text-xs mt-2 text-gray-700">Enter these coordinates into your offline GPS/Maps before losing cell service.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-lg font-bold font-serif border-b-2 border-black pb-1 mb-3">Site Access</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Rig Access:</strong> {cachedSite.rig_access?.length > 0 ? cachedSite.rig_access.join(', ') : "Access not recorded"}</li>
              <li><strong>Pets:</strong> {cachedSite.dog_friendly === true ? "Dogs Allowed" : cachedSite.dog_friendly === false ? "No Dogs Allowed" : "Not recorded"}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-bold font-serif border-b-2 border-black pb-1 mb-3">Safety & Fire</h2>
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-black shrink-0 mt-0.5" size={18} />
              <p className="text-xs leading-relaxed text-gray-800">
                <strong>Always check local fire bans</strong> before starting a campfire. Keep a 10L bucket of water near your fire at all times. Extinguish fires completely with water, not sand.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold font-serif border-b-2 border-black pb-1 mb-4 flex items-center gap-2">
            <ShieldCheck size={18} /> Essential Offline Checklist
          </h2>
          <div className="grid grid-cols-2 gap-y-3 text-xs">
            {["First Aid Kit", "Printed/Offline Maps", "Minimum 5L Water per person/day", "Sunscreen & Insect Repellent", "Matches/Lighter in waterproof container", "Trash bags (Leave No Trace)"].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-black rounded-xs"></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 pt-6 border-t-2 border-gray-300 text-xs text-gray-500 font-mono t-data">
          Generated by Camp Smart Australia • Always carry a physical map • Leave No Trace
        </div>
      </div>
    </div>
  );
}
