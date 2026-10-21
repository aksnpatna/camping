"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-eucalypt text-paper px-4 py-2 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 transition-colors shadow-xs cursor-pointer"
    >
      <Printer size={16} /> Print to PDF
    </button>
  );
}
