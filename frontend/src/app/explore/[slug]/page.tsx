import { Metadata } from 'next';
import Link from 'next/link';
import { 
  AlertTriangle, 
  Flame, 
  ShieldAlert, 
  MapPin, 
  Printer, 
  Compass, 
  ChevronRight,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { getApiUrl } from '@/config';
import Footer from '@/components/Footer';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

export const instant = false;

type Props = {
  params: Promise<{ slug: string }>
}

interface CampsiteItem {
  id: number;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  management_type: string | null;
  dog_friendly: boolean | null;
  rig_access: string[];
}

export async function generateMetadata(
  props: Props
): Promise<Metadata> {
  const params = await props.params;
  const titleSlug = params.slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    title: `Best Camping in ${titleSlug} | Camp Smart Australia`,
    description: `Vetted, condition-aware camping guide for ${titleSlug}. Check real-time fire danger ratings, Total Fire Ban status, dog access, and printable offline packs.`,
    alternates: {
      canonical: `https://smartcampingau.com/explore/${params.slug}`
    },
    openGraph: {
      title: `Camping in ${titleSlug} | Camp Smart Australia`,
      description: `Live fire rules, weather alerts, and verified spots in ${titleSlug}.`,
      url: `https://smartcampingau.com/explore/${params.slug}`,
      siteName: "Camp Smart Australia",
      locale: "en_AU",
      type: "website"
    }
  };
}

