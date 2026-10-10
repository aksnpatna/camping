# Camp Smart Australia — The Intelligent Camper's Companion

**Core Promise:** "Find a camping trip that fits your weekend, and keep a practical backup ready if conditions change. See current conditions, campsite rules, and where every answer came from." Our defensible advantage develops through accurate campsite records, reliable monitoring, useful explanations, and feedback showing which recommendations worked.

## 1. Vision & The Competitive Opportunity
Most camping apps dump you on a map with 50,000 dots. We flip that model. While WikiCamps Australia is beloved and dominates the crowdsourced/offline map space, our clear differentiation is the "answer-first" model, conditions-awareness, and strict data provenance. We must explicitly answer "why not just WikiCamps?" in our pitch and SEO strategy.

### The Day 1 Hook: "Answer-First" Trip Finder
The user lands on the homepage and enters: `Home Location + Dates + Rig + Party Size`.
The app instantly returns **Ranked Trip Cards** that match their exact gear and real weather.

### The Flagship Opportunity: The "Plan B" Engine (Weather & Closures First)
"Your trip just got rained out, here are 3 alternatives within 90 minutes that are still dry." We actively monitor saved trips. If a forecast sours 2 days before departure or a closure occurs, we automatically ping the user via **Email or SMS (or web push)**. (Note: SMS costs 5-8¢/message via Twilio, so defaults will be Email/Web-Push with SMS as an opt-in). Because real-time availability is extremely difficult to verify reliably (no public APIs for NPWS/Parks Victoria), the primary value proposition of Plan B will center on weather and closures, treating availability as a bonus.

### Acquisition Strategy: Programmatic SEO
Programmatic SEO is our acquisition method, rather than a durable moat. We will start with 30-50 strong, permanent pages containing distinct, supported answers and a path into trip planning (e.g. targeting specific campgrounds for fire rules). We will avoid generating thousands of near-identical pages. **Crucially, SEO pages involving safety (like fire rules) must render live state. Degradation rule: If the RFS feed is down at render time, the page must fail to a prominent "status unavailable — check official sources" banner. It must never cache and present a stale value.**

---

## 2. Data Quality & Safety Framework (Non-Negotiable)

**The Trust System & UI:**
For each important fact, we store: the source/ID, retrieval time, published time, applicable location/dates, extracted evidence/parser version, and state (confirmed, conditional, unknown, conflicting).
*   **Users see:** "Restrictions checked 20 minutes ago; published information covers today and tomorrow." A details panel exposes the supporting record.
*   **Warnings:** Fresh, confirmed closures or prohibitions get prominent red warnings. Yellow flags indicate uncertainty or missing info.
*   **Availability:** Booking availability integration is required for Plan B. If unverified, UI must clearly show "Availability not checked."

**Safety as a Liability (Fire Bans & Roads):**
*   **Fire Bans & Warnings:** Use structured feeds (NSW RFS, BOM warning feeds, NSW National Parks alerts). Distinguish Fire Danger Periods, Total Fire Bans, and local rules. Missing info = unknown result. An old prohibition remains visible until refreshed. **Must include standard "verify with official sources" disclaimers and review Australian Consumer Law exposure.**
*   **Licensing Note:** BOM and RFS feeds must have their commercial display licensing and attribution requirements confirmed in Week 1 before any ingestion code is written.
*   **Roads & Floods:** Integrate State Traffic APIs (Live Traffic NSW, QLDTraffic). Ensure explicit mapping between traffic events and road segments.

**Data Sourcing Notes:**
*   **Campsites (MVP $0 Tier):** Use **OpenStreetMap (Overpass API)**, state parks open data (DataVic, NSW NPWS on SEED), and local government datasets. (Note: Recreation.gov is US-only and not applicable). We must keep OSM-derived data in a separable layer to ensure our proprietary canonical records are not forced into open-source by OSM's ODbL share-alike clause.
*   **Weather:** Open-Meteo with commercial licensing for the monetized platform. Need fallback for BOM ACCESS (currently suspended on open-data).
*   **Rules:** Require explicit supporting evidence before including a campsite in a strict dog-friendly result.

---

## 3. Core Features & Scoring Approach

