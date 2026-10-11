 **SEED / Data.NSW — NPWS Assets Geodatabase (`AMS_Assets` ArcGIS MapServer).** Verified live:
- Publisher: NSW Dept of Climate Change, Energy, the Environment and Water. **Licence: CC-BY 4.0** — commercial use permitted with attribution. Attribution text specified by SEED: *"© State Government of NSW and NSW Department of Climate Change, Energy, the Environment and Water 2017"*.
- Currency: Visitor Area last updated **2025-12-16**; Facility Point last updated **2026-08-13**. Both actively maintained.
- **Layer 24 "Visitor Area" → `SubtypeCD=5001` (Camping Area) = 729 records statewide.** (Live `returnCountOnly` query.)
- **273 of those fall inside the Sydney catchment envelope** (148.5–153.8 E, −36.2 to −31.3 N) — live spatial count.
- Layer 7 "Facility Point" = **10,287 assets** statewide (BBQs, picnic tables, shelters, fish-cleaning tables, seats, playground equipment associated with camping/day-use areas).
- Per-record attributes actually exposed: `OBJECTID`, **`SAPFLID`** (stable asset ID, e.g. `N0068X-V0118-CGBLU` → ideal `source_id`), `AssetName`, `AssetType` (1=Vehicle Based, 2=Remote Walk-in, 3=Short Walk-in, +3), `AssetStyle` (**1=Bush Camping Area C1, 2=Basic C2, 3=Medium C3, +1** — a facility-tier proxy that maps onto NPWS fee tiers).
- Layer metadata additionally documents `CaravansAllowed` / `CamperTrailersAllowed` / `MotorhomesAllowed` as coded `0=False, 1=True, **9999=Unknown**` — exactly the tri-state design already in `models/campsite.py`.
- Service facts: SRID **4283 (GDA94)**, `maxRecordCount=5000`, query formats JSON + geoJSON, capabilities `Map,Query,Data`.
- ⚠️ **Verified blocker: the REST query does not return geometry.** Both `f=geojson` (`"geometry": null`) and `f=json` (no `geometry` key) came back empty with `returnGeometry=true`. **Coordinates must come from the SEED/Data.NSW download (shapefile / GeoPackage / CSV) or the CKAN `datastore_search` API — not from this MapServer.** Design the ingester around the download artefact.
- Adjacent layers worth joining later: 23 Treatment Disposal System (toilet waste), 9/10/11 Hydraulic Point/Storage/Valve (water), 32/38 Road Section (access surface → 2WD/4WD), 1 Building (amenities blocks), 36 Parking Area.

**Forestry Corporation NSW — no open dataset exists.** Verified by exhaustive search of their ArcGIS Hub DCAT catalogue (`data-fcnsw.opendata.arcgis.com/api/feed/dcat-us/1.1.json`): **39 datasets, zero** referencing camp/camping/campground/recreation/visitor/picnic/facility/amenity/toilet/4WD/trail. It is purely forestry-operations data (plantations, harvest coupes, IFOA compliance, management zones, aviation obstructions, soils).
→ State-forest campgrounds must be harvested from the published HTML: the *"ultimate guide to free camping in NSW State forests"* (campground names **with GPS coordinates**, e.g. Dalys Clearing `-34.527643, 150.241341`) plus per-forest pages listing `Camping / BBQ / Picnic facilities / Toilets area / Disabled toilets` per camping area.
→ Scale: **~500 NSW state forests**, many with camping; ~15 named campgrounds reachable within 3.5h of Sydney in the guide alone.
→ **Licence risk verified:** the 39-dataset catalogue is **not** uniformly reusable — 15 × `CC-BY-NC-SA 4.0`, 1 × `CC-BY-NC`, 2 × `CC-BY-NC-ND` (**all non-commercial**), vs only 4 × `CC-BY 4.0` and 3 × `CC0`; 9 have blank licences, 1 is the literal string `"null"`, 2 embed the licence in raw HTML. Data.NSW separately lists the State Forest boundary as plain "Creative Commons Attribution". **Conflicting metadata → obtain written confirmation per dataset before any commercial reuse.** (Moot for camping, since no camping dataset is published there.)

