# 🎬 Movies Wrapped

**Your year in film — personalized Letterboxd statistics, visualized.**

Movies Wrapped takes your Letterboxd data (via CSV export or public profile URL) and generates a rich "wrapped"-style summary: top genres, directors, actors, viewing habits, cinema scale score, and shareable cards.

→ **Live site:** [movieswrapped.netlify.app](https://movieswrapped.netlify.app/)

---

## ✨ Features

- **Two input modes:**
  - **CSV upload** — export your data from Letterboxd settings → drag & drop the ZIP
  - **Username scrape** — enter a public Letterboxd username; we scrape diary, grid, reviews, and overview
- **Cinema Scale** — Shannon entropy across 6 axes (geography, temporal, languages, volume, genres, directors) → a single `sinefil_meter` score
- **Share Lab** — 20 share card templates across 4 categories (classic, letterboxd, meme, premium); export as PNG or 5-image ZIP pack
- **Experimental metrics** — Weekday vs Weekend, Director Concentration, and more (opt-in via `?mode=test`)
- **Watchlist analytics** — analyze any public Letterboxd watchlist
- **Test Lab** — preview new features before they go live (`/results?mode=test`)
- **TMDB enrichment** — poster images, cast photos, director bios linked to your stats

---

## 🏗 Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Next.js 15 SPA  │────▶│  FastAPI Backend │────▶│  Supabase (ops)  │
│  (Netlify static)│     │  (Render/desktop)│     │  run logs, RLS   │
└──────────────────┘     └────────┬────────┘     └──────────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │  Desktop Worker   │
                        │  (Windows —       │
                        │   direct scraping)│
                        └───────────────────┘
```

- **Frontend:** Next.js 15 (static export), React 19, TailwindCSS 4, Recharts, Framer Motion
- **Backend:** FastAPI, pandas/numpy, aiohttp, BeautifulSoup4 + lxml
- **Database:** Supabase (anon key only — run logs, user sessions, feedback)
- **Worker:** Local desktop process for direct Letterboxd scraping (avoids datacenter IP blocks)
- **Images:** TMDB proxy via backend

---

## 🚀 Quick Start (Local Dev)

```bash
# Clone
git clone https://github.com/SemihMutlu07/letterboxd_wrapped.git
cd letterboxd_wrapped

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # fill in TMDB_API_KEY
python -m app.main      # → http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev:frontend    # → http://localhost:3000
```

Or use the combined launcher:
```bash
cd frontend && npm run dev
```
(Starts both backend and frontend via `concurrently`.)

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | ✓ | The Movie Database API key |
| `ALLOW_ALL_NETLIFY` | | CORS allow `*.netlify.app` |
| `SUPABASE_URL` | | New Supabase project URL |
| `SUPABASE_ANON_KEY` | | Publishable anon key (never service_role) |
| `WORKER_TOKEN` | | Shared secret for desktop worker auth |
| `WORKER_BACKEND_URL` | | Backend URL worker polls for jobs |
| `SENTRY_DSN` | | Error tracking (optional) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | ✓ | Backend URL (local: `http://localhost:8000`, prod: `https://wrapped-backend.onrender.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Publishable anon key |
| `NEXT_PUBLIC_POSTHOG_KEY` | | PostHog analytics key |

---

## 🖥 Desktop Worker (Direct Scrape)

The backend's datacenter IP is often blocked by Letterboxd's bot detection. To work around this, a lightweight desktop worker runs on a home machine, polls the backend for scrape jobs, and scrapes Letterboxd directly from a residential IP.

**Setup guide:** [`docs/desktop-worker-setup.md`](docs/desktop-worker-setup.md)

The worker uses `cloudscraper` + `BeautifulSoup` for parsing and supports parallel diary/grid/reviews/overview scraping. It includes Windows wake-lock and rate-limiting.

---

## 🧪 Test Lab

Access the experimental feature preview at `/results?mode=test`. New metrics appear here before being promoted to the main results page.

Available experimentals:
- Weekday vs Weekend viewing patterns
- Director Concentration Index
- More coming

---

## 📦 Share Lab

20 share card templates across 4 categories:
- **Classic** — clean, Apple-style
- **Letterboxd** — film-strip aesthetic
- **Meme** — playful designs
- **Premium** — editorial look

Export as PNG (1200×630 landscape / 675×1200 portrait) or download a 5-image ZIP pack.

---

## 🗄 Supabase Tables

| Table | Purpose |
|---|---|
| `user_sessions` | Anonymous session tracking (consent-gated) |
| `feedback` | User feedback submissions (rate-limited) |
| `analysis_runs` | Run logs mirrored from backend (analysis, watchlist, date-night) — survives Render restarts |
| `ops_runs` / `ops_watchlist_runs` / `ops_date_night_runs` | Operational run history with RLS |

---

## 📜 License

MIT — see [LICENSE](LICENSE) (if any).

---

## 👤 Author

[Semih Mutlu](https://github.com/SemihMutlu07) — built as a personal project to explore film data visualization. Contributions and feedback welcome!