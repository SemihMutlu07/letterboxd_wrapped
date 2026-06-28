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
- `FRONTEND_ORIGINS` (optional comma-separated extra CORS origins; the 2 production Netlify URLs are already hardcoded)
- `SUPABASE_URL` (new project: `https://ghumergebwwrwlykwjsu.supabase.co`)
- `SUPABASE_ANON_KEY` (publishable key only — never service_role)

Frontend:
- `NEXT_PUBLIC_API_BASE` (base URL for backend API calls)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY` (PostHog Project API Key, public client key)
- `NEXT_PUBLIC_POSTHOG_HOST` (e.g. `https://us.i.posthog.com`; required alongside KEY — analytics silently stays off if missing)

Desktop worker (Windows):
- `TMDB_API_KEY` (same key as backend)
- `WORKER_BACKEND_URL` (backend URL to poll for jobs)
- `WORKER_TOKEN` (shared secret for X-Worker-Token header)
- Worker does NOT need Supabase keys — backend mirrors run logs to Supabase.

Rules:
- Never write `.env` values into files.
- Never commit secrets.
- Prefer documenting required env keys in README/CLAUDE only.
- **Supabase service_role key was leaked in git history and the old project is decommissioned. New project uses publishable (anon) key only. If the Windows desktop has an old `backend/.env` with `SUPABASE_SERVICE_ROLE=...`, delete that line and replace with the new `SUPABASE_URL` + `SUPABASE_ANON_KEY` above.**

## Local development
Frontend:
- `cd frontend`
- `npm run dev:frontend`

Backend:
- Preferred: `npm run dev:backend` (from frontend scripts; defaults to port 8000, override with `BACKEND_PORT`)
- Alternative: `cd backend && python3 app/main.py` (port 8000)

Both:
- `npm run dev` (sets `NEXT_PUBLIC_API_BASE` from `BACKEND_PORT` and refuses to start if that port is already a different service)

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

## Contribution workflow (external contributors)

External contributors (like Berdan) must follow these rules to avoid merge chaos:

### Branch strategy
- **Fork-based**: Contributors fork the repo and work on their own fork. No direct pushes except by repo owner.
- **Owner branches**: Owner may use `main`, `desktop_server` (worker sync), or short-lived feature branches locally.

### Workflow for external PRs
1. Contributor forks → creates a feature branch (e.g. `feat/widget-redesign`)
2. Before opening a PR, contributor **rebases onto latest `origin/main`** and resolves all conflicts locally
   ```
   git fetch upstream
   git rebase upstream/main
   ```
3. PR is opened against `main`. Squash-merge preferred (single commit lands on main).
4. After merge, contributor deletes their remote feature branch.

### What went wrong before (so it doesn't repeat)
- **Dead code sweep done twice**: Once on main (`c2eae18`), once on Berdan's branch (`423648c`). The merge brought back old Test Lab files that main had already cleaned. Solution: always rebase before PR, and keep sweeping decisions on main, not in PR branches.
- **RSS subsystem resurrection**: The Berdan merge conflict resolution accidentally preserved dead files. Solution: after merging a PR, run a quick `find` check for known-dead patterns (RSS, Sentry, etc.).
- **Experimental tree vs redesign**: Berdan's PR (#11) replaced `results/page.tsx` with `WrappedBrutal.jsx`. Concurrent feedback features (FeedbackFab, ShareModal, PostHog) became dead code because they lived in the old page. Solution: **one PR = one scope**. If a PR rewrites the page shell, it must either integrate or explicitly defer existing features.

