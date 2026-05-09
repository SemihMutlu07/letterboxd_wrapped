# STRUCTURE.md — Directory Layout & Key Locations

> Mapping date: 2026-05-09

## Top-Level Layout

```
letterboxd_wrapped/
├── backend/              # FastAPI Python backend
├── frontend/             # Next.js static React frontend
├── docs/                 # Project documentation
├── .planning/            # GSD planning artifacts (this folder)
├── .agents/              # Agent skills
├── .claude/ .cursor/ .pi/ .codex/  # AI configuration
├── .remember/            # Agent memory (project-level)
├── prototype_backup_DO_NOT_TOUCH/  # Frozen prototype backup
├── tmdb_cache/           # TMDB disk cache (runtime-generated)
├── uploads/              # Uploaded ZIP/CSV extraction dirs
├── grep/                 # Search logs
│
├── netlify.toml          # Netlify build config
├── CLAUDE.md             # Agent reference (comprehensive)
├── NOTES.md              # Project notes
└── .gitignore
```

## Frontend: `frontend/src/`

```
src/
├── app/                              # Next.js App Router pages
│   ├── layout.tsx                    # Root layout (fonts, ErrorBoundary, PageViewTracker)
│   ├── page.tsx                      # Landing page → LetterboxdLanding
│   ├── globals.css                   # Global Tailwind imports
│   ├── results/page.tsx              # Results page (main wrapped display)
│   ├── watchlist/page.tsx            # Watchlist compare lab tool
│   ├── favicon.ico / icon.png        # Favicons
│   └── api/
│       ├── upload/route.ts           # PLACEHOLDER — returns 501
│       └── analytics/route.ts        # PLACEHOLDER — validates payload, returns ok
│
├── components/                       # Reusable UI components
│   ├── ErrorBoundary.tsx             # React error boundary (app-level)
│   ├── ErrorBanner.tsx               # Error display banner
│   ├── PageViewTracker.tsx           # Analytics page view (Suspense-wrapped)
│   ├── ThemeSwitcher.tsx             # Theme toggle component
│   ├── ThemeWrapper.tsx              # Applies CSS vars from context
│   ├── FeedbackFab.tsx               # Feedback FAB (floating action button)
│   ├── ShareCard.tsx                 # Legacy share card
│   ├── ShareModal.tsx                # Share modal (card orientation, download)
│   ├── PreResultsConsentModal.tsx    # Analytics consent dialog
│   ├── LetterboxdLanding.tsx         # Main landing page component
│   │
│   ├── landing/
│   │   ├── UploadZone.tsx            # File upload drop zone
│   │   ├── LoadingScreen.tsx         # Loading/progress animation
│   │   └── ExportInstructions.tsx    # How-to-export instructions
│   │
│   ├── results/
│   │   ├── Cards.tsx                 # Generic stat card component
│   │   └── Section.tsx              # Generic section layout wrapper
│   │
│   ├── share/
│   │   ├── types.ts                  # ShareCardData type
│   │   ├── OrientationToggle.tsx     # Horizontal/vertical toggle
│   │   ├── CrushDirectorSwap.tsx     # Toggle between crush/director
│   │   └── variants/
│   │       ├── EditorialShareCard.tsx
│   │       ├── StatHeroShareCard.tsx
│   │       └── Variant3ShareCard.tsx
│   │
│   └── watchlist/
│       ├── WatchlistCompare.tsx      # Watchlist comparison layout
│       └── DateNight.tsx             # Date night recommendation UI
│
├── containers/results/               # Results section components
│   ├── HeroStats.tsx                 # Hero banner (total films, avg rating, etc.)
│   ├── Genres.tsx                    # Genre breakdown (horizontal bars)
│   ├── FilmAndRatings.tsx            # Film history + ratings bar chart
│   ├── QuickFacts.tsx               # Quick metrics grid
│   ├── CinemaScale.tsx              # Sinefil meter score + breakdown
│   ├── CountriesList.tsx            # Country exploration
│   ├── LanguagesLeaderboard.tsx     # Language leaderboard
│   ├── CrushAndDirectors.tsx        # Movie crush + director spotlight
│   │
│   └── experimental/                 # TEST LAB — optional, hidden from main flow
│       ├── types.ts                  # StatsData type definition
│       ├── ExperimentalScreen.tsx    # Test Lab container
│       ├── sections/
│           ├── CastGrid.tsx          # Actor grid wall
│           ├── DirectorsGrid.tsx     # Director grid wall
│           ├── CountriesSection.tsx  # Country breakdown
│           ├── CountryOutline.tsx    # Country outline SVGs
│           ├── RatingDeviation.tsx   # Rating outlier detection
│           ├── SectionsTab.tsx       # Tab navigation
│           ├── DevDebugPanel.tsx     # Debug tools
│           ├── section-utils.ts      # Shared section helpers
│           └── world-map/
│               ├── WorldMapSection.tsx
│               ├── MapRenderer.tsx
│               ├── world-map-aggregator.ts
│               └── iso-numeric-to-iso2.ts
│
├── hooks/
│   ├── useDeviceMemory.ts           # navigator.deviceMemory query
│   ├── useIntersectionObserver.ts   # Lazy mount + visibility tracking
│   └── useRafThrottle.ts            # RAF-throttled resize handler
│
├── lib/                              # Infrastructure layer
│   ├── api.ts                       # All backend API calls (analyze, scrape, compare)
│   ├── api-schema.ts                # API response type definitions
│   ├── analytics.ts                 # Analytics wrapper (PostHog + Supabase + internal)
│   ├── analytics-README.md          # Analytics usage guide
│   ├── posthog.ts                   # PostHog initialization
│   ├── consentFlow.ts               # Consent logic
│   ├── session.ts / session-id.ts   # Session ID management
│   ├── sessionUtils.ts              # Session utility helpers
│   ├── supabaseClient.ts            # Supabase client init
│   ├── supabase/                    # Per-table Supabase modules
│   │   ├── feedback.ts
│   │   ├── sessions.ts
│   │   └── analysis_runs.ts
│   ├── theme.tsx                    # Theme context + provider
│   ├── errors.ts                    # Error type definitions
│   ├── errorCapture.ts              # Error capture helpers
│   ├── filename.ts                  # Filename parsing
│   ├── insights.ts                  # Client-side insight derivations
│   ├── tmdbCache.ts                 # Browser-side TMDB image cache
│   └── letterboxd.ts                # Letterboxd-specific utilities
│
├── test/
│   ├── setup.ts                     # Vitest setup (testing library matchers)
│   └── components.test.tsx          # Component smoke tests
│
└── types/
    └── react-simple-maps.d.ts       # Type declarations for react-simple-maps
```