1.  **Smart Gear Gap-Analysis (Monetized):** Collect sleeping bag comfort ratings, mat insulation, shelter type, and "I sleep cold" preference. Unknown specs prompt questions. Affiliate links (integrated via premium networks for **Wild Earth, Macpac, and Sea to Summit**) are offered only after establishing genuine need.
2.  **"Comfort Annoyances" Micro-Forecasts:** Postponed for initial pilot. Condensation/mosquitoes require stated inputs and validation against camper observations.
3.  **Rig-Aware & Dog Filters:** Require valid mapped restriction coverage (Valhalla) and official land-manager guidance for dogs.
4.  **Crowd Prediction:** Postponed. Needs occupancy/observation data beyond just school calendars.
5.  **Printable/Saved Trip Pack:** Offline payload with generation time and items requiring a fresh check. Use offline-permitted tile licenses.
6.  **Stargazing Score:** Postponed for initial pilot. Requires astronomical darkness, moon altitude/rise/set, and viewing-hour cloud forecasts.

### The Scoring Algorithm (Two-Phase)
*   **Phase 1 - Eligibility:** Check required rules, access, known closures, and mandatory facilities. Incompatible rules or closed access strictly disqualify the trip.
*   **Phase 2 - Comfort Ranking:** Score actual activities (arrival/setup, evening cooking, sleeping, packing up). Start with broad forecast-confidence descriptions, adding numeric uncertainty bands based on ensemble ranges later. Keep weather calculations, fire permissions, and thresholds in application code.

---

## 4. Tech Stack & AI Inference (Polished v1.3)
*   **Frontend:** Next.js (current stable or canary).
*   **Mapping:** MapLibre GL + vector tiles. We will self-host Nominatim (for a single-state extract) or use a paid geocoder, as Nominatim's public instance prohibits commercial/systematic querying. Nominatim geocoding results are ODbL-derived and must be kept in the separable OSM layer.
*   **Backend:** FastAPI + PostgreSQL + PostGIS. Add a durable scheduler/worker process for ingestion, monitoring, PDFs, and inference.
*   **Routing:** OSRM or a paid routing API (Mapbox/Google) for pilot drive-time. Rig-aware routing (Valhalla) is deferred to v2. Rig-aware site filtering will be done via canonical records instead.
*   **PDF:** Server-side Playwright with print-layout and map-quality checks.
*   **AI Inference & Search Integration:**
    *   **Local-First LLM Architecture:** We will start with Local LLMs (e.g., Ollama) for cost control, reusing architecture from your `asx-prediction` project. If they fail our extraction/explanation eval set, we will fall back to cloud-hosted options like Groq.
    *   **Web Search:** We will use DuckDuckGo for free web searches instead of paid APIs like Tavily.
    *   **Voice-to-Text:** Deferred to v2 to avoid scope creep for the pilot.

---

## 5. Regional Pilot Plan (10-Week MVP)
For a solo/small team, the national specification carries too many unvalidated dependencies. We will launch a regional pilot (e.g., one state and city catchment).

### Weeks 1–2: Foundation & Data Truth
*   Interview 10 campers now to choose one audience and catchment (and pressure-test Email/SMS opt-ins).
*   Validate feed access, BOM/RFS commercial licensing, and API limits.
*   Establish a hard target of 25 canonical campground records (pipeline proven). Do this *before* building recommendations. Let the record count grow in Weeks 3–4.

### Weeks 3–4: Core Recommendations & UI
*   Build guest-access ranked cards with drive limits, dog/rig constraints, and weather.
*   Implement visible sources, restriction handling from the start, and honest unknown states.

### Weeks 5–6: Saved Trips & Plan B
*   Add saved trips and the first Plan B monitor.
*   Handle availability transparently (integrate booking source or label "not checked").
*   Test actual Plan B alternatives with campers to ensure they are viable.

### Weeks 7–8: The Offline Pack & AI Tests
*   Deliver the printable/saved trip pack. Test offline access, expired info, and source outages.
*   Evaluate one constrained Qwen use case (e.g., explaining recommendations).

### Weeks 9–10: Pilot Launch & Initial SEO
*   Run a small public pilot. Measure if campers choose trips, save them, and return.
*   Publish 30–50 strong, targeted SEO pages.
*   Correct observed recommendation failures.
