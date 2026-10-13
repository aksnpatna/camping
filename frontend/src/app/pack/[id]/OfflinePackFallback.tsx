"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, AlertTriangle, ShieldCheck, Printer } from "lucide-react";

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
      <div className="p-10 text-white bg-black min-h-screen max-w-xl mx-auto flex flex-col justify-center items-center text-center">
        <div className="text-3xl mb-3">📡</div>
        <h1 className="text-xl font-bold mb-2">Offline & No Local Pack Cached</h1>
        <p className="text-gray-400 text-sm mb-4">
          You appear to be offline and this campsite pack wasn&apos;t previously saved to this device.
        </p>
        <Link 
          href="/" 
          className="bg-emerald-500 text-black px-4 py-2 rounded-lg font-bold text-sm"
        >
          Return to Cached Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-3xl mx-auto font-sans print:p-0 print:m-0">
      <div className="flex justify-between items-center mb-8 print:hidden border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Your Offline Trip Pack (Cached)</h1>
          <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">
            📡 Loaded from Local Device Storage
          </span>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer size={18} /> Print to PDF
        </button>
      </div>

      <div className="border-4 border-black p-8 rounded-xl print:border-none print:p-0">
        <div className="text-center border-b-2 border-black pb-6 mb-6">
          <h1 className="text-5xl font-black uppercase tracking-tight mb-2">{cachedSite.name}</h1>
          <div className="flex items-center justify-center gap-2 text-xl font-medium text-gray-700">
            <MapPin size={24} /> {cachedSite.state} • {cachedSite.management_type || "Verified"}
          </div>
        </div>

        <div className="mb-8 bg-gray-100 p-4 rounded-lg border border-gray-300">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-1">GPS Coordinates</h2>
          <p className="text-3xl font-mono">{cachedSite.latitude.toFixed(5)}, {cachedSite.longitude.toFixed(5)}</p>
          <p className="text-sm mt-2">Enter these coordinates into your offline GPS/Maps before losing cell service.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-bold border-b-2 border-black pb-1 mb-3">Site Access</h2>
            <ul className="list-disc pl-5 space-y-2 text-lg">
              <li><strong>Rig Access:</strong> {cachedSite.rig_access?.length > 0 ? cachedSite.rig_access.join(', ') : "None"}</li>
              <li><strong>Pets:</strong> {cachedSite.dog_friendly === true ? "Dogs Allowed" : cachedSite.dog_friendly === false ? "No Dogs Allowed" : "Policy Unknown"}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold border-b-2 border-black pb-1 mb-3">Safety & Fire</h2>
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 shrink-0 mt-1" size={24} />
              <p className="text-sm leading-relaxed">
                <strong>Always check local fire bans</strong> before starting a campfire. Keep a 10L bucket of water near your fire at all times. Extinguish fires completely with water, not sand.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold border-b-2 border-black pb-1 mb-4 flex items-center gap-2">
            <ShieldCheck /> Essential Offline Checklist
          </h2>
          <div className="grid grid-cols-2 gap-y-3">
            {["First Aid Kit", "Printed/Offline Maps", "Minimum 5L Water per person/day", "Sunscreen & Insect Repellent", "Matches/Lighter in waterproof container", "Trash bags (Leave No Trace)"].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-black rounded-sm"></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 pt-6 border-t-2 border-gray-300 text-sm text-gray-500">
          Generated by Camp Smart Australia • Always carry a physical map • Leave No Trace
        </div>
      </div>
    </div>
  );
}
