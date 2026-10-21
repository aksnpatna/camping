# Field Guide UI Uplift — Camp Smart Australia

Make the app read like a printed Australian field guide instead of an AI-generated product, and remove every place the UI states something the data does not support.

---

## 1. Why this plan exists

The app has a real moat — a per-fact provenance chain (`basis` / `confidence` / `source` / `as_of`) and live fire feeds. The UI throws that away and replaces it with decoration. Three concrete failures:

1. **Visual.** The `@theme` block in `frontend/src/app/globals.css:3-35` declares a paper/ink/eucalypt/ochre palette that has **zero usages** — every component hardcodes hex. ~20 off-token shades are live. Three palettes coexist (paper on `/`, legacy neon-dark on `/explore`, `/trip`, `Footer`; a fourth in `manifest.json`). 345 `rounded-*` classes put 12–16px radius on every surface. 6 font sizes below 12px, `font-black` everywhere, and `font-mono` used ~20 times with no mono font declared. ~40 emoji mixed with lucide, including `⛺` as the map marker.

2. **Verbal.** "Atmospheric Telemetry", "Camper Condition Synthesis", "P10-P90 Climatology Analog", "5-Axis Match Profile", "Answer-First Weekend Finder", "Bush Mode Offline Vault", "Zero Reception Ready" — invented compound nouns. Internal scaffolding ships in chrome ("Phase 2 • Preparation Board", "Phase 2 • Shared Trip Room"). The product name has four spellings.

3. **Epistemic — the one that matters.** The app promises *"Camp Smart Australia refuses to guess or fabricate an answer"* (`frontend/src/components/trust/SourceSheet.tsx:57`) and then guesses constantly:

| Fabrication | Location |
|---|---|
| Weather ribbon renders a hard-coded Oct 17–20 sample; `TripCard` calls it with **no `days` prop**, so the map panel always shows that fake forecast | `frontend/src/components/graphics/WeekendWeatherRibbon.tsx:28-33`, `frontend/src/components/TripCard.tsx:475` |
| Radar "Weather" axis is a hard-coded `80`, marked `known` | `frontend/src/components/graphics/WhyItFitsRadar.tsx:49-50` |
| "Known N of 9 facts / N official" — backend computes the real numbers but as plain `@property`, so Pydantic never serialises them; frontend substitutes `6 / 9 / 3` | `backend/app/schemas/facts.py:38-70`, `frontend/src/components/FindWeekendPlanner.tsx:664-666`, `frontend/src/components/trust/ConfidenceMeter.tsx:12-14` |
| "All Australia (2,964 Sites)" + per-state counts come from a planning doc, not a query | `frontend/src/components/SearchFilter.tsx:54-63` |
| `vehicle_clearance` asserts `"2WD"` when `rig_access` is NULL | `backend/app/services/recommendation_engine.py:438` |
| "Accessible for TENT" when `rig_access` is NULL | `backend/app/services/recommendation_engine.py:286-289` |
| `visual_badges.shade` = "Shaded Forest" from a name keyword | `backend/app/services/recommendation_engine.py:399` |
| `management_type or "Verified"` — a null manager renders as "Verified" | `backend/app/worker/plan_b.py:224` |
| `total_checkins` is `len()` of a `limit(5)` query, presented as a total | `backend/app/services/recommendation_engine.py:404-407` |
| Frontend reads `vibe === "quiet"` and `toilets === "dirty"` — not valid backend enums (`plenty_space\|filling_fast\|full`, `clean\|bring_tp\|poor\|no_toilets`) | `frontend/src/components/graphics/WhyItFitsRadar.tsx:40`, `frontend/src/components/FindWeekendPlanner.tsx:803-804` |

A prettier skin over these reads *more* like AI, not less. The "natural" feeling for a product whose thesis is *"we refuse to guess"* has to come from real data shown plainly, `Not verified yet` as a first-class state, and quiet typography.

---

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Visual direction | **Printed field guide** — lean into paper/ink/eucalypt/ochre, editorial hierarchy, sharp corners, ledger layouts, colour reserved for semantics |
| 2 | Scope | **Frontend + narrow backend truth fixes** (only where a backend change is the sole way to stop a fabricated number) |
| 3 | Trip card structure | **Flatten to a field-guide ledger** — one continuous card, no segmented switcher, no radar |
| 4 | Typography | **Serif display + humanist sans + real mono** (Source Serif 4 / Inter / IBM Plex Mono) |
| 5 | Dark surfaces | **One surface** — all light, CARTO Positron basemap |
| 6 | Product name | **Camp Smart Australia** (matches all five planning docs) |
| 7 | Voice | **Full voice pass** |
| 8 | Card imagery | **No photos** — data-derived contour motif keyed to real coordinates |
| 9 | Design system | **Tokens + a real primitive layer** (`src/components/ui/`) |

### Binding constraints (from `PLAN.md`, `plan_v2.md`, `plan_v3.md`, `data_plan.md`, `.agents/AGENTS.md`)

