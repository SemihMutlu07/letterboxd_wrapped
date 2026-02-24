# Movies Wrapped (Letterboxd Wrapped)

## What this repo does
Analyze a user's Letterboxd export (CSV/ZIP) and generate a "wrapped"-style film stats summary.
Frontend is a static Next.js export; backend is FastAPI that processes uploads and enriches with TMDB.

## Tech stack
- Frontend: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, Recharts, Framer Motion
- Backend: Python, FastAPI, Uvicorn, pandas/numpy, aiohttp/aiofiles
- Database: Supabase (client-side insert/upsert for `user_sessions`, `feedback`, `analysis_runs`)
- Analytics: PostHog (consent-gated), in-app helper modules
- Deployment: Frontend on Netlify static export (`output: 'export'`), backend currently local-only

## Repo structure
- `frontend/src/app`: Next.js pages + route handlers (`page.tsx`, `results/page.tsx`, `api/*/route.ts`)
- `frontend/src/components`: UI components (landing, share modal, feedback, error boundary, etc.)
- `frontend/src/containers/results`: Results screen sections
- `frontend/src/lib`: API calls, analytics, session handling, Supabase client, utils
- `frontend/src/hooks`: Custom hooks (performance/visibility)
- `backend/app/main.py`: FastAPI app, endpoints, analysis pipeline
- `backend/app/analysis_utils.py`: Safe numerical helpers
- `backend/requirements.txt`: Backend dependencies

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
Backend (see `backend/app/main.py`):
- `GET /` Health check
- `GET /api/progress`
- `POST /api/analyze`
- `GET /api/tmdb/person/search`
- `POST /api/parse-username`
- `GET /tmdb-proxy/{path}` (TMDB image proxy)
- `OPTIONS /tmdb-proxy/{path}` (CORS preflight)
- `POST /api/feedback` (rate-limited)
- `POST /api/report` (rate-limited)

Frontend route handlers:
- `POST /api/upload` Placeholder (does not process uploads)
- `POST /api/analytics` Validates event payload and returns `ok`

## Hard constraints (do not violate)
- Read the relevant file(s) before making any change.
- Change one thing at a time; keep diffs small.
- Preserve existing code style and structure.
- `next.config.ts` has `output: 'export'`:
  - Do NOT add server-only features or assumptions (no SSR-only features, no runtime server dependencies).
- Commit messages must be in English.

## Known issues (triage order)
1) Backend defines `GET /` twice (duplicate route)
   - Fix by keeping one handler (preferred: one minimal health check).
2) Consent key naming inconsistency:
   - `consentDecision` vs `consent_decision`
   - Standardize to one key across frontend (storage + gating + event helper).
3) `frontend/src/app/layout.tsx` uses backslashes (`\\`) in favicon paths
   - Replace with forward slashes.
4) `frontend/src/app/api/upload/route.ts` is a placeholder
   - Keep it minimal OR remove/replace with a clear message, but remember: static export constraints.

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

## Backend refactor note (do later)
There is a planned TODO to refactor the backend into modular packages (split the FastAPI file).
Do NOT do it unless explicitly asked.

## Operational safety
- Supabase: use ANON/public key only in frontend. Never introduce service_role keys.
- PostHog: client key only in frontend; keep consent gating consistent and default-safe.
- TMDB: key lives on backend; do not proxy it to the frontend.
