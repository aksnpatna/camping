# Camp Smart – Security & Hosting Guide

## What protects the API (backend/app/core/security.py)

| Layer | Behaviour |
|---|---|
| Per-IP global limit | `GLOBAL_RATE_LIMIT` req / `GLOBAL_RATE_WINDOW_SECONDS` (default 120/60s). Over the limit → `429` + `Retry-After`. `/api/v1/health` is exempt. |
| Auto-ban | `BAN_STRIKE_THRESHOLD` (30) rejections within 10 min → IP blocked for `BAN_DURATION_SECONDS` (15 min), rejected before any work is done. |
| Route limits | Group limits on every router, tighter on costly/sensitive routes: AI summary / insights 12/min, find-weekend 15/min, magic-link 5 per 10 min per IP **and** 3/hour per target address, save-trip 20/hour, check-in 10 per 10 min, create room 10/hour, event ingestion 30/min. |
| IP trust | `CF-Connecting-IP` / `X-Forwarded-For` are believed **only** when the TCP peer is in `TRUSTED_PROXY_CIDRS` (Docker/private ranges). Direct clients cannot spoof their address. uvicorn runs with `--no-proxy-headers` so it cannot rewrite it either. |
| Body size | Requests over `MAX_BODY_BYTES` (64 KB) → `413`. |
| Load shedding | uvicorn `--limit-concurrency 200`, short keep-alive; bounded DB pool (`DB_POOL_SIZE`, `DB_POOL_TIMEOUT`) fails fast rather than queueing forever. |
| Admin | `X-Admin-Key` header only (never query string), constant-time compare, fails closed if `ADMIN_KEY` unset, 10 bad attempts / 10 min per IP. Protects `GET /analytics/summary`, `GET /analytics/leads`, `POST /campsites`. |
| Input | Length caps and enums on analytics events, check-ins, trip rooms, saved trips, prompts. Trip room tokens are 128-bit (`secrets.token_urlsafe(16)`), lists capped at 200 items. |
| Headers / CORS | nosniff, frame deny, referrer policy, HSTS in production, `no-store` on private routes. CORS limited to `FRONTEND_URL` + `ALLOWED_ORIGINS`, GET/POST only, no credentials. `/docs` and `/openapi.json` are off in production. |

Limits are in-process, so the API runs **one** worker per container (exact counters). Cloudflare is the outer layer for volumetric attacks; this layer stops application-level abuse and anything that reaches the origin.

The frontend (Next.js) sends CSP, HSTS, `X-Frame-Options` etc. and hides `X-Powered-By`.

## Deploy checklist (order matters)

1. **Rotate secrets now.** The Smartproxy password and the shared DB password (`realestate_pass`) were committed in git history (`b918989`, `d176df0`, `c37ca6e`). Treat them as leaked. Create a dedicated Postgres role for `camping_db`, then update `DATABASE_URL`/`PROXY_URL` in `.env`.
2. **Fill `.env`** (git-ignored; template in `.env.example`). `SECRET_KEY` and `ADMIN_KEY` were generated for you. Set `FRONTEND_URL` to the real domain, and the `SMTP_*` values with `EMAIL_TRANSPORT=smtp` (needed for magic links and Plan B alerts).
3. **Change the Cloudflare tunnel ingress before redeploying.** It currently targets `host.docker.internal:8021` (API) and `:3021`. The new compose file no longer publishes the API and binds the frontend to loopback. In Zero Trust → Tunnels → Public hostname, point the camping hostname at **one** service: `http://camping-frontend:3021` (the tunnel container shares the `asx-prediction_default` network). Remove the separate `/api` rule; Next.js proxies `/api/*` internally.
4. `docker compose up -d --build` (launches backend API, Next.js frontend, and the automated Plan B background worker).

## Cloudflare settings (free plan is enough)

- SSL/TLS: Full (strict); Always Use HTTPS; HSTS on.
- Security → Bots: Bot Fight Mode on.
- WAF rate-limiting rules (per IP):
  - `/api/v1/auth/*` — 10 requests / 10 min → block 1 h
  - `/api/*` — 300 requests / min → managed challenge
  - everything — 600 requests / min → managed challenge
- Security Level: Medium; enable "Under Attack Mode" during an incident.
- Optionally restrict `/api/v1/analytics/summary|leads` and `POST /api/v1/campsites` with a WAF rule or Cloudflare Access so only you can reach them.

## Host machine

- Firewall default-deny inbound (`ufw default deny incoming`); the tunnel needs no open ports.
- Nightly `pg_dump` of `camping_db` to another disk/offsite; test a restore.
- `docker compose` containers run as non-root, read-only with tmpfs (backend and worker), `cap_drop: ALL`, `no-new-privileges`, memory/pids limits.
- Keep dependencies patched: `pip-audit`, `npm audit`.

## Privacy & Legal Compliance Implemented

- **Australian Privacy Act 1988 (Cth)**: Dedicated `/privacy` page detailing minimal data collection, zero third-party data selling, and Right to Erasure instructions (`privacy@campsmart.au`).
- **Australian Spam Act 2003**: 
  - Every automated Plan B email includes an immediate 1-click unsubscribe link (`GET /api/v1/saved-trips/{id}/unsubscribe`).
  - Campers can toggle monitoring on/off at will directly in their dashboard (`POST /api/v1/saved-trips/{id}/toggle-plan-b`).
  - Explicit consent notices with privacy links on email capture forms.
- **Bush Safety & Legal Disclaimers**: Dedicated `/terms` page featuring emergency contact directory (000, SES 132 500, RFS/CFA), Total Fire Ban rules, degradation rule disclosures, riparian flood hazards, and limitation of liability.
- **Site-Wide Transparency**: Reusable `Footer` on the explorer displaying legal links, official emergency contacts, and live fire degradation notes.