- Preserve these exact strings: `Not verified yet` · `Availability not checked.` · `No Rating` · `FIRE STATUS UNAVAILABLE` · `Fee unverified` · `Status unavailable - consult QFD Bushfire Warnings` · `Direct Reservation Required` / `Free / No Booking Required` / `Booking Details Unverified` · `Community Field Notes` · `Restrictions checked 20 minutes ago; published information covers today and tomorrow.`
- Red = fresh confirmed prohibition. Yellow = uncertainty or missing info. A details panel must expose the supporting record.
- The MapLibre view must survive as a secondary toggle (`.agents/AGENTS.md:41`).
- Never synthesise a fire rating; render the degradation banner. Fire pages must never serve a cached stale value.
- Out of scope — do not design for: availability/booking integration, reviews, campsite photos, crowd prediction, stargazing, comfort micro-forecasts, SMS, voice-to-text, Telegram.
- `GET /campsites`, `GET /saved-trips/dashboard/{email}`, `/pack/{id}`, `/explore/[slug]`, `/trip/{token}` keep working unchanged.

---

## 3. Target design system

### 3.1 Tokens — rewrite `frontend/src/app/globals.css`

Keep the committed paper palette as the base (it was chosen deliberately in `d589150`); change the *structure* — hierarchy, radius, semantics. Use Tailwind v4 CSS-first `@theme`.

```css
@theme {
  /* Paper — surfaces */
  --color-paper:             #F4F0E6;  /* page */
  --color-paper-card:        #FBF9F4;  /* raised sheet */
  --color-paper-sunk:        #EDE8DA;  /* wells, ledger stripes */
  --color-paper-rule:        #D8D0BE;  /* hairline */
  --color-paper-rule-strong: #BFB49C;

  /* Ink — text */
  --color-ink:        #1A231E;
  --color-ink-muted:  #4A564E;
  --color-ink-faint:  #7C887F;
  --color-ink-invert: #FBF9F4;

  /* Eucalypt — primary */
  --color-eucalypt:       #2F5D50;
  --color-eucalypt-hover: #24493F;
  --color-eucalypt-tint:  #E4EDE8;

  /* Ochre — accent */
  --color-ochre:      #B4761F;
  --color-ochre-tint: #F7EEDA;

  /* Clay — tertiary (replaces the stray #E76F51 in terms/privacy/footer) */
  --color-clay:      #A65640;
  --color-clay-tint: #F5E8E2;

  /* Safety — semantic only */
  --color-safety-ok:     #2E7D32;
  --color-safety-warn:   #B4761F;
  --color-safety-danger: #A32A20;

  /* Trust basis — semantic only */
  --color-trust-official:  #1F5F96;
  --color-trust-rule:      #8A6A2F;
  --color-trust-model:     #2C6E8F;
  --color-trust-community: #4A6B45;
  --color-trust-estimate:  #8A6A2F;
  --color-trust-unknown:   #7C887F;

  /* Radius — sharp by default */
  --radius-xs: 2px;  --radius-sm: 3px;  --radius-md: 4px;  --radius-lg: 6px;

  /* Type */
  --font-display: var(--font-source-serif), Georgia, serif;
  --font-sans:    var(--font-inter), system-ui, sans-serif;
  --font-mono:    var(--font-plex-mono), ui-monospace, monospace;

  /* Elevation — paper does not float */
  --shadow-sheet:   0 1px 0 0 rgba(26,35,30,0.04);
  --shadow-lifted:  0 1px 2px rgba(26,35,30,0.06), 0 8px 24px -12px rgba(26,35,30,0.18);
  --shadow-overlay: 0 24px 60px -20px rgba(26,35,30,0.32);
}
```

**Collapse Tailwind's default radius scale** so any residual `rounded-*` in legacy markup lands on the new system — this makes the migration safe by default and lets phases land independently:

```css
  --radius-sm: 2px; --radius-md: 3px; --radius-lg: 4px;
  --radius-xl: 6px; --radius-2xl: 8px; --radius-3xl: 8px;
```

`rounded-full` stays full — used only where a pill is semantically correct (the `AU` qualifier, trust basis dots).

Remove the legacy alias block (`--color-forest-900`, `--color-neon-green`, `--color-sunset-orange`, `--color-glass`, `--color-glass-border`) once the dark surfaces are migrated in Phase 3. Remove the dead `.paper-card`, `.paper-card-subtle`, `.animate-float` utilities.

### 3.2 Type scale

Add a small set of **semantic type utilities** in `@layer components` — the repo's inline-utility style makes a raw scale easy to misuse, and these roles are what recur:

```css
.t-display { font-family: var(--font-display); font-size: 30px; line-height: 1.15; letter-spacing: -0.01em; font-weight: 600; }
.t-title   { font-family: var(--font-display); font-size: 20px; line-height: 1.25; font-weight: 600; }
.t-lede    { font-family: var(--font-sans); font-size: 15px; line-height: 1.55; color: var(--color-ink-muted); }
.t-body    { font-family: var(--font-sans); font-size: 14px; line-height: 1.55; }
.t-label   { font-family: var(--font-sans); font-size: 13px; line-height: 1.4; font-weight: 500; }
.t-micro   { font-family: var(--font-sans); font-size: 11px; line-height: 1.3; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-ink-faint); }
.t-data    { font-family: var(--font-mono); font-size: 12px; line-height: 1.4; font-variant-numeric: tabular-nums; }
```

