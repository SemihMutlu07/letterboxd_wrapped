# ARCHITECTURE.md — System Architecture & Data Flow

> Mapping date: 2026-05-09

## Overall Pattern

**Monorepo with two decoupled tiers:**
- `frontend/` — Static Next.js export, deployed on Netlify
- `backend/` — FastAPI async Python server, local-only (not deployed)

The two tiers communicate via HTTP REST. The frontend never serves API routes at runtime (static export); all API calls go to the backend URL configured by `NEXT_PUBLIC_API_BASE`.

## Frontend Architecture

### Page Structure (App Router)

```
/                → LetterboxdLanding (upload / scrape entry)
/results         → ResultsPage (wrapped stats display)
/watchlist       → WatchlistComparePage (lab tools)
```

### Component Layering

```
pages/              — route components (thin wrappers)
│
├── components/     — reusable UI building blocks
│   ├── landing/    — UploadZone, LoadingScreen, ExportInstructions
│   ├── results/    — Cards, Section (generic layout)
│   ├── share/      — ShareModal, share card variants, director crush swap
│   └── watchlist/  — DateNight, WatchlistCompare
│
├── containers/results/  — results section components (one per stats section)
│   ├── HeroStats, Genres, FilmAndRatings, CinemaScale, QuickFacts
│   ├── LanguagesLeaderboard, CountriesList, CrushAndDirectors
│   └── experimental/    — Test Lab sections (world map, cast/director grids, etc.)
│
└── lib/            — infrastructure layer
    ├── api.ts       — all backend API calls
    ├── analytics.ts — PostHog + Supabase analytics wrapper
    ├── posthog.ts   — PostHog init
    ├── session.ts   — session management
    ├── supabase/    — Supabase client modules
    ├── theme.tsx    — Theme context provider
    ├── errors.ts    — error types
    └── insights.ts  — frontend-side insight derivations
```

### Key Architectural Decisions (Frontend)

1. **localStorage as bridge** — analysis results flow: landing page fetches from backend → stores in `localStorage` → results page reads on mount. No Redux/Zustand.

2. **Lazy loading** — `useLazyMount` hook (IntersectionObserver-based) progressively loads below-fold sections with skeleton placeholders.

3. **Theme context** — `ThemeProvider` wraps the results page, provides 3 CSS-variable-driven themes. No Tailwind `dark:` — everything goes through CSS vars.

4. **Static export constraint** — `next.config.ts` has `output: 'export'`, meaning:
   - No API routes at runtime (`api/upload/route.ts` returns 501)
   - No `getServerSideProps` / `getInitialProps`
   - No ISR or revalidation
   - Image optimization disabled (`unoptimized: true`)

5. **Share card generation** — `html-to-image` captures a DOM element as PNG. TMDB images are proxied through backend to avoid CORS issues on canvas.

## Backend Architecture

### App Structure

```
backend/app/
│
├── main.py              — FastAPI app factory + lifespan + middleware
├── config.py            — Pydantic Settings (.env)
├── task_manager.py      — In-memory async task tracking
├── analysis_utils.py    — Pure functions (Shannon entropy, cinema scale)
│
├── routes/
│   ├── analyze.py       — /api/analyze (upload), /api/scrape-profile, /api/progress
│   ├── tmdb.py          — /api/tmdb/person/search, /tmdb-proxy/{path}
│   ├── feedback.py      — /api/feedback, /api/report, /api/parse-username
│   ├── watchlist.py     — /api/watchlist-compare, /api/recommend-from-compare
│   └── recommend.py     — /api/date-night
│
├── services/
│   ├── analysis.py      — Core CSV → stats pipeline (process_comprehensive_letterboxd_data)
│   ├── scraper.py       — Letterboxd public profile scraping
│   ├── tmdb_client.py   — TMDB API client with rate limiting + disk cache
│   ├── recommender.py   — Watchlist comparison + date night logic
│   └── review_analysis.py — Review text metrics
│
├── models/
│   ├── feedback.py      — Feedback/report Pydantic schemas
│   └── recommend.py     — Recommendation Pydantic schemas
│
├── uploads/             — Temporary uploaded file storage
├── tmdb_cache/          — TMDB API response cache
└── runs/                — Run logs (gitignored, JSON per analysis)
```