## Backend: `backend/app/`

```
app/
├── main.py                          # App factory, lifespan, middleware, router includes
├── config.py                        # Pydantic Settings
├── task_manager.py                  # In-memory task state (create/update/poll/cleanup)
├── analysis_utils.py                # _to_scalar, safe_*, compute_cinema_scale
│
├── routes/
│   ├── __init__.py
│   ├── analyze.py                   # POST /api/analyze, /api/scrape-profile, /api/progress
│   ├── tmdb.py                      # GET /api/tmdb/person/search, /tmdb-proxy/{path}
│   ├── feedback.py                  # POST /api/feedback, /api/report, /api/parse-username
│   ├── watchlist.py                 # POST /api/watchlist-compare, /api/recommend-from-compare
│   └── recommend.py                 # POST /api/date-night
│
├── services/
│   ├── __init__.py
│   ├── analysis.py                  # process_comprehensive_letterboxd_data (core pipeline)
│   ├── scraper.py                   # Letterboxd HTML scraping (diary, grid, profile check)
│   ├── tmdb_client.py               # TMDB API client (rate-limited, disk-cached)
│   ├── recommender.py               # Watchlist comparison, mutual profile, date night
│   └── review_analysis.py           # Review text metrics (word count, sentiment, etc.)
│
├── models/
│   ├── __init__.py
│   ├── feedback.py                  # FeedbackSubmission, BugReport
│   └── recommend.py                 # UserPairRequest, DateNightResponse, MutualProfile
│
├── uploads/                         # Temporary extraction dirs (UUID-named)
├── tmdb_cache/                      # TMDB API disk cache (MD5-hashed JSONs)
└── runs/                            # Analysis run logs (gitignored)
```

## Backend: `backend/tests/`

```
tests/
├── __init__.py
├── test_api.py                      # ASGI integration tests (via httpx)
└── test_scraper.py                  # Scraper unit tests (mock-based)
```

## Naming Conventions

| Area | Convention | Example |
|------|------------|---------|
| Frontend files | PascalCase for components, camelCase for utilities | `UploadZone.tsx`, `api.ts` |
| Frontend pages | `page.tsx` (Next.js convention) | `results/page.tsx` |
| Backend routes | snake_case | `analyze.py`, `tmdb.py` |
| Backend services | snake_case | `tmdb_client.py`, `analysis.py` |
| Backend models | snake_case | `feedback.py`, `recommend.py` |
| Backend functions | snake_case | `process_comprehensive_letterboxd_data()` |
| CSS classes | Tailwind utility classes | No custom CSS files |
| Types | PascalCase interfaces | `LetterboxdStats`, `ShareCardData` |
| Hooks | `use` prefix + camelCase | `useIntersectionObserver`, `useRafThrottle` |

## Key File Locations for Common Tasks

| Task | File(s) |
|------|---------|
| Add new results section | Create in `containers/results/`, import in `results/page.tsx` |
| Add new API endpoint | Create in `routes/`, include in `main.py` |
| Add new analysis metric | Add to `services/analysis.py` |
| Modify cinema scale scoring | Edit `analysis_utils.py` (backend) and `results/page.tsx` (frontend fallback) |
| Modify share card layout | Edit `components/share/variants/` |
| Add new theme | Edit `lib/theme.tsx` |
| Modify scraper logic | Edit `services/scraper.py` |
| Modify TMDB integration | Edit `services/tmdb_client.py` |
| Add new lab section | Create in `containers/results/experimental/sections/` |