Rules: `font-black` is retired — use `font-semibold`/`font-medium` and let size and colour carry hierarchy. Nothing below 11px. `.t-micro` is the only 11px usage (uppercase labels, tracked). Coordinates, distances, dates and confidence values use `.t-data`.

### 3.3 Fonts

`frontend/src/app/layout.tsx:9-12` — replace `Outfit`:

```ts
import { Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" });
const sans  = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono  = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", display: "swap" });
```

Apply all three variables on `<html>`; set `body { font-family: var(--font-sans) }`.

> **Risk:** `next/font/google` downloads at build time. If the build environment is offline, switch to `next/font/local` with self-hosted `.woff2` in `frontend/src/app/fonts/`. Verify before starting Phase 1.

### 3.4 Primitive layer — new `frontend/src/components/ui/`

Every component currently hand-rolls these. Extract once, use everywhere.

| File | API | Notes |
|---|---|---|
| `Button.tsx` | `variant: "primary" \| "secondary" \| "ghost" \| "danger"`, `size: "sm" \| "md"` | primary = eucalypt fill; secondary = paper + hairline; radius `sm`; no `rounded-xl` |
| `Field.tsx` | `label`, `hint`, `error` | wraps input/select/textarea; label uses `.t-micro` |
| `Input.tsx` / `Select.tsx` | `size` | paper-sunk fill, hairline, radius `sm`, focus = eucalypt 1px ring |
| `Sheet.tsx` | `open`, `onClose`, `title`, `children`, `size` | the modal/drawer shell — overlay, focus trap, Escape, scroll lock, `role="dialog"`, `aria-modal` |
| `Badge.tsx` | `tone: "ok" \| "warn" \| "danger" \| "info" \| "neutral"` | hairline border + tinted ground, radius `xs` — replaces ~15 hand-rolled pill recipes |
| `BasisMark.tsx` | `basis`, `confidence` | the trust indicator. Replaces `TrustRing` + `FactChip`. A 2px vertical rule in the basis colour + an optional short label (`official` / `rule` / `community` / `model` / `estimate` / `not verified`) |
| `FactRow.tsx` | `label`, `value`, `fact?`, `onInspect?` | one attribute in the ledger: label, value, basis mark, as-of date. Unknown → value `—` in `.t-data` + `not verified` in italic faint |
| `Table.tsx` | columns, rows | hairline-ruled table; used by the compare tray and the ledger on wide viewports |
| `Section.tsx` | `title`, `children` | `.t-micro` heading + hairline rule, the ledger's section divider |
| `Contour.tsx` | `latitude`, `longitude`, `seed?` | the data-derived motif (§4.2) |

All primitives take `className` and merge it. No dependency beyond `lucide-react` (already present) — do **not** introduce shadcn/Radix.

---

## 4. Screens

### 4.1 The trip card → field-guide ledger

**Delete** the four-way perspective switcher, the 6-chip trust HUD, `WhyItFitsRadar`, and `WeekendWeatherRibbon`. One continuous card, in this order:

```
┌──────────────────────────────────────────────┐
│ ░░░ contour band 64px, data-derived ░░░░░░░░ │
│ Euroka Campground                     NSW     │  .t-title (serif)
│ Blue Mountains · National Park                 │  .t-data, ink-muted
│ ────────────────────────────────────────────  │  hairline
│ 2h 40m drive · 148 km     Free · Book ahead   │  .t-data
│                                               │
│ WHY IT FITS                     [.t-micro]   │
│ Under 3h driving from Sydney. 2WD access.     │  .t-body
│                                               │
│ WATCH FOR                       [.t-micro]   │
│ Drop/pit toilets only; bring toilet paper.    │  .t-body, ochre
│                                               │
│ CONDITIONS                      [.t-micro]   │
│ Fire: Moderate — Illawarra · as of 21 Oct     │  basis mark
│ Fri 13°/23° 20% rain · Sat 14°/24° 35% rain  │  .t-data
│                                               │
│ SITE FACTS                      [.t-micro]   │
│ Access     2WD access        ▪ rule · NPWS   │
│ Water      —                 ▪ not verified  │
│ Toilets    pit               ▪ official 2019 │
│ Campfires  permitted         ▪ official      │
│ Dogs       not allowed       ▪ rule · 1974   │
│ Telco      —                 ▪ not verified  │
│                                               │
│ [ Navigate ] [ Save offline ] [ Compare ]     │
└──────────────────────────────────────────────┘
```

