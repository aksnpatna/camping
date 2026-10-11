# Camp Smart Australia - Plan v2

## 🎯 Core Product Promise
**“Turn your free weekend into a camping trip that fits your group, your gear, and the conditions.”**

Our goal is to shift from a reliable map browser to a comprehensive, answer-first trip-planning experience. We will help users choose, prepare, coordinate, and dynamically adjust a trip based on changing conditions.

## 🚀 Key User Journeys & Prioritized Features

### 1. "Find my weekend" Planner (Homepage)
* **Short-form & Natural Language Input:** Support inputs like *"Two adults, two kids and a dog. Leaving Sydney Friday afternoon, back Sunday. Tent camping, toilets essential, under three hours driving."*
* **Ranked Results:** Return exactly three tailored trips based on origin, dates, group, equipment, budget, and preferences.
* **Trip Cards Must Include:**
  * Why it fits the stated requirements (and the main compromise if any).
  * Driving time and arrival estimates.
  * Relevant conditions and weather during the trip.
  * Supported facilities and known costs.
  * Booking links and availability-check status.
* **Constraints:** Never silently drop requirements (e.g., "dog required"). If unable to fulfill, explain the limiting constraint and offer an explicit adjustment.

### 2. Compare and Adjust (The "What if?" Engine)
* Allow users to compare up to three trips side-by-side across attributes.
* Provide quick adjustment controls:
  * *"Leave Saturday morning"*
  * *"Allow another 30 minutes driving"*
  * *"Show options with showers"*
* **Implementation:** Use conversational AI to interpret changes, update visible filters, and rerun the search tool. Do not guess future weather beyond forecast coverage (use flexible dates for features/costs only).

### 3. Personal Preparation Board
* **Reusable Equipment Profile:** Let users save items they own (e.g., tent, sleeping bags, stove).
* **Trip-Specific Checklists:** Combine the profile with the trip to generate:
  * Packing lists (with reasons).
  * Food and shopping checklists.
  * Setup and departure tasks.
  * Missing equipment alerts.
* Prioritize borrowing/renting before purchase suggestions (affiliate links are a secondary consequence of useful preparation).

### 4. Shared Trip Room
* A shareable shortlist link where invited group members can:
  * Vote on campsites (Primary vs. Backup).
  * Add personal preferences.
  * Claim shared equipment to bring.
  * Mark preparation tasks complete.
* Requires updating `crud/saved_trip.py` overlap restrictions to allow saving multiple candidates for the same dates before a final choice is made.

### 5. Trip Watch and Practical Plan B
* **Preserve Camper's Original Needs:** Save origin, driving limit, party size, rig, mandatory facilities, and preferences within the `SavedTrip` model.
* **Actionable Alerts:** When forecasts change (e.g., high fire danger or rain), send an alert explaining the change during the planned window.
* **Provide Alternatives:** Offer at least two alternative campsites that still meet the originally saved requirements.
* **Persistence:** Log alerts persistently, manage delivery/retries, and do not just silently disable monitoring after an alert.

---

## 🧠 Local LLM Architecture (The "AI Engine")

Redirect AI inference from promotional summaries to **structured interpretation and explanations tied to retrieved evidence**.

* **Centralize Inference:** Move all Ollama/Groq calls into a single configurable inference service.
* **Structured Outputs:** Use Ollama's JSON-schema and tool-calling capabilities.
* **Data Flow:**
  1. Camper request → Local LLM extracts structured request.
  2. Backend validates & resolves ambiguities.
  3. DB + Routing + Weather APIs supply factual data.
  4. Application applies eligibility rules and ranking.
  5. Local LLM explains the results.
  6. UI renders cards, sources, and editable constraints.

**Key LLM Tasks:**
* **Parse Requests:** Extract dates, groups, requirements.
* **Interpret Follow-ups:** Translate "with showers" to filter updates.
* **Explain Recommendations:** Supply calculated reasons based on evidence.
* **Answer Questions:** Retrieve source records and preserve unknowns.
* **Draft Tasks:** Turn trip + gear into editable checklists.
* **Extract Source Updates:** Identify policy changes from web data.

---

## 🛠 Specific Fixes to Apply Now

1. **Authentication:** `GET /saved-trips/{email}` must require ownership checks (token auth). Complete the email sign-in flow.
2. **Browser Requests:** Standardize `fetch` calls in the frontend to use the existing `/api/v1` rewrite instead of hardcoding `localhost:8021` (currently used in page.tsx, config.ts, and TripCard.tsx).
3. **Plan B Persistence:** Update `worker/plan_b.py` to add persistent alert records, delivery tracking, retries, and alternative selection instead of just logging and turning off the active status.
4. **Gear Advice & Weather:** Use actual forecasts. Do not use past year historical data as "forecasts" or invent rain probabilities. Label historical data distinctly.
5. **AI Insights (`campsites.py`):** Replace numerical `sentiment_score` extraction with attributed observations. Use schemas with nullable fields to represent missing information as "unknown".
6. **Dog Status:** Preserve `True`/`False`/`None` (Unknown) throughout the API and UI instead of defaulting `None` to "Leave the pets at home".
7. **Rig Access:** Separate vehicle access requirements (`4WD_ONLY`) from accommodation types (`TENT`, `CARAVAN`) in the data model.
8. **Test Updates:** Fix `test_create_campsite` in `tests/api/test_campsites.py` to include the required `admin_key` query parameter and expect a `201 Created` status code instead of `200`.
9. **Fire Ratings (`fire_status.py`):** Remove random/simulated fire ratings from public pages. Use actual NSW ratings (`Moderate`, `High`, `Extreme`, `Catastrophic`) and check for declared **Total Fire Ban** status separately. Handle the Degradation Rule cleanly in the UI.

---

## 📋 Release Organization
We will build out this release by focusing on three complete user journeys:

1. **Choose:** Structured trip request → ranked options → comparison → booking handoff.
2. **Prepare Together:** Saved trip → equipment profile → checklist → shared shortlist.
3. **Stay Informed:** Persistent monitoring → delivered change alert → suitable backup candidates.