async function getFireStatus(state: string, district?: string | null) {
  try {
    const params = new URLSearchParams({ state });
    if (district) {
      params.set('district', district);
    }
    const res = await fetch(`${getApiUrl()}/fire-status?${params.toString()}`, { 
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

async function getCampsitesForSlug(state: string, slug: string): Promise<CampsiteItem[]> {
  try {
    const params = new URLSearchParams({ state, limit: '20' });
    if (slug.includes('dog-friendly')) {
      params.set('dog_friendly', 'true');
    }
    const res = await fetch(`${getApiUrl()}/campsites?${params.toString()}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function ExplorePage(props: Props) {
  const params = await props.params;
  // Extract a readable name and state from the slug
  const parts = params.slug.split('-');
  const titleSlug = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const lastPart = parts[parts.length - 1].toUpperCase();
  const validStates = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT", "JBT"];
  const state = validStates.includes(lastPart) ? lastPart : "NSW";
  const potentialDistrict = parts.length > 1 && validStates.includes(lastPart) 
    ? parts.slice(0, parts.length - 1).join(' ') 
    : undefined;

  const [fireStatus, campsites] = await Promise.all([
    getFireStatus(state, potentialDistrict),
    getCampsitesForSlug(state, params.slug)
  ]);

  // Schema.org Structured Data: Breadcrumbs + ItemList of Campgrounds
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://smartcampingau.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Explore",
        "item": "https://smartcampingau.com/#explore"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": titleSlug,
        "item": `https://smartcampingau.com/explore/${params.slug}`
      }
    ]
  };

  const campsiteListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Camping Spots in ${titleSlug}`,
    "description": `Curated campgrounds and condition alerts for ${titleSlug}`,
    "numberOfItems": campsites.length,
    "itemListElement": campsites.map((site, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Campground",
        "name": site.name,
        "address": {
          "@type": "PostalAddress",
          "addressRegion": site.state,
          "addressCountry": "AU"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": site.latitude,
          "longitude": site.longitude
        },
        "petsAllowed": site.dog_friendly === true ? "True" : site.dog_friendly === false ? "False" : "Unknown"
      }
    }))
  };

  const tableColumns: Column<CampsiteItem>[] = [
    {
      header: "Campground",
      cell: (site) => (
        <div>
          <div className="font-semibold text-ink text-sm">{site.name}</div>
          <div className="t-data text-ink-faint text-[11px] mt-0.5">
            {site.latitude.toFixed(3)}, {site.longitude.toFixed(3)}
          </div>
        </div>
      )
    },
    {
      header: "State",
      cell: (site) => (
        <span className="t-data font-medium text-ink-muted">
          {site.state}
        </span>
      )
    },
    {
      header: "Management",
      cell: (site) => (
        <span className="text-ink-muted text-xs">
          {site.management_type || "Public Reserve"}
        </span>
      )
    },
    {
      header: "Rig Access",
      cell: (site) => (
        <span className="text-ink-muted text-xs">
          {site.rig_access && site.rig_access.length > 0
            ? site.rig_access.join(", ")
            : "Clearance not recorded"}
        </span>
      )
    },
    {
      header: "Dogs",
      cell: (site) => {
        if (site.dog_friendly === true) return <Badge tone="ok">Allowed</Badge>;
        if (site.dog_friendly === false) return <Badge tone="danger">No dogs</Badge>;
        return <Badge tone="neutral">Unverified</Badge>;
      }
    },
    {
      header: "Actions",
      align: "right",
      cell: (site) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/pack/${site.id}`}
            className="inline-flex items-center gap-1 t-micro text-eucalypt hover:text-ink border border-paper-rule px-2 py-1 rounded-xs bg-paper-tint transition-colors"
          >
            <Printer size={12} />
            <span>Pack</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 t-micro text-ink hover:text-eucalypt border border-paper-rule px-2 py-1 rounded-xs bg-paper transition-colors"
          >
            <span>Map</span>
          </Link>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-eucalypt selection:text-paper">
      
      {/* STRUCTURED DATA FOR SEARCH ENGINES */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(campsiteListSchema) }}
      />

      {/* HEADER / NAVIGATION */}
      <header className="w-full border-b border-paper-rule bg-paper-tint/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-tight text-ink">CAMP SMART</span>
            <span className="t-micro text-ink-muted font-mono">AU</span>
          </Link>
          <Link 
            href="/" 
            className="px-3.5 py-1.5 border border-paper-rule bg-paper-card text-ink hover:bg-paper-tint rounded-sm font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <Compass size={14} className="text-eucalypt" />
            <span>Trip Finder</span>
          </Link>
        </div>
      </header>

      {/* HERO SECTION / MASTHEAD */}
      <div className="max-w-6xl mx-auto pt-10 pb-8 px-6">
        {/* BREADCRUMB */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 t-micro text-ink-muted mb-4">
          <Link href="/" className="hover:text-ink transition-colors">Home</Link>
          <ChevronRight size={11} />
          <span>Explore</span>
          <ChevronRight size={11} />
          <span className="text-ink font-semibold">{titleSlug}</span>
        </nav>

        <h1 className="t-display text-3xl sm:text-4xl md:text-5xl font-serif text-ink tracking-tight mb-3">
          Camping in {titleSlug}
        </h1>
        <p className="t-lede max-w-2xl text-ink-muted mb-6">
          Live fire danger ratings, Total Fire Ban status, and printable trip packs for Australian campers.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link 
            href="/" 
            className="bg-eucalypt text-paper px-4 py-2 rounded-sm font-medium text-xs hover:bg-eucalypt/90 transition-colors shadow-xs"
          >
            Find a campground
          </Link>
          <a 
            href="#campsites-list" 
            className="border border-paper-rule bg-paper-card text-ink px-4 py-2 rounded-sm font-medium text-xs hover:bg-paper-tint transition-colors"
          >
            View campgrounds ({campsites.length})
          </a>
        </div>
      </div>

      {/* FIRE RULES & SAFETY SECTION (MANDATORY LIVE STATE) */}
      <section className="w-full border-y border-paper-rule bg-paper-tint py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-ochre" />
            <h2 className="t-label font-semibold uppercase tracking-wider text-ink">
              Official Fire Status ({state})
            </h2>
          </div>
          
          {!fireStatus || fireStatus.status !== 'live' ? (
            // DEGRADATION RULE: Prominent "status unavailable" banner if feed is down
            <div className="bg-clay-tint border border-clay p-5 rounded-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-clay w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-clay tracking-wide mb-1">FIRE STATUS UNAVAILABLE</h3>
                  <p className="text-ink text-xs leading-relaxed max-w-2xl">
                    {fireStatus?.message ||
                      'The official state fire emergency feed is currently unreachable. For your safety, do not light any campfires until you can independently verify local conditions with the state fire authority or local park office.'}
                  </p>
                  {fireStatus?.source && (
                    <p className="t-micro text-ink-muted mt-2">
                      Authoritative Jurisdiction: <span className="font-semibold text-ink">{fireStatus.source}</span>
                    </p>
                  )}
                </div>
              </div>
              {fireStatus?.official_url && (
                <a
                  href={fireStatus.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-4 py-2 bg-clay text-paper text-xs font-semibold rounded-sm hover:bg-clay/90 transition-colors flex items-center gap-1.5"
                >
                  <span>Official Fire Feed</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <div className="bg-paper-card border border-paper-rule p-6 rounded-sm grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-paper-rule">
              <div>
                <p className="t-micro text-ink-muted mb-1">Fire Danger Rating ({fireStatus.state})</p>
                <div className={`font-serif text-3xl font-semibold ${
                  fireStatus.rating === 'Catastrophic' || fireStatus.rating === 'Extreme' 
                  ? 'text-clay' 
                  : fireStatus.rating === 'Moderate' || fireStatus.rating === 'High'
                  ? 'text-ochre'
                  : 'text-eucalypt'
                }`}>
                  {fireStatus.rating}
                </div>
                {fireStatus.district && (
                  <p className="t-data text-xs text-ink-muted mt-1">District: {fireStatus.district}</p>
                )}
              </div>

              <div className="pt-4 md:pt-0 md:pl-6">
                <p className="t-micro text-ink-muted mb-1">Total Fire Ban (TOBAN)</p>
                {fireStatus.total_fire_ban === true ? (
                  <p className="text-base font-semibold text-clay flex items-center gap-1.5">
                    <ShieldAlert size={18} />
                    <span>DECLARED — No Campfires</span>
                  </p>
                ) : fireStatus.total_fire_ban === false ? (
                  <p className="text-base font-semibold text-eucalypt flex items-center gap-1.5">
                    <ShieldCheck size={18} />
                    <span>Not Declared</span>
                  </p>
                ) : (
                  <p className="text-base font-semibold text-ink-muted flex items-center gap-1.5">
                    <AlertTriangle size={18} />
                    <span>Feed Unspecified — Verify</span>
                  </p>
                )}
              </div>

              <div className="pt-4 md:pt-0 md:pl-6">
                <p className="t-micro text-ink-muted mb-1">Authority Source</p>
                <p className="text-xs text-ink">{fireStatus.source}</p>
                {fireStatus.action_required && (
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">{fireStatus.action_required}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* VALUE PROPOSITION SPEC STRIP */}
      <section className="border-b border-paper-rule py-8">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-ink-muted">
          <div>
            <h3 className="t-label font-semibold text-ink mb-1">Condition brief</h3>
            <p className="leading-relaxed">
              Nearest fuel, water potable verification, and statutory fire district rules for every campsite.
            </p>
          </div>
          <div>
            <h3 className="t-label font-semibold text-ink mb-1">Alternative sites</h3>
            <p className="leading-relaxed">
              Automatic weather shift and Total Fire Ban monitoring that offers safe backup campsites.
            </p>
          </div>
          <div>
            <h3 className="t-label font-semibold text-ink mb-1">Printable trip packs</h3>
            <p className="leading-relaxed">
              Zero-signal offline sheets with exact GPS coordinates and emergency contacts before you head out of reception.
            </p>
          </div>
        </div>
      </section>

      {/* CURATED CAMPSITES LIST TABLE */}
      <div id="campsites-list" className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-ink flex items-center gap-2">
              <MapPin className="text-eucalypt" size={20} />
              <span>Campgrounds in {titleSlug}</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Curated canonical campsites with statutory rules and offline coordinate packs.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-eucalypt hover:text-ink flex items-center gap-1 transition-colors"
          >
            <span>Explore all on map</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {campsites.length === 0 ? (
          <div className="border border-paper-rule bg-paper-card p-8 rounded-sm text-center text-ink-muted text-xs">
            <p>No direct database matches found under this filter.</p>
            <Link href="/" className="mt-3 inline-block text-eucalypt font-semibold hover:underline">
              Open interactive Australian map &rarr;
            </Link>
          </div>
        ) : (
          <Table 
            columns={tableColumns} 
            data={campsites} 
            keyExtractor={(site) => site.id}
          />
        )}
      </div>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