- **Facts ledger** is the trust surface. One row per attribute: label (`.t-label`, muted) · value (ink; `—` + italic `not verified` when unknown) · basis mark + as-of date (`.t-data`, faint). Tapping a row opens the existing `SourceSheet` — keep that component, restyle it, rename its `{label} Lens` heading to the plain attribute name.
- **Unknown is a first-class state.** `Not verified yet` renders in faint italic, exactly like a printed guide's "not recorded".
- **Conditions** replaces the weather ribbon. Source is labelled honestly: `Live forecast (BOM/Open-Meteo)` vs `Typical for this date` depending on the card's new `forecast_source` field. If no days are available, render `Forecast not available for these dates` — never a sample.
- **Fire** row uses the live `/fire-status` feed where the jurisdiction has one (NSW/ACT/JBT/VIC) and shows the `FIRE STATUS UNAVAILABLE` banner otherwise.
- **No photo band.** The contour motif replaces it (§4.2).

### 4.2 Contour motif (`ui/Contour.tsx`)

Deterministic, derived from the site's real coordinates — never a stock image, never presented as terrain data.

- Seed = hash of `(round(lat, 3), round(lng, 3))`.
- Build 6–8 concentric closed rings where `r(θ) = base × (1 + Σ aᵢ·sin(kᵢθ + φᵢ))`, with amplitudes/phases drawn from the seed.
- Render as SVG paths, hairline stroke in `--color-ink` at 6–10% opacity, `vector-effect="non-scaling-stroke"`.
- Same site → same motif, on every surface. Neighbouring sites differ.
- **Label it decorative.** No contour values, no elevation figures, no scale bar — those would imply real terrain the app does not have.

### 4.3 Planner (`FindWeekendPlanner.tsx`, 1103 lines)

- **Hero.** Drop the "Answer-First Weekend Finder" pill and the centred 3-line headline. Replace with a single left-aligned lede: `Find a campground that fits your weekend.` (`.t-display` serif) + one sentence: `Matched to your group, vehicle and gear. Every answer shows where it came from.`
- **Search row** stays one control group, but as a hairline-ruled field on a single sheet, not a floating white pill box. Origin and weekend become a two-item fieldset with `.t-micro` labels.
- **Preset chips** → flat text buttons with a hairline underline on hover, not filled pills.
- **Card grid** stays 3-up on desktop, 1-up on mobile, but each card is the §4.1 ledger. Cards use `rounded-lg` (6px) at most, hairline border, `shadow-sheet`.
- **Remove** the `BUSH VAULT` / `SHARED TRIP ROOM` / `COMPARE` button row's dark styling; make them `Button variant="secondary" size="sm"`.
- **What-If toolbar** and the limiting-constraint banner keep their function, restyled: the constraint banner uses `--color-ochre-tint` with an ochre hairline and a plain sentence, not "Limiting Constraint Identified".

### 4.4 Map (`Map.tsx`)

- Basemap: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` (verified live; background `#fafaf8`, Protomaps vector tiles). The style's sprite/glyphs are on `tiles.basemaps.cartocdn.com` — the CSP in `next.config.ts:10-13` already allows `https:` for `img-src` and `connect-src`.
- **Campsite circles**: fill `--color-eucalypt` `#2F5D50`, stroke `--color-paper` `#F4F0E6` at 1.25px. Remove the emerald `#22c55e` / `#022c22` pair and the `campsites-glow` blur layer (it is invisible on a light basemap).
- **Selected marker**: replace the red pin + `animate-ping` + `shadow-[0_0_22px_rgba(239,68,68,0.95)]` with a printed-map target — a 10px eucalypt ring, 2px paper stroke, 1px eucalypt crosshair. No animation, no glow.
- **Start marker**: keep the white dot, stroke `--color-ink`.
- **Route line**: keep two layers but recolour — casing `--color-ink` at 6px/0.35 opacity, line `--color-clay` `#A65640` at 3px/0.95.
- **Hover popup**: `bg-slate-900/95` → paper card with hairline; state chip in eucalypt tint. Override `.maplibre-gl-popup-content` / `-tip` in `globals.css` so MapLibre's default white chrome stops clashing.
- **`⛺` emoji marker** → lucide `Tent` in a bordered circle.
- `STATE_CENTERS` flyTo values are fine; keep.

### 4.5 `/explore/[slug]` (SEO surface)

Currently legacy neon-dark with a gradient hero and three identical feature cards.

- Migrate to the paper theme. Keep the `h1` ("Camping in {region}") and all JSON-LD **exactly as-is** — this is a ranking surface.
- Hero → a masthead: serif `h1`, one lede, hairline rule. No gradient scrim, no neon glow on the CTA (`explore/[slug]/page.tsx:209` has `shadow-[0_0_30px_rgba(0,255,163,0.3)]` on a button that is now muted green — remove).
- **Fire status block** is the strongest real signal on the page. Make it the visual anchor: a full-width ruled block directly under the masthead, with the rating set in the serif at large size, the district in `.t-data`, and the source link as a plain text link.
- The three feature blurbs ("Answer-First Insights", "Plan B Escape Engine", "High-Contrast Offline Packs") → one hairline-ruled three-column spec strip in plain language, no individual card boxes, no rounded corners.
- Campsite list: `glass-panel p-5 rounded-2xl` per site → a hairline-ruled **table** (name / state / management type / access / fee / fire district). Tables are what a field guide has.
- Keep the empty state, reworded plainly.

