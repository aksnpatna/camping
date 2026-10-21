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
    <div className="bg-ochre-tint border border-ochre/30 rounded-sm px-2.5 py-1.5 flex items-center justify-between text-xs gap-2 text-ink">
      <div className="flex items-center gap-1.5 overflow-hidden">
        <Flame size={13} className="text-ochre shrink-0" />
        <div className="truncate">
          <span className="t-label text-ink-muted text-xs">Fire District: </span>
          {districtName ? (
            <span className="t-data text-xs text-ink font-semibold">
              {districtName} ({state})
            </span>
          ) : (
            <span className="t-body text-xs text-ochre font-medium">
              District Unmapped
            </span>
          )}
        </div>
      </div>

      <a
        href={agency.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-[11px] text-ochre hover:text-ink bg-paper-card border border-paper-rule px-2 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-colors"
        title={`Check live Fire Danger Rating on official ${agency.name}`}
      >
        <span>{agency.name}</span>
        <ExternalLink size={10} />
      </a>
    </div>
  );
}
