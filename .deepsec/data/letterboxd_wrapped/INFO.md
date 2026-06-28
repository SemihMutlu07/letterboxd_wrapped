# letterboxd_wrapped

## What this codebase does

Letterboxd Wrapped — a "year in film" stats visualizer. Users upload a Letterboxd CSV/ZIP export or enter a public username; a Next.js 15 frontend (static export) talks to a FastAPI backend that scrapes/enriches data via TMDB and computes a "Cinema Scale" score. A optional desktop worker (Windows, residential IP) polls the backend for scrape jobs to bypass datacenter bot blocks.

## Auth shape

- No user accounts or sessions. All endpoints are public except worker auth.
- `X-Worker-Token` header gates the desktop worker queue (`/api/worker/heartbeat`, `/api/worker/job`). Mismatches → 403.
- Supabase tables (`analysis_runs`, `user_sessions`, `feedback`) accept client-side inserts using the **publishable (anon) key only** — no JWT, no service_role key anywhere.
- Rate limits on `/api/feedback` and `/api/report` are in-memory per IP (10 min window, max 3). Restart resets state.

## Threat model

1. **Bot/scraper abuse on public endpoints** — highest risk; backend has no API keys for users, only a TMDB key.
2. **Worker queue poisoning** — anyone with `WORKER_TOKEN` can inject jobs or heartbeat; token is a shared secret, not per-worker.
3. **Supabase RLS misconfiguration** — since backend mirrors use anon key, overly permissive RLS could expose other users' analysis results or feedback.
4. **Upload path abuse** — ZIP extract + CSV parse; no sandboxing on the extracted content.

## Project-specific patterns to flag

- **Custom `@app.middleware("http")` for unhandled exceptions is load-order sensitive.** It must sit *inside* `CORSMiddleware`. Swapping order strips `Access-Control-Allow-Origin` on 500s.
- **`JSONResponse(allow_nan=False)` + pandas-derived `poster_path` fields.** Missing TMDB matches produce float NaN. Backend guards these with `isinstance(x, str)` before JSON serialization; missing guard → CORS-shaped 500.
- **In-memory `_rate_limiter` dict in `feedback.py`.** Stateless; any Render restart or multiple backend replicas bypass the limit entirely.
- **Desktop worker uses `cloudscraper` + `BeautifulSoup` on residential internet.** No proxy rotation; ISP-level IDS (TurkNet) can flag high concurrency and isolate the line. Rate limits added via `ThreadPoolExecutor(max_workers=10)` and `aiohttp.TCPConnector(limit=100)`.
- **Supabase service_role key was historically leaked and the old project decommissioned.** Ensure no stale `SUPABASE_SERVICE_ROLE` env var or hardcoded key remains in repo history or local `.env`.

## Known false-positives

- **`frontend/src/app/api/upload/route.ts` returns 501** by design; static-export build cannot process uploads. Real upload goes to backend `/api/analyze`. Not a missing feature.
- **`ALLOW_ALL_NETLIFY` / `frontend_origins` CORS** is intentionally permissive for Netlify preview deploys.
- **`/api/progress` (legacy, no task_id)** is still live for backward compatibility.
- **Frontend `localStorage['letterboxdStats']`** persists the last analysis result; multi-tab overwrite is a known UX quirk, not a security issue.