### 4.6 `/trip/[token]` — group room

- Migrate from `bg-[#071912]` to the paper theme.
- Header: serif trip name, `.t-micro` room token in mono, member bar as a hairline-ruled strip.
- Tabs (Shortlist Voting / Shared Gear / Prep Tasks / Group Notes) → a hairline-underlined tab row, not filled pills. Remove the emoji tab labels (`🎒 📋 💬`).
- Vote pills `⭐ N Primary` / `🔄 N Backup` → `Badge` with `tone="ok"` / `tone="warn"` and lucide `Star` / `RefreshCw`.
- The room's `defaultGearSuggestions` list stays (it is real, useful content) but renders as a hairline list, not chips.
- Keep the copy link feedback ("Link Copied!" → "Link copied").

### 4.7 Footer

- Migrate from `bg-[#18231E]` + `text-[#00FF88]` to the paper theme with a heavy top rule.
- Brand: `CAMP SMART` with `AU` as a `.t-micro` qualifier, not a neon chip.
- The "Live Field Guide" badge → "Field Guide" in a `Badge`.
- Replace the emoji 🇦🇺 with a plain sentence.
- Emergency feeds stay a distinct ruled block — it is safety information and should read as a reference panel, with `Dial 000` in `--color-safety-danger`.
- The `© 2026 Camp Smart AU • Version 2.0` line → `© 2026 Camp Smart Australia`.

### 4.8 Structural additions

- `frontend/src/app/not-found.tsx`, `error.tsx`, `loading.tsx` — the app has none. Small, in the paper theme, with the field-guide voice. `not-found.tsx` should include a link back to the planner and to `/explore/nsw`.
- `frontend/src/app/sources/page.tsx` — a "Sources & licences" page listing each dataset, publisher, licence and the CC-BY attribution string. Mostly static content; list it in `sitemap.ts`. *(Optional — see §9.)*

---

## 5. Backend truth fixes (narrow)

Only these. Each is required to stop the UI stating something false.

### 5.1 Serialise the real fact counts

`backend/app/schemas/facts.py:38-70` — convert the three plain `@property` methods to Pydantic v2 `@computed_field` so they appear in the JSON response. Derive `total_facts_count` from the field list so it cannot drift.

```python
from pydantic import BaseModel, Field, computed_field
```

Impact: the frontend's `?? (card.facilities ? 6 : 4)` / `?? 9` / `?? (verified ? 4 : 2)` fallbacks at `FindWeekendPlanner.tsx:664-666` and `TripCard.tsx:404-406` become dead — delete them. `ConfidenceMeter`'s `knownCount = 6, totalCount = 9, officialCount = 3` defaults at `ConfidenceMeter.tsx:12-14` become dead — delete them and make the props required.

**Add a backend test** asserting the response contains `known_facts_count` / `total_facts_count` / `official_or_verified_count` and that they match the fact bases.

### 5.2 `GET /api/v1/campsites/counts`

New endpoint in `backend/app/api/v1/endpoints/campsites.py` returning per-state totals from a real `GROUP BY state`.

> **Route-ordering trap:** this must be registered **before** `@router.get("/{campsite_id}")` at `campsites.py:128`, or FastAPI matches `counts` as a `campsite_id` and returns 422. Add it immediately after `read_campsites` (line 50-65).

```python
@router.get("/counts")
def get_campsite_counts(db: Session = Depends(get_db)):
    rows = db.query(Campsite.state, func.count(Campsite.id)).group_by(Campsite.state).all()
    ...
```

Shape: `{"total": 2964, "by_state": {"NSW": 746, ...}}`. Frontend `SearchFilter.tsx:54-63` renders from this, with a graceful fallback to unlabelled state names if the request fails.

### 5.3 `forecast_source` on the card

`backend/app/schemas/trip_recommendation.py` — add `forecast_source: Optional[str]` to `TripRecommendationCard` (`"live"` | `"climatology"` | `"mixed"`), populated in `recommendation_engine.py:428` from the `MicroclimateEngine` result's `forecast_type` (`numerical_ensemble` → `live`, `climatological_physics` → `climatology`; mixed if the 4 days disagree). The UI uses it to label the conditions row honestly.

### 5.4 Fix the assertions that are false

`backend/app/services/recommendation_engine.py`:
- `:438` — `vehicle_clearance="4WD_ONLY" if is_4wd else "2WD"` → `"UNVERIFIED"` when `site.rig_access` is NULL/empty. Update `frontend/src/types` consumers to render "Clearance not recorded".
- `:286-289` — `f"Accessible for {', '.join(site.rig_access or ['TENT'])}"` → when `rig_access` is NULL, use `"Rig access not recorded"`.
- `:399` — delete the `shade` key from `visual_badges` entirely (name-keyword fabrication).
- `:404-407` — `total_checkins` is capped at 5. Rename to `recent_checkins` and add a true `total_checkins` via a separate `COUNT(*)` query, or drop the count and show only `last_reported`. *(Prefer dropping the misleading count.)*
- `:350-359` / `:458-459` — `photo_url` / `is_illustrative_photo`: **leave in place** for API backward compatibility; the frontend stops reading them.

