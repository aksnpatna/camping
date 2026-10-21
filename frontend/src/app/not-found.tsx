import Link from "next/link";
import { Compass, MapPin } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 text-center font-sans selection:bg-eucalypt selection:text-paper">
      <div className="max-w-md bg-paper-card border border-paper-rule p-8 rounded-sm shadow-xs">
        <span className="t-micro text-ink-muted mb-2 block">404 • Track Not Found</span>
        <h1 className="font-serif text-3xl font-semibold text-ink tracking-tight mb-3">
          Off the mapped trail
        </h1>
        <p className="text-xs text-ink-muted leading-relaxed mb-6">
          The campsite, pack, or route you requested doesn&apos;t exist or has moved. Return to the planner to find verified campgrounds across Australia.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-eucalypt text-paper px-4 py-2 rounded-sm text-xs font-semibold hover:bg-eucalypt/90 transition-colors shadow-xs"
          >
            <Compass size={14} />
            <span>Trip Finder</span>
          </Link>
          <Link
            href="/explore/nsw"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 border border-paper-rule bg-paper text-ink px-4 py-2 rounded-sm text-xs font-medium hover:bg-paper-tint transition-colors"
          >
            <MapPin size={14} className="text-eucalypt" />
            <span>Explore NSW</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
