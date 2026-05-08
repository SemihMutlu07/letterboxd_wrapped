# Movies Wrapped (Letterboxd Wrapped)

## What this repo does
Analyze a user's Letterboxd data and generate a "wrapped"-style film stats summary.
Two input paths: (a) CSV/ZIP export upload, (b) public-profile scrape by username.
Frontend is a static Next.js export; backend is FastAPI that processes uploads/scrapes and enriches with TMDB.

## Tech stack
- Frontend: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, Recharts, Framer Motion
- Backend: Python, FastAPI, Uvicorn, pandas/numpy, aiohttp/aiofiles
- Scraper: BeautifulSoup4 + lxml + requests (used by `app/services/scraper.py`)
- Database: Supabase (client-side insert/upsert for `user_sessions`, `feedback`, `analysis_runs`)
- Analytics: PostHog (consent-gated), in-app helper modules
- Deployment: Frontend on Netlify static export (`output: 'export'`); backend has `backend/Dockerfile` for Render but is **not yet deployed** — currently local-only

## Repo structure
- `frontend/src/app`: Next.js pages + route handlers (`page.tsx`, `results/page.tsx`, `api/*/route.ts`)
- `frontend/src/components`: UI components (landing, share modal, feedback, error boundary, etc.)
- `frontend/src/containers/results`: Results screen sections (incl. `experimental/` for Test Lab)
- `frontend/src/lib`: API calls, analytics, session handling, Supabase client, utils
- `frontend/src/hooks`: Custom hooks (performance/visibility)
- `backend/app/main.py`: FastAPI app factory, lifespan, CORS, router includes, `/` + `/health`
- `backend/app/config.py`: Pydantic settings (env loading, CORS origins)
- `backend/app/task_manager.py`: In-memory async task state (used by `/api/analyze` polling)
- `backend/app/analysis_utils.py`: Safe numerical helpers + `compute_cinema_scale`
- `backend/app/routes/{analyze,tmdb,feedback}.py`: FastAPI routers
- `backend/app/services/{analysis,scraper,tmdb_client}.py`: Domain logic (CSV pipeline, public-profile scrape, TMDB)
- `backend/app/models/`: Pydantic request/response shapes
- `backend/Dockerfile`, `backend/requirements.txt`, `backend/pytest.ini`, `backend/tests/`

## Environment variables (never hardcode values)
Backend:
- `TMDB_API_KEY` (required)
- `ALLOW_ALL_NETLIFY` (CORS allow `*.netlify.app`)

Frontend:
- `NEXT_PUBLIC_API_BASE` (base URL for backend API calls)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`

Rules:
- Never write `.env` values into files.
- Never commit secrets.
- Prefer documenting required env keys in README/CLAUDE only.

## Local development
Frontend:
- `cd frontend`
- `npm run dev:frontend`

Backend:
- Preferred: `npm run dev:backend` (from frontend scripts)
- Alternative: `cd backend && python3 app/main.py`

Both:
- `npm run dev`

## API surface
Backend (routers in `backend/app/routes/`):
- `GET /` — root banner (in `main.py`)
- `GET /health` — liveness probe (in `main.py`)
- `POST /api/analyze` — **202 Accepted**, returns `{task_id, status}`; analysis runs in a background task (`routes/analyze.py`)
- `POST /api/scrape-profile` — synchronous scrape + analyze for a public Letterboxd username (`routes/analyze.py`)
- `GET /api/progress/{task_id}` — poll task state (`pending|running|done|failed` + stage/message/progress + final `result`)
- `GET /api/progress` — legacy: returns the most recent active task's stage (no task_id)
- `GET /api/tmdb/person/search` (`routes/tmdb.py`)
- `GET /tmdb-proxy/{path:path}` + `OPTIONS /tmdb-proxy/{path:path}` — image proxy + CORS preflight
- `POST /api/parse-username` (`routes/feedback.py`)
- `POST /api/feedback` (rate-limited, `routes/feedback.py`)
- `POST /api/report` (rate-limited, `routes/feedback.py`)

Frontend route handlers (built into static export only when statically generable):
- `POST /api/upload` — placeholder, does not process uploads (see Known issues)
- `POST /api/analytics` — validates event payload and returns `ok`

Run logging:
- Each successful `analyze`/`scrape-profile` writes `backend/runs/{username}-{iso-ts}.json` (best-effort; gitignored).

## Hard constraints (do not violate)
- Read the relevant file(s) before making any change.
- Change one thing at a time; keep diffs small.
- Preserve existing code style and structure.
- `next.config.ts` has `output: 'export'`:
  - Do NOT add server-only features or assumptions (no SSR-only features, no runtime server dependencies).
- Commit messages must be in English.

## Known issues (triage order)
1) `frontend/src/app/api/upload/route.ts` returns 501
   - This is intentional for the static export build. Backend API should be used for all processing.

## AI workflow (how to work in this repo)
When asked to implement a change:
1) Locate and open the relevant file(s) first.
2) Propose the smallest safe change.
3) Implement and keep formatting consistent.
4) Update any related types/helpers/tests if applicable.
5) If the change touches analytics or DB: ensure consent gating and no secret leakage.

## Cinema Scale scoring (model_version: cine_v2)
The `sinefil_meter` score uses Shannon entropy across 6 axes (geography, temporal,
languages, volume, genres, directors) computed in `backend/app/analysis_utils.py:compute_cinema_scale`.
TMDB popularity is **not** part of the score — it was removed because popularity decays
over time and inflated nearly every user to 80+. Popularity is still available as a
separate `stats.popularity_info` field for Mainstream-vs-Niche display but must never
feed back into the cinema scale number.

## Backend structure (already modular)
The FastAPI backend is already split into `routes/`, `services/`, `models/`, with `task_manager.py`
and `config.py` separated from `main.py`. Don't reintroduce a monolithic `main.py` — add new
endpoints under the appropriate router and new domain logic under `services/`.

CORS + error-middleware ordering matters: unhandled-exception handling is implemented as a
**custom `@app.middleware("http")`** that wraps the response *inside* the CORS layer.
Do NOT replace it with `@app.exception_handler(Exception)` — Starlette's `ServerErrorMiddleware`
sits *outside* `CORSMiddleware` and would strip `Access-Control-Allow-Origin` on 500s.

When returning JSON that may contain NaN (e.g. pandas-derived `poster_path` for missing rows),
guard with `isinstance(x, str)` before placing it in the response — `JSONResponse(allow_nan=False)`
will otherwise raise during render and surface as a CORS-shaped 500 in the browser.

## Operational safety
- Supabase: use ANON/public key only in frontend. Never introduce service_role keys.
- PostHog: client key only in frontend; keep consent gating consistent and default-safe.
- TMDB: key lives on backend; do not proxy it to the frontend.
