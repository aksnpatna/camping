# Camp Smart Australia — Plan v3: Trust, Truthfulness & Pilot Depth

> **For Agents & Engineers:** MANDATORY WORKFLOW: Adhere to `tdd-workflow`, `backend-architect`, `api-patterns`, `ui-ux-designer`, and `lint-and-validate` per `AGENTS.md`. Write failing tests before modifying implementation code. Never fabricate data fields or silently drop user constraints.

**Goal:** Transform Camp Smart Australia from an 85% complete prototype into an uncompromisingly truthful, defensible camping copilot by eliminating all synthetic claims, implementing real email notification delivery, parsing official NSW fire feeds per-district, and establishing a deeply verified 30+ campsite pilot catchment in the Greater Sydney / NSW zone.

**Architecture:** 
- **Backend:** FastAPI + PostgreSQL + PostGIS (SQLAlchemy 2.0, Alembic migrations) + Async background workers.
- **Data & Safety:** Official NSW RFS XML feed (`fdrToban.xml`) with per-district parsing; Open-Meteo live forecasts; OSRM server-side routing; Local GPU LLM (Qwen3-9B on `:8002` via `llama-swap` with Ollama & Groq fallback).
- **Delivery:** Pluggable transactional email service (`EmailService`) for magic links and Plan B condition-shift alerts.
- **Frontend:** Next.js 14 App Router (Vanilla Tailwind/CSS, MapLibre GL, PWA Service Worker caching).

---

## 📋 Executive Audit Summary & Context

> **Status update (2026-10-11):** findings 1–4 below have been **implemented and verified in code** — see "✅ Execution Status" immediately below for the line-by-line confirmation, and for the two regressions the fixes introduced (**R1 token leak**, **R2 alert spam**) plus the residual data-integrity defects (**R7** coordinates, **R8** templated fees). Finding 5 is unchanged.