### PR readiness checklist (for contributors)
Before opening a PR, verify:
- [ ] `git rebase origin/main` done, no conflicts
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend && pytest` passes (or known pre-existing failures documented)
- [ ] No `.env`, secrets, or credentials in the diff
- [ ] Commit messages in English
- [ ] No deleted files that are still referenced by live code (check with `rg`)

## Known issues (triage order)
1) `frontend/src/app/api/upload/route.ts` returns 501
   - This is intentional for the static export build. Backend API should be used for all processing.
2) **WrappedBrutal orphan gap**: `FeedbackFab`, `ShareModal`, and `PageViewTracker` (PostHog) exist in the codebase but are NOT imported by `WrappedBrutal.jsx`. They must be re-integrated into the neo-brutalist shell.
3) **desktop_server branch out of sync**: Local `desktop_server` branch has no upstream and is behind `origin/desktop_server`, which is itself 3 commits behind `main`. Needs reset + sync before next Windows worker deploy.

## WIP: Feature Extraction from WrappedBrutal.jsx (berdan branch)
**Objective:** Extract functional features from neo-brutal design (`WrappedBrutal.jsx`) and integrate them into the modern results page (`results/page.tsx` + sub-components).

**Design baseline:** Modern Letterboxd-dark theme (dark bg, white text hierarchy, subtle white borders, rounded corners, orange/slate accents) — NO neo-brutal styling.

**Features to extract & integrate:**
1. **FilmModal** (lines 527–560 in WrappedBrutal.jsx)
   - [x] Extract as standalone component `FilmModal.tsx`
   - [x] Shows: title, release_year, director, runtime, language, your_rating, average_rating, community rating comparison
   - [x] Wire into RatingDeviation.tsx: clicking a FilmPosterCard opens modal
   - Status: ✓ Done
   - Details: Created FilmModal.tsx with modern dark theme (bg-[#1a1a1a], border-white/8, rounded-2xl). Enhanced EnrichedFilm interface with director, runtime, language fields. RatingDeviation enriches films with all_films data. FilmPosterCard "View Details" button opens modal with film info and rating comparison.

2. **Director portrait in PersonFilmsModal** (lines 216–294 in WrappedBrutal.jsx)
   - [x] Add `profilePath?: string` prop to PersonFilmsModal.tsx
   - [x] Show TMDB portrait image (h632 size) alongside film grid when available
   - Status: ✓ Done
   - Details: Added profilePath prop to PersonFilmsModalProps interface. Compute profileUrl at component level using getTmdbImageUrl(profilePath, 'h632'). Display portrait (w-16 h-24 rounded-lg) to the left of director name in header. Updated DirectorsGrid and CastGrid to pass selected?.profile_path to PersonFilmsModal. Portrait displays gracefully when available.

3. **Language → film list modal** (lines 721–750 in WrappedBrutal.jsx)
   - [x] Extract LangModal pattern
   - [x] Integrate into LanguagesLeaderboard.tsx: clicking a language row opens modal
   - Status: ✓ Done
   - Details: Created LangModal.tsx component matching modern dark theme. Updated LanguagesLeaderboard to track selected language and filter all_films by language field. Added click handler to language rows with hover state. Modal displays films (up to 20) with title, year, and rating. Integrated allFilms data flow from results/page.tsx through LazyLanguages wrapper.

4. **Reviews word filter + reveal toggle** (lines 785–841 in WrappedBrutal.jsx)
   - [x] ReviewAnalysisSection already has word filter (✓ done)
   - [x] Add blur reveal toggle (filter: blur(4px) when revealed=false)
   - Status: ✓ Done
   - Details: Added `revealed` state to ReviewAnalysisSection. When a word is selected and reviews are filtered, a REVEAL/HIDE toggle button appears in the filter header. Review text displays with `filter: blur(4px)` when hidden, revealing on toggle with 200ms transition. Shows hint text "Review text hidden · hit REVEAL to show it" when blurred. Button styling matches modern theme (slate-700 with slate-200 text).

5. **RatingDeviation → use FilmPosterCard data for modal** (HIGH PRIORITY)
   - [x] Expand EnrichedFilm interface to carry: director, runtime, language, review_text, your_rating, average_rating
   - [x] Create and wire FilmModal component
   - Status: ✓ Done (implemented as Feature 1)
   - Details: FilmModal.tsx displays film title, year, director, runtime, language, your rating, and community rating with delta comparison. EnrichedFilm interface extended with director/runtime/language fields. RatingDeviation enriches rated_films from all_films data. FilmPosterCard "View Details" button opens modal with full film info. Works with both "Rated Higher" and "Rated Lower" tabs.

**Design constraints:**
- Do NOT modify landing page or Watchlist pages
- Do NOT modify neo-brutal route (`WrappedBrutal.jsx`)
- Do NOT add neo-brutal styling anywhere in modern theme
- Modern theme: dark bg (#1a1a1a), white text, border-white/8, rounded-2xl, orange-400 accents

**Verification checklist:**
- [x] `cd frontend && npx tsc --noEmit` passes with 0 errors (verified: 0 errors)
- [x] Visual check: components match dark theme (all 5 features use #1a1a1a, border-white/8, rounded-2xl, orange-400 accents)
- [x] Data flow: clicking opens modals with correct details (FilmModal, LangModal, PersonFilmsModal all wired correctly)
- [ ] `git rebase origin/main` before PR (pending)

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
