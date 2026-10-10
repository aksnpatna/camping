# Camp Smart Australia - Workspace Agent Context

## 🎯 Core Project Vision
This is the **Camp Smart Australia** repository. 
We are building an "Answer-First" trip finder for Australian campers. We do NOT dump 50,000 dots on a map like competitors. We provide curated, rigorous, condition-aware Trip Cards and a "Plan B" engine that proactively alerts users to weather shifts and closures.

## 🛠 Required Agent Skills
When working in this repository, you should automatically invoke the following skills:
1. `backend-architect` & `api-patterns` (for all FastAPI/PostGIS work)
2. `ui-ux-designer` (for all Next.js work)
3. `tdd-workflow` (MANDATORY: Write failing tests before writing implementation code)
4. `lint-and-validate` (MANDATORY: Ensure strict type checking and linting before completing a task)

## 🏗 Tech Stack Rules
*   **Frontend:** Next.js (Current Stable/Canary).
*   **Backend:** FastAPI + PostgreSQL + PostGIS.
*   **Ports:** Avoid standard ports (like 3000 or 8000) as this machine runs multiple apps. Default to non-standard ports (e.g., Frontend: 3021, Backend: 8021, DB: 5431) or dynamically check for open ports before starting services.
*   **Mapping:** MapLibre GL + Vector Tiles. Use a self-hosted Nominatim or paid geocoder (do NOT use Nominatim's public commercial instance).
*   **Routing:** OSRM or paid API (Mapbox/Google). No Valhalla for MVP.
*   **AI Engine:** Local-First (e.g., Ollama). Fallback to hosted Groq if extraction/explanation evals fail. Use DuckDuckGo for web searches.

## ⚠️ Safety & Legal Constraints (NON-NEGOTIABLE)
1. **Fire Rules & SEO:** SEO pages and UI components displaying fire rules MUST render live state. **Degradation Rule:** If the RFS/BOM feed is down, you must render a prominent "status unavailable" banner. Do NOT cache and present stale fire rules.
2. **Data Sourcing (ODbL):** OSM-derived data (including Nominatim geocoding) must be kept in a strictly separable layer from our 25 canonical campground records to avoid triggering the ODbL share-alike clause.
3. **Availability:** We do not scrape NPWS/Parks Victoria availability. Plan B value is centered around weather/closures. Availability is only a bonus if verified.
4. **Alerting:** Default alerts are Email/Web-Push. SMS (Twilio) is strictly opt-in due to costs.

## 🚫 Out of Scope (Do Not Build)
* No Voice-to-Text (Deferred to v2)
* No DeepSeek background review agents (Deferred to v2)
* No generic "scrape the web" for availability
* No Telegram Bots (Low penetration in AU 35+ demographic)
