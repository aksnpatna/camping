# Camp Smart Australia — The Intelligent Camper's Companion

**Core Promise:** "Find a camping trip that fits your weekend, and keep a practical backup ready if conditions change. See current conditions, campsite rules, and where every answer came from." Our defensible advantage develops through accurate campsite records, reliable monitoring, useful explanations, and feedback showing which recommendations worked.

## 1. Vision & The Competitive Opportunity
Most camping apps dump you on a map with 50,000 dots. We flip that model.

### The Day 1 Hook: "Answer-First" Trip Finder
The user lands on the homepage and enters: `Home Location + Dates + Rig + Party Size`.
The app instantly returns **Ranked Trip Cards** that match their exact gear and real weather.

### The Flagship Opportunity: The "Plan B" Engine
"Your trip just got rained out, here are 3 alternatives within 90 minutes that are still dry." We actively monitor saved trips. If a forecast sours 2 days before departure, we automatically email a "Plan B" alert with practical, available alternatives. (Note: A useful Plan B must satisfy all constraints, have acceptable drive time, and either verified availability or a clearly disclosed availability gap).

### Acquisition Strategy: Programmatic SEO
Programmatic SEO is our acquisition method, rather than a durable moat. We will start with 30-50 strong, permanent pages containing distinct, supported answers and a path into trip planning (e.g. targeting specific campgrounds for fire rules). We will avoid generating thousands of near-identical pages.

---

## 2. Data Quality & Safety Framework (Non-Negotiable)

**The Trust System & UI:**
For each important fact, we store: the source/ID, retrieval time, published time, applicable location/dates, extracted evidence/parser version, and state (confirmed, conditional, unknown, conflicting).
*   **Users see:** "Restrictions checked 20 minutes ago; published information covers today and tomorrow." A details panel exposes the supporting record.
*   **Warnings:** Fresh, confirmed closures or prohibitions get prominent red warnings. Yellow flags indicate uncertainty or missing info.
*   **Availability:** Booking availability integration is required for Plan B. If unverified, UI must clearly show "Availability not checked."

**Safety as a Liability (Fire Bans & Roads):**
*   **Fire Bans & Warnings:** Use structured feeds (NSW RFS, BOM warning feeds, NSW National Parks alerts). Distinguish Fire Danger Periods, Total Fire Bans, and local rules. Missing info = unknown result. An old prohibition remains visible until refreshed.
*   **Roads & Floods:** Integrate State Traffic APIs (Live Traffic NSW, QLDTraffic). Ensure explicit mapping between traffic events and road segments.

**Data Sourcing Notes:**
*   **Campsites:** Identify specific state parks datasets (e.g., Victoria's PARKRES and Recreation Sites). Deduplicate BEFORE building recommendations. Resolve OSM ODbL share-alike obligations.
*   **Weather:** Open-Meteo with commercial licensing for the monetized platform. Need fallback for BOM ACCESS (currently suspended on open-data).
*   **Rules:** Require explicit supporting evidence before including a campsite in a strict dog-friendly result.

---

## 3. Core Features & Scoring Approach

1.  **Smart Gear Gap-Analysis (Monetized):** Collect sleeping bag comfort ratings, mat insulation, shelter type, and "I sleep cold" preference. Unknown specs prompt questions. Affiliate links are offered only after establishing genuine need.
2.  **"Comfort Annoyances" Micro-Forecasts:** Postponed for initial pilot. Condensation/mosquitoes require stated inputs and validation against camper observations.
3.  **Rig-Aware & Dog Filters:** Require valid mapped restriction coverage (Valhalla) and official land-manager guidance for dogs.
4.  **Crowd Prediction:** Postponed. Needs occupancy/observation data beyond just school calendars.
5.  **Printable/Saved Trip Pack:** Offline payload with generation time and items requiring a fresh check. Use offline-permitted tile licenses.
6.  **Stargazing Score:** Postponed for initial pilot. Requires astronomical darkness, moon altitude/rise/set, and viewing-hour cloud forecasts.

### The Scoring Algorithm (Two-Phase)
*   **Phase 1 - Eligibility:** Check required rules, access, known closures, and mandatory facilities. Incompatible rules or closed access strictly disqualify the trip.
*   **Phase 2 - Comfort Ranking:** Score actual activities (arrival/setup, evening cooking, sleeping, packing up). Start with broad forecast-confidence descriptions, adding numeric uncertainty bands based on ensemble ranges later. Keep weather calculations, fire permissions, and thresholds in application code.

---

## 4. Tech Stack & Local AI (Polished v1.3)
*   **Frontend:** Next.js LTS (16.x Active or 15.x Maintenance).
*   **Mapping:** MapLibre GL + vector tiles. Check Nominatim limits for geocoding.
*   **Backend:** FastAPI + PostgreSQL + PostGIS. Add a durable scheduler/worker process for ingestion, monitoring, PDFs, and inference.
*   **Routing:** Valhalla (best for evaluating variable vehicle restrictions).
*   **PDF:** Server-side Playwright with print-layout and map-quality checks.
*   **Local AI Integration:**
    *   **Qwen:** Constrained tasks (parse natural-language requests, explain recommendations, extract policy changes, answer campground questions).
    *   **DeepSeek:** Background review (identify mismatched dates/locations/conditions and suggest resolutions). Ensure correct model identifier (e.g., DeepSeek-R1-Distill-Qwen-14B) and validate on camping tasks first.

---

## 5. Regional Pilot Plan (10-Week MVP)
For a solo/small team, the national specification carries too many unvalidated dependencies. We will launch a regional pilot (e.g., one state and city catchment).

### Weeks 1–2: Foundation & Data Truth
*   Interview 10 campers now to choose one audience and catchment.
*   Validate feed access and commercial licensing.
*   Establish 50–100 canonical campground records. Do this *before* building recommendations.

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
