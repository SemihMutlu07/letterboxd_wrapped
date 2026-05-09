# STACK.md — Technology Stack

> Mapping date: 2026-05-09
> Project: Letterboxd Wrapped (Movies Wrapped)

## Languages & Runtimes

| Layer | Language | Runtime | Version |
|-------|----------|---------|---------|
| Frontend | TypeScript 5 | Node.js | ^20 (Netlify build) |
| Backend | Python 3.14 | CPython + uvicorn | ~3.13+ (any modern 3.x) |
| Config | TOML, JSON, YAML | — | — |

## Frontend Framework

- **Next.js 15.4.2** — App Router, `output: 'export'` (static export to `out/`)
- **React 19.1.0** — Client components in `'use client'` throughout
- **React DOM 19.1.0**

**Build & Dev:**
- `next build` → static export
- `next dev --turbopack` for development
- TypeScript strict mode (`tsconfig.json` → `"strict": true`)
- Path alias: `@/*` → `./src/*`

### Key Frontend Dependencies

| Package | Purpose |
|---------|---------|
| `framer-motion` ^12.23.6 | Page/section entrance animations |
| `recharts` ^3.1.0 | Charts (genres, ratings, languages) |
| `react-simple-maps` ^3.0.0 | World map visualization (experimental) |
| `lucide-react` ^0.525.0 | Icon set |
| `canvas-confetti` ^1.9.3 | Celebratory confetti on share/download |
| `html-to-image` ^1.11.13 | Export share card as PNG |
| `posthog-js` ^1.260.3 | Product analytics (consent-gated) |
| `@supabase/supabase-js` ^2.56.0 | Client-side analytics DB insert |
| `jszip` ^3.10.1 | ZIP extraction in browser |

### Tailwind & Styling

- **TailwindCSS v4** (via `@tailwindcss/postcss`)
- Custom theme system via React Context: 3 themes (`current`, `vhs`, `classic-bw`)
- CSS variables driven by `ThemeProvider` wrapping results page
- Fonts: **Syne** (display/monospace headings) + **Manrope** (body text) via `next/font/google`
- Color palette: Slate-900 base → orange accent + purple secondary (current theme)

### Dev Dependencies

| Tool | Purpose |
|------|---------|
| `vitest` ^4.1.5 | Test runner |
| `@testing-library/react` ^16 | Component tests |
| `jsdom` ^29.1.1 | DOM environment for tests |
| `eslint` v9 + `eslint-config-next` | Linting |
| `ts-prune` ^0.10.3 | Dead-code detection |
| `depcheck` ^1.4.7 | Unused dependency detection |
| `concurrently` ^8.2.2 | Run frontend + backend together |

## Backend Framework

- **FastAPI** — async Python web framework via `uvicorn`
- **Pydantic v2** (pydantic-settings for config, pydantic models for request/response)

### Key Backend Dependencies

| Package | Purpose |
|---------|---------|
| `pandas` ^2.3.1 | CSV processing, data analysis |
| `numpy` ^2.3.1 | Numerical operations for cinema scale |
| `aiohttp` ^3.12.14 | Async HTTP for TMDB API calls |
| `aiofiles` ^24.1.0 | Async file I/O for TMDB cache |
| `beautifulsoup4` ^4.13.4 | Letterboxd HTML scraping |
| `lxml` ^5.4.0 | Fast HTML parser for BS4 |
| `cloudscraper` | Cloudflare bypass for scraping |
| `matplotlib` ^3.10.3 | (installed, not actively used in code) |
| `seaborn` ^0.13.2 | (installed, not actively used in code) |
| `Jinja2` ^3.1.6 | (installed, FastAPI dependency) |
| `python-multipart` ^0.0.20 | File uploads |
| `requests` ^2.32.4 | Fallback HTTP (scraper uses blocking `requests`) |

### Dev Dependencies (Backend)

| Package | Purpose |
|---------|---------|
| `pytest` | Test framework |
| `pytest-asyncio` | Async test support |
| `httpx` | ASGI test client via `ASGITransport` |

## Configuration

- `frontend/next.config.ts` — `output: 'export'`, image patterns, rewrites
- `netlify.toml` — build from `frontend/`, publish `out/`
- `backend/app/config.py` — `pydantic-settings` loading `.env`
- `backend/Dockerfile` — Container build (not deployed yet)
- `backend/pytest.ini` — pytest markers and asyncio mode

## CI / Deployment

- **Netlify** — static frontend export, no SSR
- **Render** — backend Dockerfile exists but not deployed (local-only)
- No CI config files found (no `.github/workflows/`)

## State Management

- **No external state library** — React hooks (`useState`, `useMemo`, `useCallback`, `useRef`)
- Theme context (`ThemeContext`) for visual theming
- `localStorage` for persisting analysis results between landing → results page
- `sessionStorage` for consent decisions and analytics session IDs
