import { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { getApiUrl } from '@/config';

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(
  props: Props
): Promise<Metadata> {
  const params = await props.params;
  const titleSlug = params.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    title: `Best Camping in ${titleSlug} | Camp Smart AU`,
    description: `Discover curated, verified, and condition-aware camping spots in ${titleSlug}. Check live fire rules, gear recommendations, and local insights before you go.`,
  }
}

async function getFireStatus(state: string) {
  try {
    const res = await fetch(`${getApiUrl()}/fire-status?state=${state}`, { 
      cache: 'no-store' // CRITICAL: Do NOT cache and present stale fire rules per AGENTS.md
    });
    if (!res.ok) {
      return null; // Indicates feed is down or error
    }
    return await res.json();
  } catch {
    return null; // Feed unreachable
  }
}

export default async function ExplorePage(props: Props) {
  const params = await props.params;
  // Extract a readable name and state from the slug
  const parts = params.slug.split('-');
  const titleSlug = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const state = parts[parts.length - 1].toUpperCase() || "NSW";

  const fireStatus = await getFireStatus(state);

  return (
    <div className="min-h-screen bg-[var(--color-forest-900)] text-white font-sans selection:bg-[var(--color-neon-green)] selection:text-[var(--color-forest-900)]">
      
      {/* HEADER / NAVIGATION */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
        <Link href="/" className="text-2xl font-black tracking-tighter">
          CAMP SMART <span className="text-[var(--color-neon-green)]">AU</span>
        </Link>
        <Link href="/" className="px-5 py-2 glass-panel rounded-full font-bold hover:bg-white/10 transition">
          Interactive Map
        </Link>
      </header>

      {/* HERO SECTION */}
      <div className="relative pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
        
        <h1 className="text-5xl md:text-7xl font-black mb-6 relative z-10">
          Camping in <span className="text-[var(--color-neon-green)]">{titleSlug}</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl relative z-10 mb-10">
          Curated spots, real-time condition monitoring, and intelligent gear recommendations.
        </p>
        
        <Link href="/" className="relative z-10 bg-[var(--color-neon-green)] text-[var(--color-forest-900)] px-8 py-4 rounded-full font-black text-lg hover:scale-105 transition-transform shadow-[0_0_30px_rgba(0,255,163,0.3)]">
          Find Spots Nearby
        </Link>
      </div>

      {/* FIRE RULES & SAFETY SECTION (MANDATORY) */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Flame className="text-[var(--color-sunset-orange)]" />
          Live Fire Safety Rules
        </h2>
        
        {!fireStatus || fireStatus.status !== 'live' ? (
          // DEGRADATION RULE: Prominent "status unavailable" banner if feed is down
          <div className="bg-red-900/50 border border-red-500 p-6 rounded-2xl flex items-start gap-4 shadow-lg">
            <AlertTriangle className="text-red-500 w-8 h-8 shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-red-500 mb-2">FIRE STATUS UNAVAILABLE</h3>
              <p className="text-gray-300">
                The official state fire emergency feed is currently unreachable. For your safety, do not light any campfires until you can independently verify local conditions with the NSW RFS or local park authority.
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold mb-1">Live FDR ({fireStatus.state})</p>
              <h3 className={`text-4xl font-black ${
                fireStatus.rating === 'Catastrophic' || fireStatus.rating === 'Extreme' 
                ? 'text-[var(--color-sunset-orange)]' 
                : 'text-[var(--color-neon-green)]'
              }`}>
                {fireStatus.rating}
              </h3>
            </div>
            <div className="h-full w-px bg-white/10 hidden md:block"></div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold mb-1">Total Fire Ban</p>
              <p className={`text-xl font-bold flex items-center gap-2 ${fireStatus.total_fire_ban ? 'text-red-400' : 'text-green-400'}`}>
                {fireStatus.total_fire_ban ? (
                  <>
                    <ShieldAlert className="text-red-400" />
                    DECLARED (No Campfires)
                  </>
                ) : (
                  "Not Declared"
                )}
              </p>
            </div>
            <div className="h-full w-px bg-white/10 hidden md:block"></div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold mb-1">Source</p>
              <p className="text-xs text-gray-400 max-w-xs">{fireStatus.source}</p>
            </div>
          </div>
        )}
      </div>

      {/* VALUE PROPOSITION GRID */}
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold mb-3 text-white">Answer-First Insights</h3>
          <p className="text-gray-400">We analyze real-time reviews to extract the nearest fuel, groceries, and top activities instantly.</p>
        </div>
        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold mb-3 text-white">Plan B Engine</h3>
          <p className="text-gray-400">Save a trip and we monitor the weather. If heavy rain or extreme wind is detected, we alert you immediately.</p>
        </div>
        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
          <h3 className="text-xl font-bold mb-3 text-white">Offline Packs</h3>
          <p className="text-gray-400">Generate a high-contrast, print-ready document with all coordinates and gear needs before you lose signal.</p>
        </div>
      </div>
      
      {/* FOOTER */}
      <footer className="border-t border-white/10 mt-20 py-10 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Camp Smart AU.</p>
      </footer>
    </div>
  );
}