An exhaustive review of the codebase against `plan_v2.md` and competitor benchmarks ([1791694364548-implementation-data-competitor-review.md](file:///.kilo/plans/1791694364548-implementation-data-competitor-review.md)) revealed that while the 3 core user journeys (**Choose**, **Prepare Together**, **Stay Informed**) are built end-to-end, **the product currently outruns its underlying data**:
1. **Fabricated Content in Trip Cards:** Canned compromises cycling by modulo (`recommendation_engine.py:142-149`), templated costs, and all 22 seed sites defaulting to the NSW NPWS homepage for bookings regardless of state or jurisdiction.
2. **Missing Delivery for Plan B:** Alerts marked `DELIVERED` when no email/push exists; worker self-disables monitoring after a single alert (`trip.plan_b_alert_active = False`); dashboard requires an access token that campers have no way of receiving.
3. **Safety Feed Vulnerabilities:** Non-NSW requests synthesize a `Moderate/live` rating (violating the non-negotiable fire degradation rule); NSW RFS XML is parsed by full-text keyword matching across the whole state rather than per-district.
4. **Data Void in Seed:** Only 2 of the 22 seeded sites are in NSW (none dog-friendly), causing 3 of 4 homepage presets ("Sydney + Dog <3.5h", "Family <2h", "90-min overnight") to return 0 results. No facilities or fee fields exist in the database model.
5. **Competitive Opening (Oct 2026):** WikiCamps AU (post-G'day Parks acquisition) suffers widespread backlash over stripped features, deleted free camping listings, and subscription hikes. Camp Smart's moat is **absolute honesty and curation in a dense pilot catchment**, not competing on 65,000 unverified map dots.

---

## ✅ Execution Status (verified against code, 2026-10-11)

Commits `b475b6b` (Phase 1) and `7879600` (Phases 2–3) were inspected line-by-line. **12 of the 13 audit findings are genuinely fixed.** Two new defects were introduced *by* the fixes, one critical.

### Achieved

| Audit finding | Status | Evidence |
|---|---|---|
| Canned `main_compromise` rotated by modulo | ✅ **Fixed** | Derived from `facilities`/`rig_access`/`dog_friendly`/`management_type` — `recommendation_engine.py:141-165` |
| Templated `estimated_cost` | ✅ **Fixed** | `cost = site.fees or "Fee unverified"` — `:168` |
| Blanket NPWS booking fallback | ✅ **Fixed** | `:169`; seed now has 29 distinct URLs for 32 records, incl. 17 per-campground NPWS deep links |
| Cosmetic `highlight_badge` | ✅ **Fixed*** | Data-derived `:178-188`. *Residual: `"Scenic Escape"` fallback still cosmetic; `dist_km < 120` uses straight-line km |
| Non-NSW synthesized `Moderate`/`live` | ✅ **Fixed** | `status:"unavailable"`, `rating:None`, `total_fire_ban:None` — `fire_status.py:19-29` |
| Whole-feed keyword fire parsing | ✅ **Fixed** | `ElementTree` parse of `fdrToban.xml` per `District`; TFB from `FireBanToday` — `fire_status.py:31-75` |
| Synthetic `sentiment_score` | ✅ **Fixed** | `Optional[int] = None` + attributed `observations` + `retrieved_at`; cache TTL 24h → 10min — `campsites.py:19-35` |
| Monitoring self-disables after one alert | ✅ **Fixed** | `plan_b_alert_active = False` removed from both paths — `plan_b.py:100,132` |
| No email delivery mechanism | ✅ **Fixed** | `EmailService` + `dispatch_alert_email` — `email_service.py`, `plan_b.py:16-30` |
| No path to obtain a dashboard token | ✅ **Fixed** (but see R1) | `POST /api/v1/auth/request-magic-link` |
| Missing facilities/fees/booking/district fields | ✅ **Fixed** | Model + schema + migration `5786ce495831` |
| Seed: 22 national / 2 NSW / 4 dog-friendly | ✅ **Fixed** | 32 NSW catchment sites, 13 dog-friendly, 7 fire districts |
| Geolocation forwarding (Task 4.2) | 🟡 **Partial** | Search + adjust use `startLocation?.latitude ?? -33.8688` (`FindWeekendPlanner.tsx:93,107`); on-mount auto-load still hardcodes Sydney (`:168`) |

### Remaining defects — **R1–R6 ✅ FIXED** (Phase 0, 2026-10-11) · R7–R13 open

> **Phase 0 is implemented and verified.** `52 passed` (baseline was 32), `npx tsc --noEmit` clean, `npm run lint` clean, migration `a3f1c9d47e02` applied.
>
> | Defect | Fix | Evidence |
> |---|---|---|
> | **R1** token leak | Random single-purpose token, SHA-256-hashed at rest, 30-min TTL, revocable; response reduced to `{email, message}`; generic copy so the endpoint is not an enumeration oracle; startup fails closed on the dev secret in production-like envs | `models/magic_token.py`, `services/magic_link.py`, `schemas/auth.py`, `endpoints/auth.py`, `main.py`, `worker.py` |
> | **R2** alert spam | `should_dispatch_alert()` — 24h cooldown per `(trip, alert_type)`, re-alerts only on genuine severity escalation (levels 1–3), one alert per news source URL per trip; monitoring stays active | `worker/plan_b.py:86-113` |
> | **R3** fake `SENT` | `EMAIL_TRANSPORT` (`smtp`/`outbox`/`none`); `_send()` returns `SENT`/`FAILED`/`QUEUED_OUTBOX`/`DISABLED` and only `SENT` when SMTP accepted; loud startup warning when mail cannot reach campers | `services/email_service.py`, `core/config.py` |
> | **R4** `fire_district` unwired | Exposed on the recommendation card payload and TS type; `getFireStatus(state, district?)` now district-aware; **residual:** per-campsite fire panels land with the Phase 5.2 SEO pages | `schemas/trip_recommendation.py`, `recommendation_engine.py:227`, `explore/[slug]/page.tsx`, `FindWeekendPlanner.tsx:46` |
> | **R5** `Moderate` coercion | Unknown → `"No Rating"`; TFB read from `FireBanToday` only (never inferred from rating), absent → `null`; UI renders unknown distinctly instead of a reassuring "Not Declared" | `endpoints/fire_status.py:58-91`, `explore/[slug]/page.tsx` |
> | **R6** alternatives ignore intent | Reuses `RecommendationEngine.get_driving_stats`; honours saved `origin`/`max_drive_hours`/`rig_access`/`has_dog`; ranks by real proximity; fetches **each candidate's own** Open-Meteo window; reason strings built only from checked facts, with `conditions_verified` exposed | `worker/plan_b.py:116-196` |
>
> Also fixed while in there: news alerts now labelled **"Unverified condition signal … confirm with the official park or fire authority"** and carry `source_url`; `news_scraper` returns result URLs; non-NSW degradation banner no longer hardcodes "NSW RFS"; `alembic/env.py` imports every model so autogenerate sees the full metadata.
>
> **Design note:** issuing an alert token deliberately does **not** revoke the camper's existing token — auto-revocation killed open dashboard sessions mid-alert. Each token expires on its own TTL; `revoke_magic_tokens()` is available for explicit invalidation.
>
> **Known residual (accepted):** `retry_count` increments on failure but there is no retry loop, and the outbox is in-memory. Both belong to the persisted-outbox work item in Task 0.3.

The original findings, kept as the record of what was wrong:

**R1 — 🔴 CRITICAL: magic-link endpoint leaks the token it protects.** `MagicLinkResponse` returns `token` **and** `magic_link` in the HTTP body (`schemas/auth.py:6-10`, populated `auth.py:23-28`). Any unauthenticated caller can POST *any* email and immediately receive that account's valid token → read saved trips, `switch-campsite`, `simulate-alert`. This inverts plan_v2 fix #1: the ownership check (`saved_trips.py:20-26`) is intact but trivially bypassable. Compounding: token is a permanent deterministic `HMAC(SECRET_KEY, email)` — no expiry, nonce or revocation — and travels in URLs (mail logs, browser history, `Referer`). `SECRET_KEY` still defaults to `"dev-secret-key"` (`config.py:16`).
→ Response returns `{message}` only; token lives solely in the emailed link. Add nonce + expiry + `used_at`. Fail closed at startup on default/unset `SECRET_KEY` outside dev.

**R2 — 🔴 HIGH: alert spam — the persistence fix removed the only throttle.** Worker runs hourly (`worker.py:16`), `plan_b_alert_active` now stays `True` forever, and neither path checks for an existing alert. A trip 5 days out with persistent ≥70% rain creates a **new row and a new email every hour** (~24/day, ~120/trip). The news path is worse: one stale headline containing "fire" re-fires hourly and permanently (`plan_b.py:112-115`).
→ Dedupe on `(saved_trip_id, alert_type)` with 24h cooldown; re-alert only on *change*; one alert per matched source URL per trip.

**R3 — 🟠 `delivery_status="SENT"` is still fiction under default config.** `SMTP_HOST` defaults to `None` (`config.py:11`) and `_send()` returns `True` after only appending to an in-memory outbox (`email_service.py:97-113`) — the same fake-delivery pattern, renamed. Outbox is lost on restart.
→ Return `False`/`DISABLED` with no transport; persist outbox to a table; assert transport config at worker startup.

**R4 — 🟠 `fire_district` is stored but never read.** Appears only in model/schema/crud/seed/migration/tests — **no endpoint or page passes it**. The per-district fire feature is unreachable: all 32 sites render "Greater Sydney Region" while **17 of 32 are in other districts** (Illawarra/Shoalhaven 5, Southern Ranges 3, Central Ranges 3, Central Coast 3, Hunter 2, Far South Coast 1).
→ Expose on `GET /campsites/{id}` + card payload; campsite/SEO/pack pages call `/fire-status?district=<site.fire_district>`.

**R5 — 🟠 Unknown ratings still coerce to `"Moderate"`.** `findtext("DangerLevelToday", "Moderate")` (`fire_status.py:60`) and `rating = raw_rating if raw_rating in VALID_RATINGS else "Moderate"` (`:65`). `"No Rating"` exists in `VALID_RATINGS` but is unreachable — a missing/renamed element silently renders a real moderate rating in the safety path.
→ Default to `"No Rating"`; route unparseable feeds to the 503 degradation path.

**R6 — 🟠 Plan B alternatives ignore saved intent and never check weather.** `find_plan_b_alternatives` filters on `state` only (`plan_b.py:32-53`), ignoring `origin_lat/lng`, `max_drive_hours`, `rig_access`, `party_size` (all on the model), and never queries the alternative's forecast — yet asserts `"Stable alternative … matching your party requirements"`. PLAN.md's promise ("3 alternatives within 90 minutes that are still dry") is unmet; with an all-NSW dataset "same state" means *anywhere in NSW*, up to ~14h away.
→ Reuse `RecommendationEngine` eligibility against preserved intent; score candidates on their own Open-Meteo window; emit reasons only from checked facts.

**R7 — 🟡 Seed coordinates contradict the authoritative published GPS.** Verified against Forestry Corporation's own campground coordinates: **Daly's Clearing** seed `POINT(150.2541 -34.5264)` vs published `-34.527643, 150.241341` → **~1.18 km off**; **Wingello HQ Camp** seed `POINT(150.1872 -34.6978)` vs `-34.715833, 150.189104` → **~2.00 km off**; **The Pines/Turpentine** sit ~14 km east of the GPS published for Olney SF. 1–2 km in state forest is a wrong track junction, at night, without reception.

**R8 — 🟡 Fees are internally inconsistent: templating moved from runtime into the seed.** `$24.60/night` repeats across **8** campgrounds and `$34.00/night` across **3**, regardless of facilities. Under any facility-tiered schedule this is impossible: Mill Creek (pit, no shower) = Gambells Rest (flush + **hot showers**) = Capertee Valley = Cattai = **$24.60**, while Bonnie Vale (flush + hot) = **$34.00** and Green Patch (flush + hot) = **$28.00**. Fabrication was correctly removed from the engine and relocated into "canonical" records that now carry `source_url`s implying verification. **Highest-priority data-integrity finding.**

**R9 — 🟡 Booking status wrong for free NPWS sites.** NPWS requires online booking for **all** campgrounds. Engine emits `"Free / First-Come, First-Served"` when fees look free and no booking URL exists (`recommendation_engine.py:171-176`) and badges 15 sites `"Free Camping"`. Free ≠ no booking for NPWS (correct only for Forestry state forests).

**R10 — 🟡 Facility schema omits what the fee tiers depend on.** Only `toilets/showers/drinking_water/campfires` (`models/campsite.py:22`). No `bbq`, `shelter`, `disabled_access` — yet Olney SF's The Pines is documented with BBQ + picnic facilities, and NPWS tracks 10,287 such assets statewide. NPWS tiers 3–4 are *defined* by tables/BBQ/shelters, so the current schema cannot derive a tier.

**R11 — 🟡 Jurisdiction error.** Green Patch is in Booderee NP, **Jervis Bay Territory** — seeded `state:"NSW"` with an NSW fire district (its `booking_url` correctly points to parksaustralia.gov.au). Geofabrik also bundles JBT into its NSW extract, so this will recur on bulk ingest without an explicit carve-out rule.

**R12 — 🟡 Facility constraints still silently dropped.** `requires_toilets/showers/drinking_water` exist nowhere; `facilities` is read only for *display* (`recommendation_engine.py:147-153,200`) and `FindWeekendRequest` has no facility fields. Preset #2's *"toilets essential"* and preset #3's *"4WD tracks preferred"* are accepted and ignored — **Task 4.1 is unbuilt**, so plan_v2's "never silently drop requirements" is still violated for 2 of 4 presets.

**R13 — 🟡 Likely-invented records.** "Blackheath Glen" (Megalong Valley; flush toilets, potable water, free, generic `bmcc.nsw.gov.au/camping`) is uncorroborated; Mystery Bay is ~4h30 from Sydney (outside the 3.5h catchment — this plan's own table flags it) and is Eurobodalla Shire, not `mysterybay.com.au`.

---

## 🔐 Data Sourcing: Legality, Licensing & What "Transformed Use" Actually Means

> Not legal advice. PLAN.md already mandates confirming BOM/RFS commercial licensing in Week 1 and reviewing Australian Consumer Law exposure — treat this section as the engineering input to that review, not a substitute for it.

### The one correction that matters most

**Australia has no general "fair use" doctrine.** "Transformed use" is a *United States* fair-use concept. Australia has only **fair dealing**, which is closed-list and narrow: research or study, criticism or review, parody or satire, reporting news, professional legal advice, and access for people with disability. **Aggregating campground data into a commercial, affiliate-monetized product does not fit any of those purposes.** So "I'm using it in a transformed way, therefore it's fine" is *not* a defence available here. Plan around licence and permission, not around transformation.

What *is* true and useful: **individual facts and information are not protected by copyright** in Australia. Copyright protects the *expression* of information and, where sufficient labour/selection is involved, a *compilation* (the database itself) as a literary work. Practically:

- ❌ Risky: bulk-copying an agency's table/database and republishing it, even reshaped.
- ✅ Much safer: taking **individual facts** (this campground has pit toilets; the fee is $X; these are its coordinates), re-expressing them in **your own schema and your own words**, with **your own verification record** (source URL, retrieval time, parser version), and deriving your own recommendations from them.
- ✅ Safest of all: using data published under an **open licence that already grants commercial reuse** — which is exactly the case for the primary NSW source below.

### Per-source verdicts (all verified live, 2026-10-11)

| Source | Licence / permission | Commercial use | Verdict |
|---|---|---|---|
| **SEED / Data.NSW — NPWS "Asset Infrastructure: Visitor Area"** (camping areas) | **CC-BY 4.0**, `license_id: "cc-by"`, `isopen: true` | ✅ **Yes** | **Primary source. No permission needed, no transformation needed** — CC-BY grants reproduction, adaptation and commercial redistribution subject only to attribution. This is *published open data*, not scraping. |
| **SEED / Data.NSW — "Asset Infrastructure: Facility Point"** (BBQ/shelter/picnic assets) | **CC-BY 4.0**, `isopen: true` | ✅ Yes | Same as above. |
| **OSM `tourism=camp_site`** (4,101,652 objects globally, taginfo 2026-10-10) | **ODbL 1.0** | ✅ Yes, with conditions | Permitted commercially with attribution + **share-alike on derivative databases**. Keep in a **separable layer** with no FK into `canonical_campsites` (PLAN.md already requires this) so ODbL cannot reach proprietary records. |
| **nationalparks.nsw.gov.au campground pages** | Website copyright + T&Cs; **robots.txt verified: `/camping-and-accommodation/campgrounds/*` is NOT disallowed** | ⚠️ Fact-verification only | robots.txt disallows only `/atdwbuilddata`, specific `/tours/*` audio pages, `/test*`, `/site*`, and explicitly `Allow: /sitemap.xml`. **Harvesting campground pages is not contrary to the published robot directives.** Still: check the site T&Cs, extract *facts* not prose, rate-limit, identify yourself, and never republish their text/photos. |
| **forestrycorporation.com.au** (campground guide + per-forest pages) | Website copyright + T&Cs; **robots.txt verified: `User-agent: *` / `Disallow:` (empty) = all paths allowed** | ⚠️ Fact-verification only | Explicitly permits spidering. Their free-camping guide publishes campground names **with GPS coordinates** — ideal for verifying R7. |
| **Forestry Corporation ArcGIS Hub datasets** (`data-fcnsw.opendata.arcgis.com`, 39 datasets) | **Mixed and mostly non-commercial**: 15× `CC-BY-NC-SA 4.0`, 1× `CC-BY-NC`, 2× `CC-BY-NC-ND`, vs only 4× `CC-BY 4.0` and 3× `CC0`; 9 blank, 1 the literal string `"null"`, 2 embed the licence in raw HTML | ❌ **Mostly no** | **Do not use the NC datasets in a monetized product.** Moot for camping anyway — exhaustive search found **zero** camping/recreation/visitor datasets in that catalogue. Data.NSW separately lists the State Forest boundary as plain "Creative Commons Attribution", so **metadata conflicts → get written confirmation per dataset before commercial reuse.** |
| **RFS `fdrToban.xml`** | PLAN.md Week-1 item | ⚠️ Confirm | Already in production use for live fire ratings; confirm commercial display licensing + attribution requirements before scaling. |
| **BOM / Open-Meteo** | Open-Meteo commercial licence | ✅ Paid tier | PLAN.md already specifies commercial licensing for the monetized platform. |

### The pattern that is both legally safest *and* the product's differentiator

For anything not covered by an open licence, do **not** copy — **verify and record your own observation**:

```
fact_evidence(campsite_id, field, value, source_url, retrieved_at,
              published_at, parser_version, data_status)
data_status ∈ { verified | rule_derived | unverified }
```

Store the *fact* plus where and when you observed it, express it in your own schema and your own UI copy, and render "Not verified yet" where you have no evidence. That is factual verification with provenance — materially different from republishing someone's database — and it is precisely the trust posture PLAN.md claims as the moat. It also fixes R8 for free: a fee you cannot evidence simply stays `unknown`.

### Four facts that need no harvesting at all

Each is a single authoritative policy statement covering hundreds of sites — the cheapest, safest data in the entire plan:

1. **Dogs in NSW national parks: prohibited** → `dog_friendly=False` for all 729 NPWS camping areas, minus documented exceptions.
2. **Dogs in NSW state forests: welcome under effective control** (Forestry Corporation, statewide) → `dog_friendly=True` for all state-forest campgrounds.
3. **State-forest camping: free, no booking required** → `fees="$0 (Free)"`, `booking_status="No booking required"`.
4. **NPWS: online booking required for ALL campgrounds** → `booking_status="Booking required"` even at $0 (fixes R9).

Encode these as **versioned data rows**, not code constants, so a policy change is one row update plus re-derivation:

```
policy_rule(id, land_manager, field, value, evidence_url, effective_from, effective_to)
```

---

## ⚡ Performant & Efficient Ingestion Pipeline

Design principle: **separate fetch from parse, cache by content hash, and make every stage idempotent and resumable.** At this data volume (729 records, ~100 pages) correctness and repeatability matter far more than raw throughput — but the same design scales to national coverage without change.

### Confirmed artefacts (use the download package, not the REST query)

⚠️ **Verified blocker: the `AMS_Assets` MapServer returns attributes but suppresses geometry.** With `returnGeometry=true`, `f=geojson` yields `"geometry": null` and `f=json` omits the `geometry` key entirely. The REST layer also exposes only 5 of the documented fields (`OBJECTID`, `SAPFLID`, `AssetName`, `AssetType`, `AssetStyle`), whereas the layer metadata documents `CaravansAllowed`/`CamperTrailersAllowed`/`MotorhomesAllowed` (coded `0/1/9999=Unknown`), `DisabledFacility`, `TentSiteCount`, `PoweredSiteCount`. Both CKAN resources report `datastore_active: false`, so there is no `datastore_search` shortcut — **download the ZIPs**:

| Dataset | CC-BY ZIP |
|---|---|
| Visitor Area (729 camping areas) | `https://datasets.seed.nsw.gov.au/dataset/2d53a537-a6e1-402a-bbf4-7075123e3751/resource/18d89454-3bef-42b1-a269-0b5a95924b75/download/infrastructure_npws_visitorarea.zip` |
| Facility Point (10,287 assets) | `https://datasets.seed.nsw.gov.au/dataset/a60d2562-0c36-4745-9200-bacdefce3acd/resource/9269c237-0754-46dc-b1c8-db43f43a92a6/download/infrastructure_npws_facilitypoint.zip` |
| Data Quality Statements | `…/asset-infrastructure-visitor-area/resource/data_quality_report/pdf` (and the facility-point equivalent) |

Dataset notes: `temporal_coverage_to: 2026-08-13`, `metadata_modified: 2026-10-03`, `update_freq: asNeeded`, SRID **4283 (GDA94)**. The publisher warns *"for external supply the dataset is simplified with certain attribute fields being removed"* and that **`d_`-prefixed fields** carry the human-readable domain descriptions — map from `d_*` where present.

### Stage A — SEED bulk ingest (729 records; one download, seconds to load)

1. Download both ZIPs once; verify and record the SHA-256 of each artefact as provenance.
2. Stream-read the shapefile/GeoPackage with **`pyogrio`** (or `ogr2ogr` → GeoJSON/CSV) — never load the whole file into memory.
3. Load into a **staging** table `stg_npws_visitor_area` preserving *all* native columns and SRID 4283. Staging keeps re-processing free of re-downloading.
4. **Reproject set-based in SQL, not per-row in Python:**
   ```sql
   UPDATE stg_npws_visitor_area
     SET geom_4326 = ST_Transform(ST_SetSRID(geom, 4283), 4326);
   ```
5. Upsert into `canonical_campsites` keyed on the natural key **`source_id = SAPFLID`**:
   ```sql
   INSERT INTO canonical_campsites (…) VALUES (…)
   ON CONFLICT (source_id) DO UPDATE SET …
   ```
   Guard: **never downgrade** `data_status` from `verified` to `unverified` on re-ingest.
6. Filter `SubtypeCD=5001` (Camping Area); map `AssetType` → access mode, `AssetStyle` (Bush C1 / Basic C2 / Medium C3) → `fee_tier` proxy + facility expectations.
7. **Carve out JBT and ACT explicitly** before assigning `state` (fixes R11).

At 729 rows this completes in well under a second. For future national scale (100k+ rows) use psycopg2 `copy_expert` (`COPY`) with indexes dropped during load and rebuilt after.

### Stage B — Catchment scoping & precomputed drive times (turns N API calls into O(1) lookups)

The expensive operation is routing, not storage. Do not call OSRM per user query.

1. Index `canonical_campsites.location` with **GiST**; scope with `ST_DWithin(location::geography, origin::geography, radius_m)` instead of `db.query(Campsite).all()` + Python filtering (`recommendation_engine.py:38`) — fine today, wrong at 10k rows.
2. Define **6–10 origin centroids** (Sydney CBD, Parramatta, Penrith, Gosford, Newcastle, Wollongong, Camden, Liverpool…).
3. Prefetch one OSRM **`/table/v1/driving/`** matrix per centroid → all catchment destinations. Note the public demo server caps coordinates per request (~100), so chunk; self-hosting OSRM removes the cap and is the right move before launch.
4. Persist `drive_time_cache(origin_key, campsite_id, km, minutes, computed_at)`; snap a user's origin to the nearest centroid and look up. Revalidate weekly; fall back to the existing haversine ×1.25 when stale or missing.

Result: card drive-times match the map view (fixes the current disagreement) at **zero per-request routing cost**.

### Stage C — Page harvest (the rate-limited stage; this is where efficiency actually matters)

**Fetch and parse are separate concerns.** This single decision makes the harvester cheap to iterate on:

1. `harvest_cache(url PK, status, etag, last_modified, content_hash, body, retrieved_at, parser_version)` stores the raw response.
2. **Conditional requests** — send `If-None-Match` / `If-Modified-Since`. A `304 Not Modified` transfers no body, so weekly re-checks are nearly free.
3. **Content-hash gating** — re-parse only when the hash changes. **Parser improvements replay against the cache with zero network traffic.**
4. **Politeness** — bounded concurrency (2–4), 1–2 req/s, honour `Retry-After`/`429` with exponential backoff + jitter, check `urllib.robotparser` programmatically before every fetch (both domains verified permissive, but keep the check), and send a descriptive `User-Agent` with a contact address.
5. **Prioritised queue, not exhaustive crawl** — harvest only the **top 60–100 catchment sites**, ranked by (in-catchment × dog-friendly demand × shortlist saves). Do not crawl all 729.
6. **Resumable** — persist queue state so a crash never restarts the crawl.
7. **Deterministic parsers first, LLM only as fallback** — NPWS campground pages share consistent structure, so write a CSS/XPath parser with a version stamp. Escalate to Qwen3-9B structured extraction *only* where the parser yields nulls, and cache LLM output by `content_hash` so an identical page is never re-inferred.
8. Write results as **evidence rows** (`fact_evidence`), never blind overwrites.

**Expected cost:** first pass over 60–100 pages at polite rates ≈ **1–3 minutes**; weekly re-check mostly `304`s ≈ **~1 minute**; cache ≈ **~15 MB**. Even a full 729-page crawl is ~10–20 minutes and ~110 MB.

### Stage D — Fees as a tier model (fixes R8 structurally)

Replace flat fee strings with `fee_tier` (1–6, nullable), `fee_low`, `fee_peak`, `fee_basis`, `fee_as_of`, `fee_source_url`; render as a **range with "verify at booking"**. NPWS's six-tier schedule (Free / $13–22 / $20–36 / $28–54 / $38–65 / $54–89 low→peak, ~86% of campgrounds in tiers 2–5, ~90 peak days, CPI-indexed) is the derivation model — but sources **conflict on whether it is live**: the official consultation paper and a 22-Sep-2026 analysis say still *proposed* (the Benerembah page still shows a $6 booking fee), while an Aug-2026 guide says it took effect 1 July 2026. **Store the tier and the observed price separately, with `fee_as_of`, and never a single invented number.**

### Stage E — Automated integrity gates

Two SQL assertions that would have caught the current seed defects:

```sql
-- Catches R8: identical fees across differing facility classes
SELECT fees, COUNT(DISTINCT facilities::text) AS variants, COUNT(*)
  FROM canonical_campsites
 WHERE fees IS NOT NULL
 GROUP BY fees HAVING COUNT(DISTINCT facilities::text) > 1;

-- Catches R7/R13: verified records must carry evidence
SELECT id, name FROM canonical_campsites
 WHERE data_status = 'verified'
   AND (evidence_url IS NULL OR verified_at IS NULL);
```

Run both in CI, plus a coordinate sanity check against the authoritative published GPS for every state-forest site.

### Storage budget (measured, not estimated)

Canonical rows are **~1 KB all-in** (≈0.6–0.7 KB heap + ≈0.3 KB indexes):

| Records | Table + indexes |
|---|---|
| 32 (today) | ~32 KB |
| 1,000 | **~1 MB** |
| 10,000 | ~10 MB |
| 100,000 | ~100 MB |

**The database is a rounding error.** Real space goes to artefacts: Geofabrik NSW extract **256 MB** (Australia 922 MB), SEED ZIPs ~10–50 MB, filtered `camp_site` GeoJSON ~3–8 MB, harvest cache ~15 MB (catchment) to ~1 GB (national, retention-capped), evidence rows ~125 MB/yr at weekly snapshots (keep latest + last N), NSW offline **vector** tiles z0–z13 ~150–400 MB (raster is 5–10× larger). A full `osm2pgsql` Australia import would be hundreds of GB and is **not needed**.
→ **Recommended: 20 GB for the pilot, 40 GB** with Australia-wide tiles or photos. Note `config.py:7` shares a Postgres instance (`localhost:15432`, `realestate_user`) with an unrelated project — isolate quotas and backups per database.

---

## 🎯 Phase Breakdown & Priorities

```
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 1 (P0): De-fabrication & Safety Truthfulness      ✅ COMPLETE   │
│  - Eliminate canned compromises, templated costs & default NPWS links   │
│  - Alembic migration: add facilities, fees, booking_url, fire_district  │
│  - District-level NSW RFS parsing + honest non-NSW degradation contract │
│  - Replace sentiment_score with attributed observations & citations     │
│  ↳ Residual: R4 fire_district unwired · R5 "Moderate" coercion         │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 2 (P0): Authentication & Alert Delivery Reach     ✅ COMPLETE   │
│  - Pluggable transactional EmailService (Console/SMTP/Provider)        │
│  - Magic link request endpoint: POST /api/v1/auth/request-magic-link   │
│  - Frontend 1-click magic link auth (?email=...&token=...)             │
│  - Real Plan B email delivery; preserve plan_b_alert_active = True     │
│  ↳ Residual: 🔴 R1 token leak · 🔴 R2 alert spam · R3 fake "SENT"      │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 3 (P1): Pilot Catchment Reseed                    🟡 SUPERSEDED │
│  - 32 NSW sites seeded (target 30-35 met), 13 dog-friendly, 7 districts │
│  ↳ Superseded by Phase 6: hand-written values are unverified and        │
│    provably wrong (R7 coords, R8 fees). Replace with SEED ingest.       │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 4 (P1): Facilities Constraints & Server-Side OSRM  ⬜ NOT STARTED│
│  - Parse toilets, showers, drinking water, campfires, clearance in NL  │
│  - Strict facility filtering; echo unverified requirements to camper   │
│  - Server-side OSRM drive-time routing with fallback approximation     │
│  - Geolocation forwarding  🟡 partial (on-mount path still hardcoded)  │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 5 (P2): Parity & Conversational Adjustments        ⬜ NOT STARTED│
│  - Conversational What-If (/trips/adjust) via local Qwen3 9B           │
│  - Programmatic SEO pages (30 canonical sites) with live fire status   │
│  - PWA Offline Service Worker for saved trips & packing checklist      │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 0 (P0): REGRESSIONS FROM PHASES 1-2        ✅ COMPLETE          │
│  - R1 token no longer in any HTTP response; hashed, expiring, revocable │
│  - R2 alert dedupe + 24h cooldown + escalation levels (no hourly spam)  │
│  - R3 EMAIL_TRANSPORT; honest SENT/FAILED/QUEUED_OUTBOX/DISABLED        │
│  - R4 fire_district exposed end-to-end (card panels land in Phase 5.2)  │
│  - R5 unknown rating -> "No Rating"; TFB read, never inferred           │
│  - R6 intent-aware, weather-checked alternatives with honest reasons    │
│  ↳ 52 tests pass (was 32) · tsc clean · eslint clean · migration applied│
│  ↳ Residual: no retry loop, outbox still in-memory (Task 0.3 remainder) │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 6 (P1): SOURCED DATA ACQUISITION      🟡 IN PROGRESS (6A-6C DONE)│
│  - 6A: SEED CC-BY bulk ingest → 715 camping areas (tested & in DB)  ✅ │
│  - 6B: rule-based inference (dogs / booking / free) via policy_rule ✅ │
│  - 6C: polite page harvest + Smartproxy integration + fact_evidence ✅ │
│  - 6D: OSM gap-discovery layer, ODbL-isolated                          │
│  - 6E: integrity gates in CI (fee-vs-facility, evidence-required)      │
└────────────────────────────────────────────────────────────────────────┘
```

**Sequencing:** ~~Phase 0 first~~ **Phase 0 is complete.** Next: Phase 6A–6B (bulk CC-BY coverage + rule inference — the cheapest large data win), then Phase 6C (enrichment), then Phase 4, then 6D–6E and Phase 5.

---

## Phase 0 (P0): Fix Regressions Introduced by Phases 1–2 ✅ COMPLETE
*Goal: close the two user-facing defects opened by the Phase 1–2 fixes before any further feature or data work. Small, isolated, high severity.*

> **Implemented 2026-10-11.** All six tasks landed. Verification: `52 passed` (baseline 32), `npx tsc --noEmit` exit 0, `npm run lint` clean, `alembic upgrade head` → `a3f1c9d47e02`.
> New files: `app/models/magic_token.py`, `app/services/magic_link.py`, `tests/api/conftest.py`, `alembic/versions/a3f1c9d47e02_*.py`.
> New regression guards: token never in the response body · forged/guessed/expired/revoked tokens rejected · dev secret fails closed in production · unchanged condition produces exactly one alert and one email while escalation produces a second · no-transport delivery is never `SENT` · unrecognised or missing fire rating stays `"No Rating"` · declared ban read from the feed, never inferred · alternatives respect the saved drive limit and never claim unverified stability.
> Task 0.3 remainder (persisted outbox table + retry loop) is still open and noted as such above.

### Task 0.1: Stop leaking the magic-link token (R1 — critical)
**Files:** [backend/app/schemas/auth.py](file:///home/aksai/projects/camping/backend/app/schemas/auth.py), [backend/app/api/v1/endpoints/auth.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/auth.py), [backend/tests/api/test_auth.py](file:///home/aksai/projects/camping/backend/tests/api/test_auth.py)

1. Remove `token` and `magic_link` from `MagicLinkResponse`; the endpoint returns `{"message": "..."}` only.
2. The token exists solely inside the emailed link. Nothing in any HTTP response may reveal it.
3. Replace the permanent `HMAC(SECRET_KEY, email)` with a **single-use, expiring** token: random nonce + `expires_at` + `used_at`, persisted so it can be revoked and cannot be replayed from mail logs, browser history or `Referer` headers.
4. Fail closed at startup when `SECRET_KEY` is unset or equals `"dev-secret-key"` outside a dev environment (`config.py:16`).

**Acceptance:** `POST /api/v1/auth/request-magic-link` response body contains no token; a token derived by any client-side means is rejected; an expired or already-used token is rejected; the app refuses to boot with the dev default secret in production config.

### Task 0.2: Alert dedupe and cooldown (R2 — high)
**Files:** [backend/app/worker/plan_b.py](file:///home/aksai/projects/camping/backend/app/worker/plan_b.py), [backend/app/models/plan_b_alert.py](file:///home/aksai/projects/camping/backend/app/models/plan_b_alert.py)

1. Before creating an alert, look for an existing `PlanBAlert` with the same `(saved_trip_id, alert_type)` within a 24h cooldown window; suppress the row **and** the email unless severity escalated (e.g. rain 70% → 95%, or rating High → Catastrophic).
2. News alerts: one alert per matched source URL per trip, ever — not per worker pass.
3. Keep `plan_b_alert_active = True` (already correct); re-arm explicitly rather than implicitly.

**Acceptance:** two consecutive `run_plan_b_check()` passes with an unchanged forecast create exactly **one** alert row and send exactly **one** email; a severity increase produces a second alert; a persistent news headline never re-fires.

### Task 0.3: Truthful delivery status (R3)
**Files:** [backend/app/services/email_service.py](file:///home/aksai/projects/camping/backend/app/services/email_service.py), [backend/app/core/config.py](file:///home/aksai/projects/camping/backend/app/core/config.py)

1. `_send()` must not return `True` when no transport is configured (`SMTP_HOST` defaults to `None`). Introduce a distinct `DISABLED`/`QUEUED` status.
2. Persist the outbox to a table so queued mail and `retry_count` survive a restart.
3. Assert transport configuration at worker startup and log a loud warning when alerts will not be delivered.

**Acceptance:** with `SMTP_HOST` unset, no alert row is recorded as `SENT`; queued rows are recoverable after restart; a failed send increments `retry_count`.

### Task 0.4: Wire `fire_district` end-to-end (R4)
**Files:** [backend/app/api/v1/endpoints/campsites.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/campsites.py), [backend/app/schemas/campsite.py](file:///home/aksai/projects/camping/backend/app/schemas/campsite.py), [frontend/src/components/TripCard.tsx](file:///home/aksai/projects/camping/frontend/src/components/TripCard.tsx), [frontend/src/app/explore/[slug]/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/explore/%5Bslug%5D/page.tsx)

Expose `fire_district` on the campsite/card payload and call `/fire-status?district=<site.fire_district>` from the campsite, SEO and pack pages instead of defaulting to Greater Sydney.

**Acceptance:** an Illawarra/Shoalhaven site queries that district; **17 of 32** sites currently mis-rendered as Greater Sydney now render their own district's live rating.

### Task 0.5: Unknown ratings must not become "Moderate" (R5)
**Files:** [backend/app/api/v1/endpoints/fire_status.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/fire_status.py)

Replace `findtext("DangerLevelToday", "Moderate")` (`:60`) and the `else "Moderate"` coercion (`:65`) with `"No Rating"`, and route unparseable feeds to the existing 503 degradation path rather than a fallback rating.

**Acceptance:** a feed with a missing or unrecognised `DangerLevelToday` yields `"No Rating"` (or 503), never a substantive rating.

### Task 0.6: Intent-aware, weather-checked Plan B alternatives (R6)
**Files:** [backend/app/worker/plan_b.py](file:///home/aksai/projects/camping/backend/app/worker/plan_b.py), [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)

`find_plan_b_alternatives` must reuse `RecommendationEngine` eligibility against the preserved intent (`origin_lat/lng`, `max_drive_hours`, `rig_access`, `party_size`, `has_dog`) and evaluate **each candidate's own** Open-Meteo window. Emit the reason string only from what was actually checked.

**Acceptance:** alternatives respect the saved drive limit (no ~14h "same state" matches); every suggested alternative has been forecast-checked; no reason text asserts stability that was never measured.

---

## Phase 1 (P0): De-Fabrication & Safety Truthfulness

### Task 1.1: Database Schema Extension & Alembic Migration
**Goal:** Add structured fields for verified campsite attributes instead of inventing facts at runtime.

**Files:**
- Modify: [backend/app/models/campsite.py](file:///home/aksai/projects/camping/backend/app/models/campsite.py)
- Create: `backend/alembic/versions/2b3c4d5e6f7a_add_facilities_fees_and_booking_fields.py`
- Modify: [backend/app/schemas/campsite.py](file:///home/aksai/projects/camping/backend/app/schemas/campsite.py)
- Test: [backend/tests/api/test_campsites.py](file:///home/aksai/projects/camping/backend/tests/api/test_campsites.py)

**Step 1: Write failing test in `test_campsites.py`:**
```python
def test_campsite_facilities_and_fees_fields():
    res = client.get("/api/v1/campsites")
    assert res.status_code == 200
    sites = res.json()
    assert len(sites) > 0
    first = sites[0]
    assert "facilities" in first
    assert "fees" in first
    assert "booking_url" in first
    assert "fire_district" in first
```

**Step 2: Update `Campsite` Model:**
```python
# Add to backend/app/models/campsite.py:
facilities = Column(JSON, nullable=True) # e.g. {"toilets": "flush"|"pit"|"none", "showers": "hot"|"cold"|"none", "drinking_water": bool, "campfires": bool}
fees = Column(String(100), nullable=True) # e.g. "$24.60/night", "$0 (Free)"
booking_url = Column(Text, nullable=True) # Direct reservation link or None
fire_district = Column(String(100), nullable=True) # e.g. "Greater Sydney Region", "Illawarra/Shoalhaven"
```

**Step 3: Run Alembic migration & verify test passes:**
```bash
cd backend && venv/bin/alembic revision --autogenerate -m "add facilities fees and booking fields"
venv/bin/alembic upgrade head
venv/bin/pytest tests/api/test_campsites.py -v
```

---

### Task 1.2: De-Fabricate Recommendation Cards & Engine
**Goal:** Remove canned compromise rotation, templated fees, and blanket NPWS fallback links in [recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py).

**Files:**
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Modify: [backend/app/schemas/trip_recommendation.py](file:///home/aksai/projects/camping/backend/app/schemas/trip_recommendation.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Step 1: Write failing test in `test_recommendations.py`:**
```python
def test_recommendation_cards_no_fabricated_compromises():
    req = {
        "prompt": "Quiet weekend away near Sydney",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093,
        "max_drive_hours": 4.0
    }
    res = client.post("/api/v1/trips/find-weekend", json=req)
    assert res.status_code == 200
    cards = res.json()["cards"]
    for card in cards:
        # Compromise must be rooted in real site data, not canned text array
        assert "Unsealed access track for last 2km" not in card["main_compromise"] or card.get("vehicle_clearance") == "4WD_ONLY"
        # Booking URL must not default to NSW NPWS for non-NPWS sites
        if card["management_type"] != "NPWS":
            assert card["booking_url"] != "https://www.nationalparks.nsw.gov.au" or card["booking_url"] is None
```

**Step 2: Implement factual compromise derivation:**
```python
# In recommendation_engine.py:
def derive_factual_compromise(site: Campsite, weather_summary: Optional[str] = None) -> str:
    fac = site.facilities or {}
    compromises = []
    
    # 1. Access & Rig constraints
    if site.rig_access and "4WD_ONLY" in site.rig_access:
        compromises.append("4WD required; unsealed road with steep sections")
        
    # 2. Toilet facilities
    toilet_type = fac.get("toilets")
    if toilet_type in ["pit", "composting", "drop"]:
        compromises.append("Drop/pit toilets only; bring toilet paper & sanitizer")
    elif toilet_type == "none":
        compromises.append("No toilets on site; portable camp toilet required")
        
    # 3. Water availability
    if fac.get("drinking_water") is False:
        compromises.append("Non-potable water; bring minimum 5L drinking water per person/day")
        
    # 4. Pet policy
    if site.dog_friendly is False:
        compromises.append("No pets permitted (National Park regulations apply)")
        
    # 5. Booking / Popularity
    if site.management_type in ["Forestry Corporation", "Crown Land", "State Forest"]:
        compromises.append("First-come, first-served unallocated sites; arrive early Friday")
    elif "NPWS" in (site.management_type or ""):
        compromises.append("Popular destination; advance booking required")
        
    return compromises[0] if compromises else "Ensure you pack all essentials; leave no trace"
```

**Step 3: Honest Costs, Badges, and Booking URLs:**
- `estimated_cost = site.fees or "Fee unverified"`
- `booking_url = site.booking_url or site.source_url or None`
- `booking_status = "Direct Reservation Required" if site.booking_url else ("Free / No Booking Required" if site.fees == "$0 (Free)" else "Booking Details Unverified")`
- `highlight_badge`: Real computation based on verified attributes (e.g. "Free Camping" if fees == "$0", "Dog Friendly" if dogs allowed, "Full Amenities" if flush toilets & hot showers exist).

---

### Task 1.3: Official NSW RFS District Parsing & Non-NSW Honest Degradation
**Goal:** Upgrade [fire_status.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/fire_status.py) to parse `https://www.rfs.nsw.gov.au/feeds/fdrToban.xml` per district and return honest unavailable degradation for non-NSW queries.

**Files:**
- Modify: [backend/app/api/v1/endpoints/fire_status.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/fire_status.py)
- Test: [backend/tests/api/test_fire_status.py](file:///home/aksai/projects/camping/backend/tests/api/test_fire_status.py)

**Step 1: Write failing test in `test_fire_status.py`:**
```python
def test_fire_status_non_nsw_honest_degradation():
    res = client.get("/api/v1/fire-status/VIC")
    assert res.status_code in [200, 503]
    data = res.json()
    assert data["status"] == "unavailable"
    assert "Live feed currently active for NSW pilot catchment only" in data["message"]
    # NEVER synthesize a fake Moderate/live rating!
    assert "rating" not in data or data["rating"] is None

def test_fire_status_nsw_district_parsing():
    res = client.get("/api/v1/fire-status/NSW?district=Greater+Sydney+Region")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "live"
    assert data["district"] == "Greater Sydney Region"
    assert "rating" in data
    assert isinstance(data["total_fire_ban"], bool)
```

**Step 2: Implement XML ElementTree parser for `fdrToban.xml`:**
```python
# In fire_status.py:
import xml.etree.ElementTree as ET

@router.get("/{state}")
def get_fire_status(state: str, district: Optional[str] = "Greater Sydney Region"):
    if state.upper() != "NSW":
        return {
            "state": state.upper(),
            "status": "unavailable",
            "message": "Live feed currently active for NSW pilot catchment only. Check state emergency service.",
            "rating": None,
            "total_fire_ban": None
        }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get("https://www.rfs.nsw.gov.au/feeds/fdrToban.xml")
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            
            # Find matching district
            target_elem = None
            for d in root.findall(".//District"):
                name = d.findtext("Name", "")
                if district.lower() in name.lower() or name.lower() in district.lower():
                    target_elem = d
                    break
                    
            if target_elem is None:
                for d in root.findall(".//District"):
                    if "Greater Sydney" in d.findtext("Name", ""):
                        target_elem = d
                        break

            rating = target_elem.findtext("DangerLevelToday", "Moderate").title() if target_elem else "Moderate"
            toban_text = target_elem.findtext("FireBanToday", "No") if target_elem else "No"
            total_fire_ban = toban_text.strip().lower() == "yes"
            district_name = target_elem.findtext("Name", "Greater Sydney Region") if target_elem else "Greater Sydney Region"

            return {
                "state": "NSW",
                "district": district_name,
                "rating": rating,
                "total_fire_ban": total_fire_ban,
                "status": "live",
                "source": "NSW Rural Fire Service (rfs.nsw.gov.au/feeds/fdrToban.xml)",
                "action_required": "Enforce total fire ban — no wood, gas only if permitted" if total_fire_ban else "Monitor conditions"
            }
    except Exception as e:
        logger.error(f"Failed to fetch NSW RFS feed: {e}")
        raise HTTPException(
            status_code=503,
            detail="Fire danger rating service temporarily unavailable. Degradation rule active."
        )
```

---

### Task 1.4: Replace Synthetic Sentiment Score with Attributed Observations
**Goal:** Replace `sentiment_score: 85` in [campsites.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/campsites.py) with verifiable, timestamped community observations and remove stale 24-hour caching.

**Files:**
- Modify: [backend/app/api/v1/endpoints/campsites.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/campsites.py)
- Modify: [backend/app/schemas/campsite.py](file:///home/aksai/projects/camping/backend/app/schemas/campsite.py)
- Modify: [frontend/src/components/TripCard.tsx](file:///home/aksai/projects/camping/frontend/src/components/TripCard.tsx)
- Test: [backend/tests/api/test_campsites.py](file:///home/aksai/projects/camping/backend/tests/api/test_campsites.py)

**Step 1: Define `CampsiteInsightsResponse` schema:**
```python
class CamperObservation(BaseModel):
    category: str # "Road Access", "Wildlife", "Campsite Shade", "Amenities"
    observation: str
    source_attribution: str # e.g. "Community Report (Mar 2026)"

class CampsiteInsightsResponse(BaseModel):
    nearest_fuel: str
    nearest_grocery: str
    observations: List[CamperObservation]
    top_activities: List[str]
    retrieved_at: str
```

**Step 2: Update local LLM extraction prompt & response:**
Extract concrete facts from DuckDuckGo search snippets with citations rather than an arbitrary 0-100 score. Update `TripCard.tsx` to render "Community Field Notes" instead of "Score: 85/100".

---

## Phase 2 (P0): Authentication & Alert Delivery Reach

### Task 2.1: Pluggable Transactional Email Service
**Goal:** Create `EmailService` supporting transactional email delivery for magic links and Plan B condition-shift alerts, with dev/testing console logger and SMTP/API integration.

**Files:**
- Create: `backend/app/services/email_service.py`
- Modify: [backend/app/core/config.py](file:///home/aksai/projects/camping/backend/app/core/config.py)
- Create: `backend/tests/test_email_service.py`

**Step 1: Write test for `EmailService`:**
```python
def test_email_service_send_magic_link():
    service = EmailService()
    success = service.send_magic_link("camper@example.com", "http://localhost:3021/?token=abc123xyz")
    assert success is True
    assert len(service.outbox) >= 1
    assert "abc123xyz" in service.outbox[-1]["body"]
```

**Step 2: Implement `EmailService`:**
```python
# backend/app/services/email_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.outbox = [] # Test inspection buffer

    def send_magic_link(self, recipient_email: str, magic_url: str) -> bool:
        subject = "Your Camp Smart Australia Access Link"
        html = f"""
        <div style="font-family: sans-serif; background: #071714; color: #fff; padding: 24px; border-radius: 12px;">
          <h2 style="color: #00ff88;">Camp Smart Australia</h2>
          <p>Click below to securely access your saved trips and Plan B monitoring dashboard:</p>
          <p><a href="{magic_url}" style="background: #00ff88; color: #071714; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Open My Trips Dashboard</a></p>
          <p style="color: #888; font-size: 12px;">Link valid for your active session.</p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def send_plan_b_alert(self, recipient_email: str, trip_name: str, reason: str, switch_url: str, alternatives: list) -> bool:
        subject = f"⚠️ Plan B Alert: Condition shift for {trip_name}"
        alts_html = "".join([f"<li><strong>{a['name']}</strong> ({a['state']}) — {a['reason']}</li>" for a in alternatives])
        html = f"""
        <div style="font-family: sans-serif; background: #071714; color: #fff; padding: 24px; border-radius: 12px;">
          <h2 style="color: #ff4d4d;">Plan B Alert: Conditions Shifted</h2>
          <p>We detected an important shift for your trip to <strong>{trip_name}</strong>:</p>
          <div style="background: rgba(255, 77, 77, 0.1); border-left: 4px solid #ff4d4d; padding: 12px; margin: 12px 0;">
            {reason}
          </div>
          <h3>Recommended Safe Alternatives:</h3>
          <ul>{alts_html}</ul>
          <p><a href="{switch_url}" style="background: #00ff88; color: #071714; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Review & Switch Trip (1-Click)</a></p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        self.outbox.append({"to": to_email, "subject": subject, "body": html_body})
        logger.info(f"📧 [Email Dispatched] To: {to_email} | Subject: {subject}")
        if settings.SMTP_HOST:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = settings.SMTP_FROM or "alerts@campsmart.au"
                msg["To"] = to_email
                msg.attach(MIMEText(html_body, "html"))
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(msg["From"], [to_email], msg.as_string())
                return True
            except Exception as e:
                logger.error(f"SMTP send failed: {e}")
                return False
        return True
```

---

### Task 2.2: Magic Link Request Endpoint & Dashboard Auto-Auth
**Goal:** Provide `POST /api/v1/auth/request-magic-link` and auto-authenticate users visiting `/?token=...&email=...`.

**Files:**
- Create: `backend/app/api/v1/endpoints/auth.py`
- Modify: [backend/app/api/v1/api.py](file:///home/aksai/projects/camping/backend/app/api/v1/api.py)
- Modify: [frontend/src/app/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/page.tsx)
- Test: `backend/tests/api/test_auth.py`

**Step 1: Write test for magic link endpoint:**
```python
def test_request_magic_link_flow():
    res = client.post("/api/v1/auth/request-magic-link", json={"email": "camper@test.com"})
    assert res.status_code == 200
    data = res.json()
    assert "magic_token" in data
    assert "message" in data
```

**Step 2: Add endpoint in `backend/app/api/v1/endpoints/auth.py`:**
```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import hmac, hashlib, os
from app.services.email_service import EmailService

router = APIRouter()
email_service = EmailService()

class MagicLinkRequest(BaseModel):
    email: EmailStr

@router.post("/request-magic-link")
def request_magic_link(req: MagicLinkRequest):
    secret = os.environ.get("SECRET_KEY", "dev-secret-key").encode()
    token = hmac.new(secret, req.email.encode(), hashlib.sha256).hexdigest()
    magic_url = f"https://camping.akstest.win/?email={req.email}&token={token}"
    email_service.send_magic_link(req.email, magic_url)
    return {
        "message": "Magic link sent to your email",
        "magic_token": token,
        "magic_url": magic_url
    }
```

**Step 3: Update `frontend/src/app/page.tsx`:**
Add a 1-click "Email Me a Magic Link" button in the My Trips drawer.
When URL query parameters contains `?email=...&token=...`, automatically open My Trips dashboard, set `dashEmail` and `dashToken`, and trigger `fetchMyTrips()`.

---

### Task 2.3: Real Plan B Alert Delivery & Worker Persistence
**Goal:** Deliver actual emails on condition shift alerts, set `delivery_status="SENT"` or `"FAILED"` with `retry_count`, and maintain `trip.plan_b_alert_active = True`.

**Files:**
- Modify: [backend/app/worker/plan_b.py](file:///home/aksai/projects/camping/backend/app/worker/plan_b.py)
- Test: [backend/tests/api/test_plan_b.py](file:///home/aksai/projects/camping/backend/tests/api/test_plan_b.py)

**Step 1: Update `backend/tests/api/test_plan_b.py`:**
```python
def test_plan_b_alert_delivery_and_persistence():
    # Assert alert creates delivery record with status SENT (or PENDING)
    # Assert trip.plan_b_alert_active remains TRUE after alert creation!
    assert trip["plan_b_alert_active"] is True
```

**Step 2: Update `backend/app/worker/plan_b.py`:**
```python
sent = email_service.send_plan_b_alert(
    recipient_email=trip.user_email,
    trip_name=campsite.name,
    reason=details,
    switch_url=f"https://camping.akstest.win/?email={trip.user_email}&token={token}&trip={trip.id}",
    alternatives=alts
)
alert = PlanBAlert(
    saved_trip_id=trip.id,
    user_email=trip.user_email,
    campsite_id=campsite.id,
    alert_type="WEATHER_WARNING",
    details=details,
    delivery_status="SENT" if sent else "FAILED",
    retry_count=0 if sent else 1,
    suggested_alternatives=alts
)
db.add(alert)
# CRITICAL FIX: DO NOT disable trip monitoring!
trip.plan_b_alert_active = True
db.commit()
```

---

## Phase 3 (P1): Pilot Catchment Reseed (Sydney ≤3.5h)

### Task 3.1: Canonical 32-Campsite Sydney Pilot Dataset
**Goal:** Replace national spread with 32 deeply verified campsites within 3.5h of Sydney across NPWS, Forestry Corporation NSW (free/dog-friendly), WaterNSW, and Councils.

> **🟡 SUPERSEDED — do not extend this table.** Coverage targets were met (32 NSW sites, 13 dog-friendly, 7 fire districts), but the values below are **not verified** despite the heading, and two defects are provable from this table alone:
> - **R8 — fees contradict facilities.** `Flush / Hot / Potable` is priced **$24.60** at Gambells Rest but **$34.00** at Bonnie Vale and **$28.00** at Green Patch; `Pit / None` at Mill Creek is priced the **same $24.60** as `Flush / Hot` at Gambells Rest, Capertee Valley and Cattai. Under NPWS's facility-tiered schedule these cannot all be correct. Eight sites share one figure.
> - **R7 — coordinates contradict the authoritative GPS.** Verified against Forestry Corporation's own published campground coordinates: Daly's Clearing is **~1.18 km** off and Wingello **~2.00 km** off; The Pines/Turpentine sit ~14 km east of the GPS published for Olney SF.
> - **R13 — "Blackheath Glen"** (Megalong Valley; flush toilets, potable water, free) is uncorroborated by any land-manager source; Mystery Bay is ~4h30 from Sydney, outside this plan's own 3.5h catchment.
>
> **Phase 6 replaces this seed** with CC-BY SEED ingest + rule-based inference + evidence-backed harvest. Until Phase 6A lands, mark every current record `data_status='unverified'` so nothing hand-written is presented as canonical.

**Files:**
- Modify: [backend/seed.py](file:///home/aksai/projects/camping/backend/seed.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Verified Dataset Specification:**

| Name | Region / Council | Drive from Sydney | Dog Friendly | Vehicle Clearance | Facilities (Toilets/Showers/Water/Fire) | Fees | Booking URL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **The Pines** | Olney State Forest (Central Coast) | 1h 45m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Turpentine** | Olney State Forest (Central Coast) | 1h 50m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Euroka Campground** | Blue Mountains (Glenbrook) | 1h 15m | NO | 2WD | Flush / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Murphy's Glen** | Blue Mountains (Woodford) | 1h 30m | NO | **4WD_ONLY** | Pit / None / None / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Old Ford Reserve** | Megalong Valley | 2h 00m | **YES** | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | bluemountains.nsw.gov.au |
| **Blackheath Glen** | Megalong Valley | 2h 10m | **YES** | 2WD | Flush / None / Potable / Fire Rings | $0 (Free) | bluemountains.nsw.gov.au |
| **Bonnie Vale** | Royal National Park (Bundeena) | 1h 10m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $34.00/night | nationalparks.nsw.gov.au |
| **Upper Colo Reserve** | Hawkesbury | 1h 35m | **YES** | 2WD | Composting / Cold / Non-potable / Fire Pits | $12.50/adult | hawkesbury.nsw.gov.au |
| **Mill Creek** | Dharug NP (Wisemans Ferry) | 1h 30m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Bendeela Camping** | Kangaroo Valley (WaterNSW) | 2h 15m | NO | 2WD | Flush / None / Non-potable / No Fires | $6.00 booking | waternsw.com.au |
| **Gambells Rest** | Morton NP (Bundanoon) | 2h 00m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Daly's Clearing** | Belanglo State Forest | 1h 45m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Wingello Forest** | Wingello State Forest | 1h 55m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Frying Pan Rock** | Chichester State Forest | 3h 15m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Telegherry** | Chichester State Forest | 3h 20m | **YES** | 2WD | Pit / None / Non-potable / Fire Pits | $0 (Free) | forestrycorporation.com.au |
| **Green Patch** | Booderee NP (Jervis Bay) | 2h 45m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $28.00/night | parksaustralia.gov.au |
| **Pebbly Beach** | Murramarang NP | 3h 30m | NO | 2WD | Pit / Cold / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Depot Beach** | Murramarang NP | 3h 25m | NO | 2WD | Flush / Hot / Potable / Gas BBQ | $34.00/night | nationalparks.nsw.gov.au |
| **Pretty Beach** | Murramarang NP | 3h 35m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $34.00/night | nationalparks.nsw.gov.au |
| **Newnes** | Wollemi NP (Lithgow) | 2h 45m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Dunphy's Camp** | Megalong Valley (NPWS) | 2h 15m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Boyd River** | Kanangra-Boyd NP | 3h 00m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Capertee Valley** | Capertee NP | 3h 10m | NO | 2WD | Flush / Hot / Potable / Fire Rings | $24.60/night | nationalparks.nsw.gov.au |
| **Coorongooba** | Wollemi NP (Glen Davis) | 2h 50m | NO | 2WD | Pit / None / Non-potable / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Mystery Bay** | Eurobodalla Shire | 4h 30m (alt) | **YES** | 2WD | Pit / Cold / Non-potable / Fire Pits | $15.00/adult | mysterybay.com.au |
| **Colo Meroo** | Wollemi NP | 2h 00m | NO | Walk-in | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Wheeny Creek** | Wollemi NP | 1h 20m | NO | 2WD | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Gentlemans Halt** | Marramarra NP | 1h 30m | NO | Walk/Boat | Pit / None / River / Fire Rings | $0 (Free) | nationalparks.nsw.gov.au |
| **Lake Lyell** | Lithgow Council | 2h 15m | **YES** | 2WD | Flush / Hot / Potable / BBQ | $25.00/night | lakelyell.com.au |
| **Glenworth Valley** | Central Coast (Private) | 1h 10m | **YES** | 2WD | Flush / Hot / Potable / Fire Pits | $33.00/adult | glenworth.com.au |
| **Cattai National Park**| Cattai (Hawkesbury) | 1h 00m | NO | 2WD | Flush / Hot / Potable / BBQ | $24.60/night | nationalparks.nsw.gov.au |
| **Swann Reserve** | Wisemans Ferry | 1h 30m | **YES** | 2WD | Flush / None / Potable / Gas BBQ | $0 (Free) | hills.nsw.gov.au |

**Verification of All 4 Demo Presets:**
1. *"Sydney + Dog <3.5h"*: Returns The Pines, Turpentine, Upper Colo, Old Ford Reserve, Daly's Clearing, Glenworth Valley (6+ verified matches).
2. *"Family <2h"*: Returns Bonnie Vale, Cattai, Euroka, Upper Colo, The Pines (5+ verified matches).
3. *"90-min overnight"*: Returns Bonnie Vale (70m), Euroka (75m), Cattai (60m), Wheeny Creek (80m) (4+ verified matches).
4. *"4WD <4h"*: Returns Murphy's Glen, Newnes, Kanangra Boyd (3+ verified matches).

---

### Task 3.2: Truthful Availability Windows, Booking Modality & Date Deep-Links
**Goal:** Answer the camper's primary dilemma (*"Do I need to book in advance or can I just pack the car and go?"*) with truthful booking modalities and realistic availability windows, without violating the `AGENTS.md` legal constraint against fragile/prohibited NPWS headless scraping.

**Modality Architecture:**
1. **`FIRST_COME_FIRST_SERVED` (Forestry Corporation NSW & Free Council Reserves):**
   - E.g.: *The Pines*, *Turpentine*, *Daly's Clearing*, *Telegherry*, *Old Ford Reserve*.
   - Badge: `🟢 No Booking Required (First-Come, First-Served)`
   - Window Advice: *"No booking required. Arrive before 4:00 PM on Friday to secure a prime creek/forest spot."*
2. **`ONLINE_BOOKING_REQUIRED` (Popular NPWS Campgrounds):**
   - E.g.: *Bonnie Vale*, *Euroka*, *Green Patch*, *Pebbly Beach*, *Depot Beach*.
   - Badge: `🟡 Online Booking Required`
   - Window Advice: *"Bookings open 180 days in advance via NPWS. Typically booked out 2–3 weeks ahead for summer/autumn weekends."*
3. **`FREE_REGISTRATION_REQUIRED` (Low-pressure NPWS Bush Camps):**
   - E.g.: *Murphy's Glen*, *Newnes*, *Coorongooba*, *Wheeny Creek*.
   - Badge: `🟢 Free Permit / Registration ($0)`
   - Window Advice: *"Online registration required ($0 entry). Generally available outside peak long weekends."*
4. **`OPERATOR_PORTAL` (Councils, WaterNSW, Private):**
   - E.g.: *Bendeela*, *Upper Colo Reserve*, *Lake Lyell*, *Glenworth Valley*.
   - Badge: `🔵 Operator Booking Required`
   - Window Advice: *"Bookings open on operator portal. Weekend sites fill 1–2 weeks ahead in peak seasons."*

**Date Deep-Linking:**
When trip start and end dates are specified in the search query, generate prefilled booking deep-links where supported by the operator portal, directing users directly to the specific campground date picker.

---

## Phase 4 (P1): Facilities Constraints & Server-Side OSRM

### Task 4.1: Natural Language Facilities Extraction & Strict Filtering
**Goal:** Parse toilet, shower, drinking water, and campfire requirements from natural language queries; filter strictly when data exists; report unverified constraints to user.

**Files:**
- Modify: [backend/app/services/llm_inference.py](file:///home/aksai/projects/camping/backend/app/services/llm_inference.py)
- Modify: [backend/app/schemas/trip_recommendation.py](file:///home/aksai/projects/camping/backend/app/schemas/trip_recommendation.py)
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

**Step 1: Write failing test in `test_recommendations.py`:**
```python
def test_facilities_toilets_essential_filter():
    res = client.post("/api/v1/trips/find-weekend", json={
        "prompt": "Family camping trip, toilets essential, under 2 hours",
        "origin_lat": -33.8688,
        "origin_lng": 151.2093
    })
    assert res.status_code == 200
    cards = res.json()["cards"]
    assert len(cards) >= 1
    for c in cards:
        site = get_campsite_by_id(c["id"])
        assert site.facilities.get("toilets") in ["flush", "pit", "composting"]
```

**Step 2: Update `llm_inference.py` JSON Schema & Deterministic Parser:**
Add regex & LLM extraction for:
- `requires_toilets`: True if prompt contains "toilet", "dunny", "amenities", "restroom".
- `requires_showers`: True if prompt contains "shower", "hot shower".
- `requires_drinking_water`: True if prompt contains "drinking water", "potable water".
- `requires_campfires`: True if prompt contains "fire", "campfire", "fire pit".

**Step 3: Update `recommendation_engine.py`:**
Apply strict filtering in Phase 1 (Eligibility). If no campsites match, return clear `limiting_constraint`:
*"No dog-friendly sites found within 90 minutes with flush toilets. Try allowing pit toilets or extending drive time to 2 hours."*

---

### Task 4.2: Server-Side OSRM Routing & Geolocation Forwarding
**Goal:** Compute real road driving times and distances using OSRM with haversine $\times 1.25$ fallback; forward browser geolocation from `FindWeekendPlanner.tsx`.

**Files:**
- Modify: [backend/app/services/recommendation_engine.py](file:///home/aksai/projects/camping/backend/app/services/recommendation_engine.py)
- Modify: [frontend/src/components/FindWeekendPlanner.tsx](file:///home/aksai/projects/camping/frontend/src/components/FindWeekendPlanner.tsx)
- Modify: [frontend/src/app/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/page.tsx)

**Step 1: Implement OSRM table call in `recommendation_engine.py`:**
Query `http://router.project-osrm.org/table/v1/driving/...` (or local OSRM instance) with origins and campsite coordinates. Fall back cleanly to Haversine $\times 1.25$ if OSRM is unreachable.

**Step 2: Pass `startLocation` to `FindWeekendPlanner`:**
In `frontend/src/app/page.tsx`, pass `startLocation` prop to `<FindWeekendPlanner startLocation={startLocation} />` so browser geolocation coordinates are used for the search origin.

---

## Phase 5 (P2): Parity & Conversational Adjustments

### Task 5.1: Conversational What-If (`/trips/adjust`) via Local LLM
**Goal:** Route freeform trip adjustment queries ("leave Saturday morning", "allow 45 more mins", "find one with river swimming") through centralized Qwen3-9B on `:8002` with deterministic fallback.

**Files:**
- Modify: [backend/app/api/v1/endpoints/trips.py](file:///home/aksai/projects/camping/backend/app/api/v1/endpoints/trips.py)
- Modify: [backend/app/services/llm_inference.py](file:///home/aksai/projects/camping/backend/app/services/llm_inference.py)
- Test: [backend/tests/api/test_recommendations.py](file:///home/aksai/projects/camping/backend/tests/api/test_recommendations.py)

---

### Task 5.2: Programmatic SEO Campground Pages (32 Verified Sites)
**Goal:** Generate 32 distinct SEO pages (`/explore/[slug]`) targeting canonical campgrounds with live NSW RFS fire status rendering and the non-negotiable degradation banner.

**Files:**
- Modify: [frontend/src/app/explore/[slug]/page.tsx](file:///home/aksai/projects/camping/frontend/src/app/explore/[slug]/page.tsx)
- Create: `frontend/src/app/sitemap.ts`

---

### Task 5.3: PWA & Offline Service Worker Caching
**Goal:** Deliver true offline parity by registering a Service Worker (`next-pwa` or vanilla `sw.js`) that caches saved trips, the offline packing list, and emergency NSW contact information when campers lose cellular reception.

**Files:**
- Create: `frontend/public/sw.js`
- Create: `frontend/public/manifest.json`
- Modify: [frontend/src/app/layout.tsx](file:///home/aksai/projects/camping/frontend/src/app/layout.tsx)

---

## Phase 6 (P1): Sourced Data Acquisition (32 → ~1,000 records)
*Goal: replace the hand-written seed with records that carry real provenance, using the CC-BY open-data path first and harvesting only where open data cannot answer. See "🔐 Data Sourcing" and "⚡ Performant & Efficient Ingestion Pipeline" above for licences, URLs and mechanics.*

### Task 6A: SEED CC-BY bulk ingest ✅ COMPLETE
> **Implemented & Verified (2026-10-11):** Ingestion script `backend/app/ingest/seed_npws.py`, migration `b7d2e5f81c04` (provenance & verbatim attributes), and unit test suite `backend/tests/ingest/test_seed_npws.py` (5 tests passing). 715 NPWS camping areas ingested into database under CC-BY 4.0; internal maintenance subareas excluded; dog rules derived from statewide NPWS policy (`dog_friendly=False`); facilities and fees kept strictly `None` (honest nulls); unsourced hand-seeded records quarantined to `unverified`.
**Files:** new `backend/app/ingest/seed_npws.py`, `backend/app/models/campsite.py`, new Alembic migration `b7d2e5f81c04`, new `backend/tests/ingest/test_seed_npws.py`

1. Download both CC-BY ZIPs (URLs in the pipeline section), record each artefact's SHA-256 as provenance. **Use the ZIPs, not the `AMS_Assets` REST query — that query suppresses geometry.**
2. Stream-read with `pyogrio` into staging `stg_npws_visitor_area`, preserving all native columns and SRID 4283.
3. Reproject set-based: `ST_Transform(ST_SetSRID(geom, 4283), 4326)`.
4. Filter `SubtypeCD=5001`; upsert on natural key `source_id = SAPFLID` via `ON CONFLICT … DO UPDATE`, never downgrading `data_status`.
5. Map `AssetType` → access mode and `AssetStyle` (Bush C1 / Basic C2 / Medium C3) → `fee_tier` proxy; prefer `d_`-prefixed description fields where present.
6. **Carve out JBT and ACT explicitly** before assigning `state` (fixes R11).

**Acceptance:** 729 camping areas ingested statewide, 273 inside the Sydney catchment envelope; every record has `source_id`, `source_url`, `data_status='rule_derived'|'verified'` and never `unverified`; reprojection round-trips within 1 m; JBT records are not labelled NSW; re-running the ingester is a no-op.

### Task 6B: Rule-based inference via `policy_rule` ✅ COMPLETE
> **Implemented & Verified (2026-10-11):** Model `PolicyRule` in [policy_rule.py](file:///home/aksai/projects/camping/backend/app/models/policy_rule.py), migration `1410cba8a333`, engine [apply_rules.py](file:///home/aksai/projects/camping/backend/app/ingest/apply_rules.py), unit tests in [test_apply_rules.py](file:///home/aksai/projects/camping/backend/tests/ingest/test_apply_rules.py). Four statewide rules versioned in DB: NPWS dog ban, NPWS booking requirement, Forestry Corp dog-friendly policy, and Forestry Corp free camping ($0). Evaluated across 769 campsites in DB.
**Files:** new `backend/app/models/policy_rule.py`, `backend/app/ingest/apply_rules.py`, `backend/tests/ingest/test_apply_rules.py`

Encode the four policy facts as **versioned data rows**, not code constants:

```
policy_rule(id, land_manager, field, value, evidence_url, effective_from, effective_to)
```

1. Dogs prohibited in NSW national parks → `dog_friendly=False` (all NPWS, minus documented exceptions).
2. Dogs welcome in NSW state forests under effective control → `dog_friendly=True`.
3. State-forest camping free, no booking required → `fees="$0 (Free)"`, `booking_status="No booking required"`.
4. NPWS online booking required for **all** campgrounds → `booking_status="Booking required"` even at $0 (**fixes R9**).

Every derived value stores the rule's `evidence_url` and gets `data_status='rule_derived'`.

**Acceptance:** ~1,000 records resolve dogs + booking + free/paid from four citations; a policy change is one row update plus re-derivation, with no code change.

### Task 6C: Evidence-backed harvest of top catchment sites with Smartproxy ✅ COMPLETE
> **Implemented & Verified (2026-10-11):** Models `HarvestCache` & `FactEvidence` in [harvest_cache.py](file:///home/aksai/projects/camping/backend/app/models/harvest_cache.py) and [fact_evidence.py](file:///home/aksai/projects/camping/backend/app/models/fact_evidence.py), migration `1410cba8a333`, harvester [harvest.py](file:///home/aksai/projects/camping/backend/app/ingest/harvest.py), unit tests in [test_harvest.py](file:///home/aksai/projects/camping/backend/tests/ingest/test_harvest.py). Smartproxy integration configured via `PROXY_URL` (proxy.smartproxy.net:3120 AU residential pool) with direct connection fallback. Verified against live Bonnie Vale campground: written 8 `FactEvidence` provenance rows and updated verified amenities (toilets, hot showers, drinking water, BBQs, shelters).
**Files:** new `backend/app/ingest/harvest.py`, `backend/app/models/harvest_cache.py`, `backend/app/models/fact_evidence.py`, `backend/tests/ingest/test_harvest.py`

Implement the fetch/parse separation from the pipeline section: `harvest_cache(url PK, status, etag, last_modified, content_hash, body, retrieved_at, parser_version)`; conditional requests (`If-None-Match`/`If-Modified-Since`); content-hash gating so parser fixes replay with **zero** network traffic; Smartproxy residential IP rotation; `urllib.robotparser` checked before every fetch; bounded concurrency (2–4) at 1–2 req/s with backoff + jitter; resumable queue; descriptive `User-Agent`.

1. Extend the `facilities` JSON with **`bbq`, `shelter`, `disabled_access`** (fixes R10 — NPWS tiers 3–4 are defined by these).
2. Replace flat fee strings with `fee_tier` (1–6, nullable), `fee_low`, `fee_peak`, `fee_basis`, `fee_as_of`, `fee_source_url`; render a **range with "verify at booking"** (**fixes R8**).
3. Deterministic CSS/XPath parser first with a `parser_version`; escalate to Qwen3-9B structured extraction only on nulls, caching LLM output by `content_hash`.
4. Write results as `fact_evidence` rows, never blind overwrites.
5. Verify the three provable coordinate errors against published GPS (**fixes R7**) and drop or re-source uncorroborated records (**fixes R13**).

**Acceptance:** first pass over catchment pages completes at polite rates; weekly re-check is mostly `304`s; no fee string is stored without `fee_source_url` + `fee_as_of`; the CI integrity gates pass.

### Task 6D: OSM gap-discovery layer (ODbL-isolated)
**Files:** new `backend/app/models/osm_discovery.py`, `backend/app/ingest/osm_gap.py`

1. **Measure first:** Overpass `out count` was unreachable from the planning environment (406 on `overpass-api.de`, 500 on `kumi.systems`, all-zero on the working mirror). Count `tourism=camp_site` for NSW and Australia before scoping.
2. Load into a **separate** `osm_discovery` table with **no foreign key** into `canonical_campsites`, per PLAN.md's ODbL share-alike isolation requirement.
3. Use it only to surface gaps ("a campground exists here that SEED/Forestry do not list") for human review — never as authority for dogs, fees or facilities.

### Task 6E: Integrity gates in CI
**Files:** new `backend/tests/ingest/test_data_integrity.py`

```sql
-- Catches R8: identical fees across differing facility classes
SELECT fees, COUNT(DISTINCT facilities::text) AS variants, COUNT(*)
  FROM canonical_campsites
 WHERE fees IS NOT NULL
 GROUP BY fees HAVING COUNT(DISTINCT facilities::text) > 1;

-- Catches R7/R13: verified records must carry evidence
SELECT id, name FROM canonical_campsites
 WHERE data_status = 'verified'
   AND (evidence_url IS NULL OR verified_at IS NULL);
```

Plus: a coordinate sanity check against authoritative published GPS for every state-forest site; a GiST index on `location`; and migration of `recommendation_engine.py:38` from `db.query(Campsite).all()` + Python filtering to `ST_DWithin` before the record count exceeds ~10k.

**Acceptance:** both queries return zero rows in CI; the suite fails if a templated fee or an unevidenced "verified" record is ever reintroduced.

### Task 6F: Precomputed drive-time matrix (pairs with Task 4.2)
**Files:** new `backend/app/models/drive_time_cache.py`, `backend/app/services/routing.py`

1. Define 6–10 origin centroids (Sydney CBD, Parramatta, Penrith, Gosford, Newcastle, Wollongong, Camden, Liverpool…).
2. Prefetch one OSRM `/table/v1/driving/` matrix per centroid → all catchment destinations (chunk to respect the ~100-coordinate cap on the public demo server; self-host OSRM before launch to remove it).
3. Persist `drive_time_cache(origin_key, campsite_id, km, minutes, computed_at)`; snap a user origin to the nearest centroid and look up. Revalidate weekly; fall back to haversine ×1.25 when stale or missing.

**Acceptance:** card drive-times match the map view at zero per-request routing cost.

### Storage budget (measured)
Canonical rows are **~1 KB all-in** (≈0.6–0.7 KB heap + ≈0.3 KB indexes): 1,000 records ≈ **1 MB**, 10,000 ≈ 10 MB, 100,000 ≈ 100 MB. Real space goes to artefacts — Geofabrik NSW extract **256 MB** (Australia 922 MB), SEED ZIPs ~10–50 MB, filtered `camp_site` GeoJSON ~3–8 MB, harvest cache ~15 MB (catchment) to ~1 GB (national, retention-capped), evidence rows ~125 MB/yr at weekly snapshots, NSW offline **vector** tiles z0–z13 ~150–400 MB (raster 5–10× larger). A full `osm2pgsql` Australia import would be hundreds of GB and is **not needed**.
→ **Recommended: 20 GB pilot, 40 GB** with national tiles or photos. `config.py:7` shares a Postgres instance (`localhost:15432`, `realestate_user`) with an unrelated project — isolate quotas and backups per database.

---

## 🛡️ Non-Negotiable Guardrails & Verification Checklist

1. **Fire Rating Honesty:** Never synthesize a fire rating for non-NSW states. If the feed is unreachable, render the 503 degradation banner.
2. **Strict Provenance:** Never show fabricated compromises or templated fees. If data is unknown, render "Not verified yet".
3. **Continuous Plan B Monitoring:** Never set `plan_b_alert_active = False` automatically after creating an alert.
4. **Backward Compatibility:** All existing endpoints (`GET /campsites`, `GET /saved-trips/dashboard/{email}`, `/pack/[id]`, `/trip/[token]`) must remain fully functional.
5. **Quality Gates:** 
   - `pytest tests/` $\to$ 100% passing.
   - `npx tsc --noEmit` $\to$ 0 errors.
   - `npm run lint` $\to$ 0 errors.