### API Surface

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| GET | `/` | Root banner | Stable |
| GET | `/health` | Liveness probe | Stable |
| POST | `/api/analyze` | Upload CSV/ZIP → background analysis (202) | Stable |
| GET | `/api/progress/{task_id}` | Poll task state | Stable |
| GET | `/api/progress` | Legacy progress (most recent task) | Stable |
| POST | `/api/scrape-profile` | Scrape public profile → synchronous analysis | Stable |
| GET | `/api/tmdb/person/search` | TMDB person search (for director images) | Stable |
| GET | `/tmdb-proxy/{path}` | TMDB image CORS proxy | Stable |
| OPTIONS | `/tmdb-proxy/{path}` | CORS preflight | Stable |
| POST | `/api/parse-username` | Extract Letterboxd username from filename | Stable |
| POST | `/api/feedback` | Submit user feedback | Rate-limited |
| POST | `/api/report` | Submit bug report | Rate-limited |
| POST | `/api/watchlist-compare` | Compare 2 public watchlists | Rate-limited |
| POST | `/api/recommend-from-compare` | Recommend from watchlist overlap | Rate-limited |
| POST | `/api/date-night` | Mutual profile + recommendations for 2 users | Rate-limited |

### Data Flow: Analysis Pipeline

```
User Upload
     │
     ▼
POST /api/analyze (ZIP or CSV files)
     │
     ▼
202 Accepted → task_id returned
     │
     ▼ (background)
_extract_files() → CSV discovery → _find_csv_files()
     │
     ▼
process_comprehensive_letterboxd_data()
     │
     ├── 1. Load CSVs (pandas): watched, ratings, diary, reviews
     ├── 2. Resolve TMDB IDs (asyncio.gather)
     ├── 3. Fetch metadata from TMDB (asyncio.gather)
     ├── 4. Merge enriched data back into film dataframe
     ├── 5. Compute stats:
     │      ├── Basic: total films, ratings, runtime
     │      ├── Advanced: genres, decades, countries, languages, directors
     │      ├── Cinema Scale (Shannon entropy across 6 axes)
     │      ├── Fun stats: guilty pleasures, duo combos, viewing season
     │      ├── Story analytics: time spent, cinema archetype, cinematic passport
     │      ├── Test Lab data: per-entity ratings, country ISO data
     │      └── Review analysis
     └── 6. Persist run log (JSON to runs/)
     │
     ▼
Frontend polls GET /api/progress/{task_id} until "done"
     │
     ▼
Results page reads from localStorage, renders sections
```

### Data Flow: Scrape Profile

```
POST /api/scrape-profile { username }
     │
     ├── check_profile_exists() → HEAD check on Letterboxd
     ├── scrape_profile_sources() → diary pages + grid pages (parallel async)
     ├── merge_scraped_films() → deduplicate by title+year
     ├── diary_to_csv_dicts() → convert to CSV-compatible format
     ├── Write temporary CSVs → process_comprehensive_letterboxd_data()
     └── Return result (synchronous, no polling)
```

### Async Task System

**In-memory `Dict[str, TaskState]`** — keyed by UUID, held in module-level `_tasks` dict.

- States: `pending` → `running` → `done` / `failed`
- Progress updates via `update_task_progress()` during analysis stages
- Cleanup loop runs every 5 minutes, removes tasks older than 1 hour
- **Limitation:** Lost on server restart. Not suitable for multi-instance/scaling.

### CORS Architecture

```
Client Browser
     │
     ├──→ Netlify (frontend static) ──✔── same-origin, no CORS needed
     │
     └──→ Backend (FastAPI)
              │
              ├── CORSMiddleware (top) — allows configured origins
              │
              └── Custom @app.middleware("http") — catches unhandled 500s
                   BEFORE CORSMiddleware wraps them, so CORS headers survive
                   even on internal errors.
```

This ordering is intentional — `@app.exception_handler(Exception)` would let Starlette's `ServerErrorMiddleware` strip CORS headers on 500s.

### TMDB Integration Architecture

```
Frontend (results page)
     │
     ├──→ /api/tmdb/person/search?name=X&role=director  →  TMDB API (via backend)
     │
     └──→ /tmdb-proxy/t/p/w300/abc.jpg  →  Backend proxies TMDB image CDN,
                                             adds CORS + cache headers
     │
Backend ──→ api.themoviedb.org/3/... (rate-limited, disk-cached)
```

## Error Handling

- **Backend:** Custom middleware catches all unhandled exceptions and returns `{"error_code": "internal_error", "message": "..."}` as JSON (CORS-safe).
- **Frontend:** `ErrorBoundary` wraps the entire app. `handleApiError()` in `frontend/src/lib/api.ts` provides user-friendly error messages per HTTP status.
- **NaN guarding:** `isinstance(x, str)` checks prevent pandas NaN from breaking JSON serialization.