**Rule-based facts that need NO per-site data (highest-value, lowest-cost win).** Each is one authoritative citation covering hundreds of sites:
- **Dogs in NSW national parks: prohibited** (NPWS) → `dog_friendly=False` for the 729, minus documented exceptions.
- **Dogs in NSW state forests: welcome under effective control** (Forestry Corporation, statewide) → `dog_friendly=True` for all state-forest campgrounds.
- **State-forest camping: free, no booking required** → `fees="$0 (Free)"`, `booking_status="No booking required"`.
- **NPWS: online booking required for ALL campgrounds** → `booking_status="Booking required"` even where the fee is $0.
These four rules convert ~1,000 records from `unknown` to `sourced known` and simultaneously invalidate several current seed values (see A2-9).

### B2. Coverage / discovery layer

**OpenStreetMap** — global `tourism=camp_site` = **4,101,652 objects** (3,315,922 nodes / 759,365 ways / 26,365 relations), taginfo as of **2026-10-10**. Licence **ODbL 1.0** (confirmed in the live Overpass response and on Geofabrik). Per PLAN.md, OSM-derived data must stay in a **separable layer** so the share-alike clause cannot reach the proprietary canonical records. Use it strictly for **gap discovery** ("does a campground exist here that SEED/Forestry don't list?"), never as authority for dogs, fees or facilities.
⚠️ Overpass `out count` was unreachable from this environment (406 on `overpass-api.de`, 500 on `kumi.systems`, and the working mirror `overpass.osm.ch` returned all-zero counts for both area and bbox queries). **The Australia/NSW camp_site count is therefore unmeasured — Task 1 below must measure it before any OSM work is scoped.**

**Fee reality (why fees must not be hardcoded).** NPWS is transitioning to a **six-tier, per-site-per-night** schedule: Tier 1 (vehicle/walk-in access) **Free**; T2 pit toilet **$13 / $22**; T3 + tables/BBQ **$20 / $36**; T4 + shelters **$28 / $54**; T5 + flush toilet & cold shower **$38 / $65**; T6 + hot shower **$54 / $89** (low / peak season), ~**86% of campgrounds in tiers 2–5**, ~90 peak days per year, CPI-indexed annually. Sources **conflict on whether it is live**: the official consultation paper and a 22-Sep-2026 analysis say still *proposed* ("check current pricing before you book"; the Benerembah page still shows a $6 booking fee), while an Aug-2026 booking guide says it took effect 1 July 2026. **Treat the tier schedule as a model, not a price list.**

### B3. Realistic growth trajectory

| Stage | Records | How | Attribute completeness |
|---|---|---|---|
| Today | 32 | hand-written seed | Coordinates **wrong** (A2-7); fees **inconsistent** (A2-8) |
| Stage 1 | **~1,000** | SEED bulk ingest (729 NPWS camping areas) + Forestry guide harvest (~15–40 in catchment) + rule-based dog/booking/free inference | Name, coords, `source_id`, access type, facility-tier proxy, dog policy, booking requirement — **all sourced**. Fees = tier *range*. Toilets/showers = tier proxy or `unknown` |
| Stage 2 | ~1,000 enriched | Per-campground page harvest for the **top 60–100 catchment sites** | Explicit toilets/showers/water/BBQ, exact fee, deep booking link, park-entry fee |
| Stage 3 | 273 → catchment-complete | Join Facility Point (10,287) + Hydraulic + Treatment Disposal + Road Section to the 273 catchment campgrounds | Derived facilities with per-asset provenance |
| Discovery only | +N | OSM gap-detection (count TBD) | Coordinates + existence only |

**Bottom line: 32 → ~1,000 sourced NSW records is realistic and mostly automatable, and the catchment subset is 273 NPWS camping areas alone — ~8.5× the current dataset from one CC-BY source.** The constraint is not *quantity*; it is that **exact fees and explicit facility booleans require per-page harvesting**, and everything else can be sourced in bulk today.

---

## Part C — Storage and space budget

**Canonical records (Postgres + PostGIS).** A row with the current schema (name 40, state, management_type, two JSON blobs, fees, two URLs, `source_id`, `fire_district`, timestamps, one `POINT`) is ≈ **0.6–0.7 KB heap** + ≈ **0.3 KB indexes** (btree on name/state/source_id + GiST on location) ≈ **~1 KB/row all-in**.

