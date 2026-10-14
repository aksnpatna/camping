import React from "react";
import { Flame, ExternalLink } from "lucide-react";
import { Fact } from "@/types/facts";

interface FireStripProps {
  fireDistrict?: string | null;
  fireFact?: Fact<string> | null;
  state: string;
}

export default function FireStrip({ fireDistrict, fireFact, state }: FireStripProps) {
  const districtName = fireDistrict || fireFact?.value || null;

  const getStateFireAgency = (st: string) => {
    switch (st.toUpperCase()) {
      case "NSW":
        return { name: "NSW RFS", url: "https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans" };
      case "VIC":
        return { name: "VicEmergency / CFA", url: "https://www.cfa.vic.gov.au/warnings-restrictions/total-fire-bans-fire-danger-ratings" };
      case "QLD":
        return { name: "Queensland QFES", url: "https://www.qfes.qld.gov.au/" };
      case "WA":
        return { name: "WA DFES", url: "https://www.emergency.wa.gov.au/" };
      case "SA":
        return { name: "SA CFS", url: "https://www.cfs.sa.gov.au/" };
      case "TAS":
        return { name: "Tasmania TFS", url: "https://www.fire.tas.gov.au/" };
      case "ACT":
        return { name: "ACT ESA", url: "https://esa.act.gov.au/" };
      case "NT":
        return { name: "Bushfires NT", url: "https://bushfires.nt.gov.au/" };
      default:
        return { name: "State Fire Authority", url: "https://www.bom.gov.au" };
    }
  };

  const agency = getStateFireAgency(state);

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between text-xs gap-2">
      <div className="flex items-center gap-2 overflow-hidden">
        <Flame size={14} className="text-amber-400 shrink-0" />
        <div className="truncate">
          <span className="font-semibold text-gray-300 text-[11px]">Fire Status: </span>
          {districtName ? (
            <span className="text-white text-[11px] font-bold">
              {districtName} ({state})
            </span>
          ) : (
            <span className="text-amber-300/90 text-[11px] font-medium">
              District Unmapped
            </span>
          )}
        </div>
      </div>

      <a
        href={agency.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-[10px] text-amber-300 hover:text-amber-200 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-all"
        title={`Check live Fire Danger Rating on official ${agency.name}`}
      >
        <span>{agency.name}</span>
        <ExternalLink size={10} />
      </a>
    </div>
  );
}