`backend/app/worker/plan_b.py:224` — `management_type or "Verified"` → `None`. A null manager must not read as verified; `conditions_verified` is the real flag.

### 5.5 Frontend enum alignment

`frontend/src/components/FindWeekendPlanner.tsx:803-804` — the field-report line must use the real enums:
- `toilets`: `clean` → "Clean", `bring_tp` → "Bring TP", `poor` → "Poor", `no_toilets` → "None" (currently checks `"dirty"`, which is not a valid value)
- `vibe`: `plenty_space` → "Plenty of space", `filling_fast` → "Filling up", `full` → "Full" (currently checks `"quiet"`, which is not a valid value)

`frontend/src/components/graphics/WhyItFitsRadar.tsx` is deleted, so its `vibe` bug goes with it.

### 5.6 Explicitly NOT changing

- `GET /campsites` list rows stay without `facts` — populating `FactBuilder` for 5 000 rows is a needless N×9 cost, and the map detail panel already fetches `/campsites/{id}` individually (`TripCard.tsx:110`).
- `MicroclimateEngine.get_forecast_async` blocking the event loop on a sync `httpx.Client` call — real, but unrelated to the UI. File separately.

---

## 6. Voice pass

### 6.1 Copy replacements

| Current | New |
|---|---|
| `Field Guide • Condition-Aware Trip Engine` | `Field Guide` |
| `Answer-First Weekend Finder` | *(remove the pill)* |
| `Turn your free weekend into the right camping trip` | `Find a campground that fits your weekend` |
| `Condition-aware trip cards matched to your group, your vehicle, and your gear. No 50,000 dots to guess from.` | `Matched to your group, vehicle and gear. Every answer shows where it came from.` |
| `5-Axis Radar` / `5-Axis Match Profile` | *(deleted with the radar)* |
| `Weather Ribbon` | `Forecast` |
| `Atmospheric Telemetry` | `Conditions` |
| `Camper Condition Synthesis` | `Weather brief` |
| `P10-P90 Climatology Analog` | `Typical for this date` |
| `Live Radar Sync` | `Live forecast` |
| `Climatology AI` | `Typical for this date` |
| `Microclimate Envelope & Terrain Impact` | *(remove the sub-heading)* |
| `Plan B Engine` / `Condition-Aware Alternatives` | `Alternative sites` |
| `Bush Mode Offline Vault` / `Zero Reception Ready` | `Offline trips` / `Ready offline` |
| `Bush Offline Mode Active` | `Offline` |
| `Live Field Guide` | `Field Guide` |
| `Audience Telemetry & Lead Captures` | *(orphan modal deleted)* |
| `Phase 2 • Preparation Board` | `Preparation` |
| `Phase 2 • Shared Trip Room` | `Trip room` |
| `The Catch:` / `The Compromise` / `Key Ground Fact:` | `Watch for` (one term everywhere) |
| `Field Reports (14d):` | `Recent reports` |
| `10s Check-in` / `Report in 10s` | `Report conditions` |
| `⚡ 10s Check-in` button | `Report conditions` |
| `Synchronizing microclimate sensors & terrain data...` | `Loading conditions…` |
| `Scanning proximity, weather radar, and dog/vehicle clearance...` | `Finding alternative sites…` |
| `Scanning nearby town amenities & field reports...` | `Loading nearby towns…` |
| `Analyzing campsite terrain, weather forecasts, and gear needs...` | `Building your checklist…` |
| `Connecting to Trip Room telemetry...` | `Loading trip room…` |
| `Loading your trips and condition monitors...` | `Loading your trips…` |
| `Live Synoptic Forecast (BOM / Open-Meteo)` | `Live forecast (BOM / Open-Meteo)` |
| `30-Yr Climatology Normal (Model Analog)` | `Typical for this date` |
| `Answer-first Australian trip finder with real-time condition monitoring, terrain microclimate calculations, and automated Plan B escape routes.` | `Campground finder for Australian campers. Live fire ratings, forecasts, and where every answer came from.` |
| `Verified condition monitoring, statutory Total Fire Ban tracking, and printable offline GPS packs for Australian campers.` | `Live fire danger ratings, Total Fire Ban status, and printable trip packs for Australian campers.` |
| `Help Shape Camp Smart AU` | `Tell us what to fix` |
| `Zero-third-party tracker footprint (Stored strictly in Camp Smart PostgreSQL)` | `No third-party trackers. Event data stays in our own database.` |
| `Zero Data Selling` | `We don't sell your data` |
| `Elevate your adventures` / `Your gateway to…` (any remaining marketing register) | plain statements of what the app does |

### 6.2 Product name