| Records | Table + indexes |
|---|---|
| 32 (today) | ~32 KB |
| 1,000 | **~1 MB** |
| 10,000 | ~10 MB |
| 100,000 | ~100 MB |
| 1,000,000 | ~1 GB |

**The database is a rounding error.** Even the full 729-record NPWS ingest plus every state-forest campground in Australia would not reach 10 MB. `db.query(Campsite).all()` + Python-side filtering (`recommendation_engine.py:38`) stays acceptable to ~10k rows; beyond that, push filtering into PostGIS (`ST_DWithin` / `ST_Distance`).

**Everything else that actually consumes space:**

| Item | Size | Notes |
|---|---|---|
| Geofabrik **NSW** extract (incl. ACT + JBT) | **256 MB** `.osm.pbf` | as of 2026-10-09; `.gpkg.zip` also offered |
| Geofabrik **Australia** extract | **922 MB** `.osm.pbf` | only needed for national discovery |
| Filtered `camp_site`-only GeoJSON (NSW) | ~3–8 MB | a few thousand features |
| SEED download (Visitor Area + Facility Point) | ~10–50 MB | shapefile/GeoPackage/CSV |
| Harvest cache — 1,000 campground pages | ~150 MB | ~150 KB/page |
| Harvest cache with 4-week retention, weekly re-harvest | ~600 MB–1 GB | cap retention; do **not** keep raw responses forever |
| Provenance/evidence rows (10 facts × 1,000 sites × weekly snapshots) | ~125 MB/yr | keep latest + last N snapshots only |
| Offline **vector** tiles, NSW catchment z0–z13 | ~150–400 MB | Geofabrik publishes an experimental Shortbread MVT package for MapLibre |
| Offline vector tiles, Australia z0–z13 | ~1.5–3 GB | |
| Offline **raster** tiles (same areas) | 5–10× the vector figure | avoid unless required |
| Photos (deferred) | ~1.2 GB / 1,000 sites at 5×200 KB | 10 GB at 10,000 sites |
| Full `osm2pgsql` Australia import | hundreds of GB | **not needed** — use the filtered extract |

**Recommended budget: 20 GB for the pilot** (DB < 1 GB, archives ~1.5 GB, harvest cache ~1 GB, vector tiles ~0.5 GB, logs + headroom). **40 GB** if Australia-wide tiles or photos are added. 2 GB of Postgres `shared_buffers` is ample at this scale.
⚠️ The DB currently shares an instance (`config.py:7`: `localhost:15432`, user `realestate_user`, db `camping_db`) with an unrelated project — isolate storage quotas and backups per database.

---

## Part D — Will we have *relevant* data? (honest coverage matrix)

