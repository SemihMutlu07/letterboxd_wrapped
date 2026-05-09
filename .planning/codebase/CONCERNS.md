# CONCERNS.md — Technical Debt, Known Issues & Risk Areas

> Mapping date: 2026-05-09

## 🚨 High Priority

### 1. Backend Not Deployed
The FastAPI backend has a `backend/Dockerfile` configured for Render but is **not deployed or running anywhere**. The entire application is local-only. The frontend (`NEXT_PUBLIC_API_BASE`) must point to a running backend instance. Without deployment:
- Users cannot access the app externally
- Sharing "wrapped" results has no practical pipeline
- Demo/portfolio use blocked

**Files:** `backend/Dockerfile`, `netlify.toml` (frontend-only deploy)

### 2. TMDB as Hard Dependency
The analysis pipeline fails if TMDB is unreachable. Without TMDB:
- Cinema scale cannot compute
- No genre, country, decade, language, or director data
- The `process_comprehensive_letterboxd_data()` raises `ValueError` if `watched.csv` is empty but doesn't gracefully degrade when TMDB returns no matches

**Risk:** If TMDB rate-limits or changes API, the app produces empty/minimal results with no fallback beyond basic film counts.

**Files:** `backend/app/services/analysis.py`, `backend/app/services/tmdb_client.py`

### 3. Scraper Fragility
The Letterboxd scraper (`backend/app/services/scraper.py`) depends on:
- Specific HTML class names (e.g., `.rating.rated-N`, `.film-poster`)
- Cloudflare not blocking `cloudscraper`
- Letterboxd pagination structure remaining stable
- 0.5s delay between requests (slow for large profiles)

**Risk:** High. Any HTML change on Letterboxd breaks scraping silently (logged but no alert). The `_is_cloudflare_block()` check only detects explicit challenge pages, not silent HTML changes.

### 4. In-Memory Task State
`backend/app/task_manager.py` uses a module-level `Dict[str, TaskState]`:
- **Lost on server restart** — any in-progress analysis is lost
- **Single-instance only** — cannot scale horizontally
- **Unbounded memory** under heavy use (though 1-hour cleanup mitigates)
- Tasks expire after 1 hour, which may not be enough for large profiles with slow TMDB

## ⚠️ Medium Priority

### 5. Missing Test Coverage
As documented in `TESTING.md`:
- Only 1 frontend test file with smoke tests
- Backend integration tests mock the critical TMDB path
- Cinema scale computation has zero tests despite being the core differentiator
- Analysis pipeline edge cases untested

**Risk:** Regressions in analysis logic, especially in the 600+ line `process_comprehensive_letterboxd_data()` function.

### 6. Static Export Limitations
`output: 'export'` in `next.config.ts` means:
- API route handlers are **compile-time only** — `frontend/src/app/api/upload/route.ts` returns 501
- No server-side features (SSR, ISR, middleware, rewrites are ignored)
- Image optimization disabled
- All dynamic behavior must happen client-side or via external backend

**Confirmed:** The rewrite config exists but is documented as ignored in export mode.

### 7. Upload Directory Growth
Uploaded ZIP/CSV files are extracted to `backend/app/uploads/{UUID}/` directories. While each is cleaned up via `shutil.rmtree()` after analysis completes, there's no:
- Orphan cleanup mechanism (if server crashes during analysis)
- Size limits on individual uploads (beyond 5MB feedback limit)
- Total disk usage monitoring

### 8. No CI/CD Pipeline
No GitHub Actions or CI configuration exists:
- No automated test runs on push/PR
- No lint checking in CI
- No build verification
- No deployment automation

## 🔧 Low Priority / Nice-to-Have

### 9. TMDB Cache Is Unbounded
The `backend/app/tmdb_cache/` directory accumulates JSON files with no eviction policy:
- ~85 cached entries found (small for now, but will grow)
- No LRU, no TTL, no size limit
- Manual cleanup needed (`rm -rf tmdb_cache/*`)

### 10. Type Safety Gap Between Frontend and Backend
The backend returns a richly typed stats dictionary, but the frontend consumes it via:
- `interface StatsData` in `frontend/src/containers/results/experimental/types.ts` — partial and manually maintained
- `interface LetterboxdStats` in `frontend/src/lib/api.ts` — minimal, with `[key: string]: unknown` escape hatch
- Results page uses `any` type for `ResultsContent` props

**Risk:** Backend schema changes silently break frontend rendering (no compile-time validation).

### 11. Duplicate Cinema Scale Implementation
The Shannon entropy-based cinema scale is implemented in **two places**:
- `backend/app/analysis_utils.py:compute_cinema_scale()` — canonical version
- `frontend/src/app/results/page.tsx:calcCinephileScore()` — client-side fallback

The fallback exists because older result data stored in localStorage may not include `sinefil_meter`. However, the two implementations must stay in sync — a known maintenance burden.

### 12. Matplotlib & Seaborn as Bloat
`matplotlib` and `seaborn` are listed in `backend/requirements.txt` but **not used anywhere** in the codebase. They add ~25MB to the Docker image for no benefit.

### 13. Unused Frontend Dependencies
Several frontend dependencies could be unused or over-inclusive:
- `@types/canvas-confetti` (typed, but confetti is used)
- `jszip` (used in tests or upload?)
- `framer-motion` (active, core animation lib)

Recommend running `depcheck` (already in devDeps) or `ts-prune` periodically.

### 14. Hardcoded Values
- `MAX_PAGES = 60` in scraper (arbitrary cap of ~3000 films)
- `MAX_PROFILE_PAGES = 25` for date night
- `_RATE_LIMIT_WINDOW = 600` seconds in multiple routes
- Rate limit constants duplicated across `watchlist.py` and `recommend.py` and `feedback.py` (should share a config)
- `PAGE_DELAY = 0.5` seconds in scraper

### 15. `runs/` Directory Persistence
Analysis run logs are written to `backend/runs/` as JSON. While gitignored, there's no:
- Cleanup mechanism
- Size limit
- Privacy consideration (contains film data)

## Known Bugs / Quirks

### Frontend
- **`frontend/src/app/api/upload/route.ts` returns 501** — intentional for static export, but confusing trace if someone tries to use it
- **Results page `any` types** — `ResultsContent` function accepts `props: any`, bypassing type safety for 20+ props

### Backend
- **Scraper uses synchronous `requests`** — runs in event loop, potentially blocking other requests
- **`_find_csv_files()`** uses loose filename matching (`req.split(".")[0] in file.lower()`), which could match unintended files (e.g., "ratings_copy.csv")
- **NaN in JSON responses** — guarded by `isinstance(x, str)` checks for `poster_path`, but other pandas-derived fields could slip through
- **Rate limit config duplication** — `_RATE_LIMIT_MAX`, `_RATE_LIMIT_WINDOW`, `_client_key()` and `_check_rate_limit()` are copy-pasted across 3 route files

## Security Considerations
- **Supabase ANON key only** — correct, no service_role key exposure
- **PostHog consent-gated** — correct, default opt-out
- **No user authentication** — all data is local/ephemeral
- **Upload directory cleaned after analysis** — correct, but orphan risk on crash
- **Netlify secret scanning** — explicitly configured to allow `NEXT_PUBLIC_*` vars

## Performance Notes
- **TMDB rate limit at 25 req/s** with deque-based pacing — conservative but safe
- **Asyncio.gather** for parallel TMDB fetches — efficient for large libraries
- **Lazy loading** on results page (IntersectionObserver) — good for perceived performance
- **No CDN for static assets** — Netlify handles this
- **No image optimization** — `unoptimized: true` in Next config