One canonical string, **Camp Smart Australia**. Update: `frontend/src/app/layout.tsx` (title, OG, twitter, JSON-LD, `appleWebApp.title`), `frontend/src/app/page.tsx:285-286` (wordmark), `frontend/src/components/Footer.tsx`, `frontend/src/app/terms/page.tsx`, `frontend/src/app/privacy/page.tsx`, `frontend/src/app/pack/[id]/page.tsx:98`, `frontend/src/components/PreparationBoard.tsx:516`, `frontend/src/components/trust/SourceSheet.tsx:57`, `frontend/src/components/BetaFeedbackModal.tsx:189-201`, `frontend/src/app/trip/[token]/page.tsx:233`, `frontend/src/app/explore/[slug]/page.tsx`, `frontend/public/manifest.json`.

The domain `smartcampingau.com` stays — display name and domain differ, which is a business decision, not a UI one. Do not change `metadataBase`.

### 6.3 Emoji → lucide

Remove all ~40 emoji. Lucide equivalents already available: `Droplets` (💧), `Flame` (🔥), `Car`/`Truck` (🚗🚜), `Wifi`/`Signal` (📶📵), `Dog` (🐶), `Layers` (✨/🚫 toilets), `Sun`/`CloudRain`/`Wind` (☀️🌧️💨), `Radio` (📡), `Backpack`/`Package` (🎒📦), `CheckSquare` (📋), `MessageSquare`/`Users` (💬), `Star`/`RefreshCw` (⭐🔄), `MapPin` (📍), `Check`/`CheckCircle2` (✅), `AlertTriangle`/`AlertCircle` (⚠️🚨), `Info` (ℹ️), `Lock` (🔒), `Zap` (⚡), `Download` (📥), `ShoppingCart` (🛒), `NotebookPen` (📝), `Tent` (⛺), `Circle`/`CircleDot` (🟢🟡🔴), `Moon` (🌙), `Snowflake` (❄️), `Ban` (🚫), `Info` (◌).

---

## 7. Bugs to fix along the way

| Bug | Location | Fix |
|---|---|---|
| `animate-fadeIn` used but only `.animate-fade-in` is defined — the Preparation Board and Trip Room modals have no entry animation | `PreparationBoard.tsx:177`, `TripRoomModal.tsx:243` | use the correct class name |
| `public/maplibre/maplibre-gl-shared.mjs` is 0 bytes | `frontend/public/maplibre/` | confirm the worker does not reference it (`rg shared` on the worker); if unreferenced, delete the file |
| `AnalyticsDashboardModal.tsx` — 369 lines, imported nowhere | `frontend/src/components/` | delete |
| CRA boilerplate SVGs (`file.svg`, `next.svg`, `vercel.svg`, `window.svg`) | `frontend/public/` | delete |
| `manifest.json` declares a 4th theme (`#00ff88` / `#051c14`) and a `globe.svg` icon | `frontend/public/manifest.json` | `theme_color: "#2F5D50"`, `background_color: "#F4F0E6"`, name `Camp Smart Australia`, short_name `Camp Smart AU`, replace the globe icon with a simple eucalypt-on-paper mark |
| `globals.css` dead utilities `.paper-card`, `.paper-card-subtle`, `.animate-float` | `globals.css:73-93` | remove |
| `console.log("FETCHED CAMPSITES COUNT:", data.length)` in production | `frontend/src/app/page.tsx:258` | remove |
| `PrintButton.tsx` uses `blue-600` — off-palette | `frontend/src/app/pack/[id]/PrintButton.tsx` | restyle to the token set |
| `/pack/[id]` uses `border-4 border-black` and grey Tailwind defaults | `frontend/src/app/pack/[id]/page.tsx:50-60` | keep the monochrome print sheet (it is the best-looking surface in the app) but align it to the new type scale and the 2px rule |
| `#E76F51` (coral) used in terms/privacy/footer but in no token | `terms/page.tsx:25,82,88`, `privacy/page.tsx:25`, `Footer.tsx:65` | replace with `--color-clay` |

---

## 8. Phasing

Each phase ships independently and is reviewable.

| Phase | Work | Ships |
|---|---|---|
| **0. Truth** | §5.1–5.5 backend fixes + the frontend fallbacks they kill. No visual change. | Real "Known N of 9", real per-state counts, no false "2WD"/"TENT"/"Verified" claims. |
| **1. Foundation** | §3 tokens, type scale, fonts, `ui/` primitives, `globals.css` rewrite, radius collapse. No screen changes yet. | Everything after this is cheap. Legacy markup degrades gracefully because the radius scale is already collapsed. |
| **2. Planner + card** | §4.1–4.3. The new ledger card, the hero, the search row, the grid. | The main surface is transformed. Highest visible return. |
| **3. Surfaces** | §4.4–4.7. Map + Positron, `/explore`, `/trip`, `Footer`, plus §7 dead-code and bug fixes, `not-found`/`error`/`loading`. | One consistent surface. Legacy alias tokens removed. |
| **4. Voice** | §6 in full — copy table, product name, emoji removal, `manifest.json`. | Reads human. |
| **5. (optional) Sources** | §4.8 `/sources` page, `sitemap.ts` entry. | Closes the "provenance still invisible to users" gap. |