| Camper question | Best source | Obtainable at scale? | Today |
|---|---|---|---|
| Where can I camp ≤2h from Sydney? | SEED Visitor Area (273 in catchment) | **Yes** — bulk, CC-BY | 32 records, coords partly wrong |
| Are dogs allowed? | Rule: NPWS no / State Forest yes | **Yes** — 2 citations cover ~1,000 sites | 13 hardcoded values |
| Do I need to book? | Rule: NPWS all / Forestry none | **Yes** — rule-based | Engine emits the wrong value for free NPWS sites |
| Is it free? | Tier 1 / State forest rule | **Yes** | 15 marked free, booking status wrong |
| What does it cost? | NPWS tier schedule + per-campground page | **Partial** — tier derivable from `AssetStyle`; exact fee needs harvest; policy in transition | 8 sites share one invented figure |
| Toilets / showers? | `AssetStyle` proxy + Facility Point (10,287) + page harvest | **Partial** — proxy in bulk, booleans via harvest | Invented per site; `bbq`/`shelter` not even modelled |
| 2WD or 4WD? | `AssetType` + Road Section surface | **Partial** | Mixed into `rig_access` (plan_v2 #7 still open) |
| Fire danger *at this site*? | RFS `fdrToban.xml` + `fire_district` | **Yes** — already built | Stored, **never wired up** |
| Is it closed right now? | NPWS alerts + Forestry closures pages | **Yes** for closures | None; only keyword web search |
| Is a site *available*? | No public API | **No** — industry-wide gap | Correctly out of scope; must render "Availability not checked" |
| Reviews / photos? | None authoritative | **No** | None |

**Verdict: yes — relevant data is realistically obtainable, and cheaply.** Three of the four highest-value camper questions (dogs, booking, free/paid) become *sourced* for ~1,000 sites from two rules plus one CC-BY bulk download. Coverage grows ~30× on coordinates and identity alone. The genuinely hard residue is exact fees and explicit facility booleans, which need a rate-limited page harvester — and the honest fallback for those is a **tier-derived range plus `unknown`**, not a plausible-looking number. That is precisely the trust posture the plans claim as the moat, and it is the opposite of what the current seed does.

---

## Part E — Execution plan

### Phase 0 — Stop the bleeding (correctness/security; do first)
1. **Remove the token from the magic-link response.** `MagicLinkResponse` → `{message}` only; delete `token`/`magic_link` from `schemas/auth.py`. Add nonce + expiry + `used_at` to a token table; fail closed on default `SECRET_KEY`. Update `test_auth.py` to assert the response body contains **no** token and that a guessed token is rejected.
2. **Add alert dedupe/cooldown** in `plan_b.py` (suppress same `(trip, alert_type)` within 24h unless severity escalates; one alert per news source URL per trip). Test: two consecutive worker passes with an unchanged forecast produce **exactly one** alert row and one email.
3. **Make delivery status truthful.** `_send()` returns `False`/`DISABLED` with no transport configured; persist outbox to a table; assert transport at worker startup. Test: with `SMTP_HOST` unset, status is **not** `SENT`.
4. **Wire `fire_district` end-to-end** (API → card → campsite/SEO/pack pages → `/fire-status?district=`). Test: an Illawarra/Shoalhaven site queries that district, not Greater Sydney.
5. **Fix rating coercion** to `"No Rating"` and route unparseable feeds to 503. Test both.
6. **Make Plan B alternatives intent-aware and weather-checked** by reusing `RecommendationEngine`; generate the reason string only from checked facts. Test: alternatives respect `max_drive_hours`/`origin`/`has_dog`/`rig_access` and each candidate's own forecast is evaluated.

### Phase 1 — Quarantine and re-source the existing 32 records
7. **Freeze hand-written values as `unverified`.** Add `data_status` (`verified` | `rule_derived` | `unverified`) and `verified_at`/`evidence_url` per fact; mark all 32 current records `unverified` so nothing invented is presented as canonical.
8. **Correct the three provable coordinate errors** (Daly's Clearing, Wingello, The Pines/Turpentine) against the published Forestry GPS, and move Green Patch to Jervis Bay Territory with its own fire-district rule.
9. **Replace flat fee strings with a fee model:** `fee_tier` (1–6, nullable), `fee_low`, `fee_peak`, `fee_basis`, `fee_as_of`, `fee_source_url`; render as a range with "verify at booking". Never a single invented number.
10. **Fix booking status** to honour the NPWS "booking required for all campgrounds" rule, distinct from Forestry "no booking required".

### Phase 2 — Bulk ingest the authoritative NSW layer (32 → ~1,000)
11. **Measure the OSM baseline first** (Overpass was unreachable here): count `tourism=camp_site` for NSW and Australia so the discovery layer can be scoped on facts.
12. **Build the SEED ingester.** Download the Visitor Area + Facility Point artefacts from Data.NSW/SEED (**not** the REST query — geometry is suppressed). Page through `maxRecordCount=5000`. Map `SAPFLID`→`source_id`, `AssetName`→`name`, `AssetType`→access mode, `AssetStyle`→`fee_tier` proxy + facility expectations. **Reproject GDA94 (EPSG:4283) → WGS84 (EPSG:4326)** to match `Geometry(srid=4326)`. Split JBT/ACT out of the NSW extract explicitly.
13. **Apply the four rule-based inferences** (dogs NPWS/Forestry, booking, free) with the citation stored as evidence per record.
14. **Build the Forestry harvester** for campground names + GPS + facility lines from the guide and per-forest pages: rate-limited, cached with `retrieved_at`, robots/ToS-checked, parser-versioned, and idempotent.
15. **Keep OSM in a separate table** (`osm_discovery`) with no foreign key into `canonical_campsites`, per PLAN.md's ODbL isolation requirement. Use it only to surface gaps for human review.

### Phase 3 — Enrich the catchment, then wire the product
16. **Harvest per-campground NPWS pages for the top 60–100 catchment sites** to obtain explicit toilets/showers/water/BBQ, exact fees, deep booking links and park-entry fees. Extend the `facilities` JSON with `bbq`, `shelter`, `disabled_access` (required before tier derivation is meaningful).
17. **Build facility constraints end-to-end** (plan_v3 Task 4.1, still open): add `requires_toilets/showers/drinking_water/campfires` to `FindWeekendRequest`, extract them in `llm_inference` (regex + LLM), filter strictly in eligibility, and **echo unsupported requirements back** instead of silently dropping them.
18. **Server-side OSRM routing** with the haversine ×1.25 fallback, so card drive-times match the map view; finish geolocation forwarding on the on-mount path.
19. **Surface provenance in the UI** — `last_verified_at`, `data_status`, source link, and the SEED attribution string — delivering PLAN.md's "see where every answer came from" promise, which is still invisible to users.
20. **Publish a data-provenance/attribution page** listing every source, licence, retrieval time and the CC-BY attribution text.

### Phase 4 — Parity (unchanged from plan_v3 Phase 5)
21. Conversational `/trips/adjust` via the local LLM with deterministic fallback.
22. Per-campground SEO pages for the verified catchment set, rendering **live** fire status with the degradation banner, plus `sitemap.ts`.
23. PWA service worker caching saved trips and the offline pack.

---

## Part F — Validation

- **Regression suite:** `make test-backend` must stay green (7 existing files), plus `npx tsc --noEmit` and `npm run lint` at 0 errors, per plan_v3's quality gates.
- **New tests required by this plan:**
  - Auth: magic-link response body contains **no** token; expired/used/guessed tokens rejected; default `SECRET_KEY` fails closed.
  - Plan B: two identical worker passes → one alert, one email; alternatives honour saved origin/drive limit/rig/dog; each candidate's forecast evaluated.
  - Delivery: no transport → status is not `SENT`.
  - Fire: site in Illawarra/Shoalhaven queries its own district; missing/unparseable rating → `"No Rating"`, not `"Moderate"`; non-NSW → `status:"unavailable"`.
  - Data integrity: **no two campgrounds may share an identical non-null fee string unless they share a `fee_tier` and source** (this single assertion would have caught A2-8); every record with `data_status="verified"` has `evidence_url` and `verified_at`.
  - Ingest: SEED row count matches 729 statewide / 273 in catchment; EPSG:4283→4326 reprojection round-trips within 1 m; JBT records are not labelled NSW.
  - Facilities: a prompt containing "toilets essential" either filters correctly or reports the constraint as unsupported — never silently ignored.
- **Manual pilot check:** all 4 homepage presets return ≥1 card; each card's fee shows a sourced range; each booking link resolves to the correct body; a saved trip receives exactly one email per condition change; campsite pages show the correct district's live fire rating.

---

## Part G — Open decision and out-of-scope

**One decision materially changes Phase 2–3 scope** (recommended default baked into the plan above):

> **Enrichment depth vs breadth.** *Recommended:* bulk-ingest ~1,000 sourced records now (identity, coordinates, `source_id`, access type, tier proxy, plus rule-based dogs/booking/free), then page-harvest **only the top 60–100 catchment sites** for exact facilities and fees, rendering tier-derived **ranges + `unknown`** everywhere else. *Alternative:* skip bulk ingest and hand-verify 60 sites deeply — faster to "all verified", but forfeits the ~8.5× catchment coverage and the provenance story that differentiates the product. The recommendation follows PLAN.md's pilot strategy while making the honest-unknown state visible rather than papering over it.

**Explicitly out of scope:** real-time campsite availability (no public API exists; render "Availability not checked"), crowd prediction, stargazing/comfort micro-forecasts, SMS delivery (email-first per PLAN.md), reviews/photos, national (non-NSW) coverage, and any reuse of `CC-BY-NC*` Forestry datasets in the monetized product without written confirmation.
