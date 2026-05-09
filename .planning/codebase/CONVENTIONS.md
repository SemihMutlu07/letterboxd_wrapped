# CONVENTIONS.md — Code Style, Patterns & Error Handling

> Mapping date: 2026-05-09

## TypeScript / React Conventions

### Imports & Exports
- **Named exports preferred** — `export function useTheme()` not `export default`
- Exception: Next.js page components use default export
- Path alias: `@/` maps to `frontend/src/`

### Component Patterns
- **Functional components** with explicit type annotations
- `'use client'` directive on all interactive/components with hooks
- Props typed inline or via separate interface:
  ```tsx
  function HeroStats({ totalFilms, avgRating, ... }: { totalFilms: number; avgRating: number; ... })
  ```
- `useMemo` and `useCallback` used extensively for derived data and event handlers
- Components split into thin page wrappers (`page.tsx`) and logic components (`LetterboxdLanding.tsx`)

### Hooks
- Custom hooks in `frontend/src/hooks/`:
  - `useDeviceMemory` — reads `navigator.deviceMemory`
  - `useIntersectionObserver` — lazy mount + visibility tracking
  - `useRafThrottle` — wraps callbacks with `requestAnimationFrame` throttling

### State Management
- No Redux/Zustand/Context for app state
- `localStorage` as data bridge between pages (landing → results)
- `sessionStorage` for ephemeral state (consent decisions, session IDs)
- React Context only for theme (`ThemeContext`)

### Styling
- **TailwindCSS v4** utility classes exclusively (no CSS Modules, no styled-components)
- No custom CSS beyond `globals.css` (which imports Tailwind)
- CSS custom properties driven by theme context (`--theme-accent`, `--theme-bg`, etc.)
- No arbitrary values (`m-[13px]`) per project convention
- Responsive: mobile-first with `md:`, `lg:` breakpoints
- `clamp()` for fluid typography: `text-[clamp(32px,6vw,72px)]`

### Theming
- Theme system defined in `frontend/src/lib/theme.tsx`
- 3 themes: `current` (dark + orange/purple), `vhs` (warm retro), `classic-bw` (grayscale)
- CSS variables define colors, radii, borders
- Components read theme via `useTheme()` hook → `config.cssVars['--theme-accent']`
- `ThemeWrapper` applies vars via inline `style` on a wrapper div

## Python / FastAPI Conventions

### File Structure
- **Routes** in `routes/*.py` — each file is a router with `APIRouter()`
- **Services** in `services/*.py` — domain logic, no FastAPI dependency
- **Models** in `models/*.py` — Pydantic request/response schemas
- Utilities in module-level files: `analysis_utils.py`, `task_manager.py`

### Imports
- Every file starts with `from __future__ import annotations`
- Standard lib → third-party → local imports (grouped with blank lines)

### Async Patterns
- `async def` for all route handlers and service functions
- `asyncio.gather()` for parallel TMDB requests
- `aiohttp.ClientSession` passed via `request.app.state` (injected in lifespan)
- **Scraper is synchronous** (`requests` + `cloudscraper`) — runs in event loop via `asyncio.to_thread` or direct call

### Type Hints
- Full type annotations on all function signatures
- `Optional[X]` for nullable parameters
- `Dict[str, Any]` for flexible stats dict
- Return types explicitly annotated

### Error Handling (Backend)
- **HTTPExceptions** with structured error bodies: `{"error_code": "...", "message": "..."}`
- Custom middleware catches 500s and returns JSON (bypasses Starlette's ServerErrorMiddleware)
- `_persist_run()` is best-effort — never raises on failure
- NaN guarding: `isinstance(x, str)` checks before placing values in JSON responses

### Error Handling (Frontend)
- `ErrorBoundary` component wraps entire app (see `frontend/src/components/ErrorBoundary.tsx`)
- `handleApiError()` in `frontend/src/lib/api.ts` maps HTTP status codes to user-facing messages
- Silent try-catch on non-critical operations (image loading, localStorage reads)

## Data Patterns

### Pandas Usage
- Dataframes for CSV loading and merging
- `pd.merge()` for joining watched↔ratings↔TMDB metadata
- `apply()` for column transformations (e.g., parsing countries)
- `Counter` for aggregation (more readable than `value_counts()` for complex types)

### Response Shape
- Backend returns flat `stats` dict with nested sub-dicts
- Consumed by frontend directly via `JSON.parse(localStorage.getItem('letterboxdStats'))`
- Type loosely enforced: frontend defines `interface StatsData` in `experimental/types.ts`

### TMDB Caching
- Disk-based: MD5 of endpoint + params → JSON file in `tmdb_cache/`
- Async file I/O via `aiofiles`
- Cache is unbounded (no LRU, no TTL, no size limit)

## Logging
- **Backend:** `logging.getLogger("letterboxd_wrapped.*")` with module-level loggers
- Format: `LEVEL    [name] message`
- Default level: INFO, configurable via `LOG_LEVEL` env
- **Frontend:** No structured logging — only `console.log` in dev mode

## Git Conventions
- Branch naming: `feat/`, `fix/`, `chore/` prefixes
- Commit messages: English, conventional commits
- `.env` files never committed
- `runs/` directory gitignored
