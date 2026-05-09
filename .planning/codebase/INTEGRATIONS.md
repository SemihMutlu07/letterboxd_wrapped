# INTEGRATIONS.md — External Services & Integrations

> Mapping date: 2026-05-09

## 1. TMDB (The Movie Database)

**Type:** REST API (v3)
**Direction:** Outbound (backend → TMDB)
**Auth:** API key via `settings.tmdb_api_key` (pulled from `.env`)
**Rate limit:** Conservative pacing via `_tmdb_request_times` deque (default 25 req/s), plus 429 retry logic

**Usage:**
- `backend/app/services/tmdb_client.py` — core client with disk caching
- `backend/app/routes/tmdb.py` — proxy endpoint for TMDB images (`/tmdb-proxy/{path}`)

**Cache:** Disk-based at `backend/app/tmdb_cache/` (MD5-hashed URL + params, JSON files). Approx 85 cached entries found.

**Key endpoints called:**
- `search/movie` — resolve Letterboxd film title → TMDB ID
- `movie/{id}` — full metadata (budget, revenue, genres, runtime, etc.)
- `movie/{id}/credits` — director + cast
- `movie/{id}/keywords` — keyword tags
- `search/person` — actor/director profile image URL (for results page)

**Fallback behavior:** If TMDB fails or returns no results, the film is still counted in totals but excluded from enriched stats (match rate reported in `stats.data_quality_report`).

## 2. Letterboxd (Scraping)

**Type:** Public HTML scraping
**Direction:** Outbound (backend → letterboxd.com)
**Auth:** None (public profiles only)
**Library:** `cloudscraper` (Cloudflare bypass) + `BeautifulSoup4` + `lxml`

**Usage:**
- `backend/app/services/scraper.py` — profile check, diary scraping, film grid scraping
- Called by `backend/app/routes/analyze.py` (`/api/scrape-profile`)

**Scraped pages:**
- `/{username}/films/diary/page/{N}` — diary entries with ratings + dates
- `/{username}/films/page/{N}` — film grid (all public films)

**Limits:** Max 60 pages (~3000 films), 0.5s delay between requests

**Fragility:** Depends on Letterboxd's HTML structure. Cloudflare changes or site redesigns will break scraping. The `_is_cloudflare_block()` check detects challenge pages.

## 3. Supabase

**Type:** PostgreSQL + REST API
**Direction:** Client-side only (frontend → Supabase)
**Auth:** ANON key (public, embedded in frontend build)
**Tables involved:**
- `user_sessions` — opt-in anonymous analytics
- `feedback` — user feedback submissions
- `analysis_runs` — completion events

**Files:**
- `frontend/src/lib/supabaseClient.ts` — Supabase client init
- `frontend/src/lib/supabase/feedback.ts` — feedback insert
- `frontend/src/lib/supabase/sessions.ts` — session tracking
- `frontend/src/lib/supabase/analysis_runs.ts` — analysis run events

**Constraint:** ANON-key only. No `service_role` key anywhere. RLS policies must handle the authorization.

## 4. PostHog

**Type:** Product analytics
**Direction:** Frontend → PostHog (cloud, US region)
**Auth:** Client-side API key (`NEXT_PUBLIC_POSTHOG_KEY`)
**Status:** Consent-gated — analytics events only fire after user accepts consent modal

**Consent flow:**
1. `PreResultsConsentModal` shown on results page
2. User accepts → `posthog-js` initialized, `consent_decision` set in sessionStorage
3. `trackConsentedEvent()` checks consent before sending

**Files:**
- `frontend/src/lib/posthog.ts` — PostHog init and event helpers
- `frontend/src/lib/consentFlow.ts` — consent logic
- `frontend/src/lib/analytics.ts` — wrapper combining PostHog + Supabase + internal analytics

## 5. TMDB Image Proxy

**Type:** Backend → TMCD images (CORS bridge)
**Direction:** Frontend → Backend → TMDB image CDN
**Endpoints:**
- `GET /tmdb-proxy/{path}` — proxy TMDB images, cache headers set to 1 year
- `OPTIONS /tmdb-proxy/{path}` — CORS preflight

**Purpose:** TMDB image CDN (`image.tmdb.org`) doesn't serve CORS headers needed for `html-to-image` canvas export during share card generation.

## 6. Netlify

**Type:** Static hosting + CDN
**Direction:** Frontend build → Netlify deploy
**Config:** `netlify.toml` — build from `frontend/`, publish `out/`
**Secret scanning:** Explicitly configured to allow `NEXT_PUBLIC_*` env vars

## Environment Variable Summary

| Variable | Required | Used In | Purpose |
|----------|----------|---------|---------|
| `TMDB_API_KEY` | Yes | Backend | TMDB API access |
| `NEXT_PUBLIC_API_BASE` | Yes | Frontend | Backend URL for API calls |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Frontend | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Frontend | Supabase anonymous access |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Frontend | PostHog analytics |
| `FRONTEND_ORIGINS` | No | Backend | Additional CORS origins |
| `ALLOW_ALL_NETLIFY` | No | Backend | Wildcard Netlify CORS |
| `DEBUG_CINEMA_SCALE` | No | Backend | Debug logging for sinefil_meter |
| `LOG_LEVEL` | No | Backend | Python log level (default INFO) |
| `TMDB_REQUESTS_PER_SECOND` | No | Backend | Rate limit (default 25) |
| `TMDB_429_RETRIES` | No | Backend | Retry count on 429 (default 2) |