Phase 4 can be folded into Phases 2 and 3 per-surface, but keep the copy table as the checklist either way.

---

## 9. Validation

**Gates (from `plan_v3.md:1062-1065`) — all must pass:**

```bash
cd backend  && pytest tests/ -q          # 100% passing
cd frontend && npx tsc --noEmit          # 0 errors
cd frontend && npm run lint              # 0 errors
```

**New regression gates for this uplift** — add to CI or a pre-commit hook:

```bash
# no hardcoded hex outside globals.css
rg -n '(bg|text|border|ring|fill|stroke)-\[#[0-9A-Fa-f]{3,8}\]' frontend/src --glob '!app/globals.css'

# no large radii
rg -n 'rounded-(xl|2xl|3xl)' frontend/src

# no emoji
rg -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F1E6}-\x{1F1FF}]' frontend/src

# no font-black
rg -n 'font-black' frontend/src

# no sub-11px text
rg -n 'text-\[(9|10|10\.5)px\]' frontend/src

# no legacy dark tokens
rg -n '#00FF88|#00e67a|#071912|#18231E|#0b1b14' frontend/src
```

**Manual review, per route, at 375 / 768 / 1280 px:** `/`, `/explore/nsw`, `/trip/{token}`, `/pack/{id}`, `/privacy`, `/terms`, plus the Trip Room, Preparation Board, Plan B, Source Sheet, Ground Check-in, Feedback, Offline Vault and Compare Tray modals.

**Data-truth spot checks** (run the app against a seeded DB and confirm the rendered card matches the DB row):
- A site with `facilities = NULL` shows `Not verified yet` for water/toilets/campfires — never a guess.
- The "Known N of 9" figure equals the real count of non-`unknown` bases.
- The state dropdown shows the live `GROUP BY` totals.
- A site with `rig_access = NULL` shows `Clearance not recorded`, not `2WD`.
- The forecast row shows `Live forecast` or `Typical for this date` matching `forecast_source`; a date beyond 15 days shows the climatology label.
- `Fire` shows the live rating for NSW, and the `FIRE STATUS UNAVAILABLE` banner for QLD.

**Regression guard for the map:** with Positron, confirm campsite circles remain visible and clickable at zoom 3–14, the route line is legible over both land and water, and MapLibre's popup chrome is restyled (not the default white).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| `next/font/google` needs network at build time | Verify the build box can reach fonts.googleapis.com. Fallback: `next/font/local` with self-hosted woff2. |
| Positron glyphs/sprite come from `tiles.basemaps.cartocdn.com` (a different origin from the style) | CSP already allows `https:`. Verify label rendering in a production build, and that the PWA offline cache degrades acceptably without labels. |
| Changing `/explore/[slug]` markup could affect search rankings | The `h1`, JSON-LD (`BreadcrumbList`, `ItemList`), canonical URL and sitemap are untouched. Only presentation changes. Diff the rendered HTML before/after for structured-data parity. |
| Radius collapse + restyle touches ~30 files | Ship by phase. Each phase is independently reviewable; the collapsed radius scale means a partial migration still looks coherent. |
| Uncommitted work in the tree (37 modified + 6 untracked files) | Commit or stash before starting. Do not let a UI refactor mix with the pending backend/security changes. |
| Real fact counts will change the numbers the UI shows (6/9/3 → real values) | That is the intent. Update any test or snapshot that asserts the old figures. |
| `not-found`/`error`/`loading` are new routes and change 404 behaviour | Keep them minimal and link back to `/`. Confirm `robots.ts` still disallows `/trip/` and `/pack/`. |

---

## 11. Out of scope

Explicitly **not** part of this uplift, per `PLAN.md`, `plan_v2.md`, `plan_v3.md`, `data_plan.md` and the competitor review:

- Real-time availability or booking integration (no public API — render `Availability not checked.`)
- Reviews, ratings, or campsite photos (no authoritative source; photos are out of scope by plan)
- Crowd prediction, stargazing score, comfort micro-forecasts
- SMS delivery, voice-to-text, Telegram, DeepSeek background agents
- A dark mode theme (decision: one light surface)
- Elevation data / real topographic contours (the motif is decorative and must be labelled as such)
- `MicroclimateEngine.get_forecast_async` event-loop blocking (file separately)
- Domain change (`smartcampingau.com` stays)

---

## 12. Open questions for the implementer

1. Does the build environment have network access for `next/font/google`? (Decides §3.3 implementation.)
2. Should the ledger facts list render as rows on all viewports, or become a two-column grid ≥ 1024 px? (A two-column ledger is denser and more guide-like; a single column is easier to scan.)
3. Should `/pack/{id]` keep its current monochrome print aesthetic exactly, or take the new type scale while staying monochrome? (Recommendation: take the type scale, stay monochrome — print is a different medium.)
4. Is `/sources` (§4.8) wanted now, or deferred past this uplift?
