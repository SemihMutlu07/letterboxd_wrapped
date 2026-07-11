# Letterboxd Wrapped — Consolidated UI/UX + Backend Roadmap

> **Verified by Claude against the codebase on 2026-07-01.** This is a carry-forward
> of a fully-researched, user-reviewed plan (all open design questions were already
> resolved with the user, and the Track 6 test-account data was live-verified against
> Supabase on 2026-06-30). Re-checked in a fresh session against ~25 file/line/function
> references cited below — all confirmed accurate except one path, corrected inline
> (see the note under Track 1b). **This document is planning only — no application
> code has been changed.** Execute tracks one at a time, each as its own PR, per the
> project's own "one PR = one scope" rule (see `CLAUDE.md` → Contribution workflow →
> "What went wrong before").

## Context

Large batch of feedback on the results page, share card, watchlist, admin dashboard,
and scraper error handling, plus three new feature ideas (genre-based persona/playlist,
"roast" system, Spotify-Wrapped-style progressive story UI) and an explicit request for
an `experiment` branch for fast local iteration. Baseline: `desktop_server` @
`104ffbf3b13b09293683c23b67800a117917cec4` (2026-06-30) — confirmed byte-identical to
the current working tree (`git diff --stat HEAD origin/desktop_server` is empty).

---

## Track 0 — Pre-flight diagnostics (run first, gates Track 4)

| # | Check | How |
|---|---|---|
| D1 | Is desktop-worker mode active in prod? | Check prod env for `WORKER_TOKEN`/`desktop_worker_enabled` (`backend/app/config.py:42`, gated in `backend/app/routes/analyze.py:154`). If off, the legacy synchronous ScraperAPI fallback path explains the literal "Too many people..." 429 string reaching users (`backend/app/services/scraper.py:100`). |
| D2 | Watchlist poster regression — backend or CDN? | Run a live watchlist-compare, inspect `/api/watchlist-compare` JSON: is `poster_url` null (scraper selector drift in `_parse_grid_items`, `scraper.py:256-381`) or populated-but-`<img>`-fails (CDN rejecting `referrerPolicy="no-referrer"`, `WatchlistCompare.tsx:93-102`)? |
| D3 | Reproduce "empty console" report | One confirmed bug already found: `frontend/src/components/LetterboxdLanding.tsx:173,186` — bare `catch {` swallows `zipFiles()` errors with zero `console.error`. Confirm if this is the actual case the user hit, or if another path is also silent. |

---

## Track 1 — Zero-risk CSS/prop fixes (ship first)

- **1a. Rating Patterns hover artifact** — `frontend/src/containers/results/FilmAndRatings.tsx:140-151`. Recharts `<Tooltip>` has no `cursor` prop, so the default `fill:'#ccc'` rectangle renders behind the hovered bar. Add `cursor={{ fill: '#1e293b', opacity: 0.35 }}`.
- **1b. Admin Analysis-tab polling mismatch** — `backend/app/templates/admin_dashboard.html:649,662` polls `/admin/api/runs` every 15s with no explicit limit (defaults to 50, `backend/app/admin.py:241`) while the initial page load used `limit=500` (`backend/app/admin.py:193`) — table visibly shrinks after 15s. Align both to one constant.
  > **Path note:** the admin module lives at `backend/app/admin.py`, registered directly in `main.py` (`from app import admin; app.include_router(admin.router)`) — it was never moved into the modular `routes/` package alongside `analyze`/`tmdb`/`feedback`. Use `backend/app/admin.py` everywhere below, not `backend/app/routes/admin.py`.
- **1c. Director/Cast avatar shape** *(image #12)* — `PersonCard` in `frontend/src/containers/results/experimental/sections/DirectorsGrid.tsx:224-332` uses `rounded-full` (avatar div at line 287). Change to a rounded-rect (`rounded-2xl`, keep `aspect-square` or move to `aspect-[3/4]`) for both Director and Cast cards (shared component).
- **1d. `errors.ts` dead-code flag** — `frontend/src/lib/errors.ts:108-125`'s regex match for "too many people..." is likely unreachable in worker-mode prod (message gets overwritten before reaching here, see Track 4b). Annotate, don't delete yet — depends on D1.

---

## Track 2 — Click-through interactions (frontend-only, existing data, no open design decisions)

- **2a. Rating bucket → modal.** Add `onClick` to `<Bar>` in `FilmAndRatings.tsx:151`, mirroring `LanguagesLeaderboard.tsx:47`'s `handleLanguageClick` pattern. Filter `stats.all_films` to the clicked rating bucket, sort by community/TMDB rating descending (highest-rated on top), reuse `RatingDeviation.tsx`'s delta-vs-user-rating display and `FilmModal.tsx` for the per-film detail.
- **2b. Languages → pie/donut chart.** Rewrite render body of `LanguagesLeaderboard.tsx` (keep `selectedFilms`/`handleLanguageClick`/`LangModal` wiring as-is) using Recharts `Pie`/`Cell`, with hover-scale or `activeShape` polish and the same dark tooltip theme as Track 1a. Redesign `LangModal.tsx` (122 lines total)'s poster list from a cramped vertical list to a grid, copying `PersonFilmsModal.tsx:90-122`'s `grid-cols-2 sm:grid-cols-3` pattern.
- **2c. Shared placeholder components.** New `PersonAvatarPlaceholder` + `PosterPlaceholder` (lucide-react already installed and used in `ShareCard.tsx` — zero new dependency), replacing 4 divergent fallbacks: `DirectorsGrid.tsx` `PersonCard` (initials), `RatingDeviation.tsx` `FilmPosterCard` (title text), `PersonFilmsModal.tsx` (no fallback at all on the header photo, plain text on posters), `LangModal.tsx` (empty box, no `onError` at all). Preserve each site's existing retry/onError logic — the placeholder is the rendered fallback state, not a replacement for the loading logic. Bundle with 1c since both touch `PersonCard`.
- **2d. Full, sortable reviews list.** Extend `ReviewAnalysisSection.tsx` beyond the existing word-filtered/top-3-liked views to a full list sortable by `like_count` (showing "Not yet liked" at 0) and by length, using `ra.reviews` (already shipped to the client, `ReviewAnalysisSection.tsx:41` — **no backend change**). **Explicit guardrail: do not add per-review `/likes/` page scraping** — `like_count` is already captured from the listing page's `data-count` attribute (`scraper.py:596-668`, a deliberate choice per the code's own docstring to avoid N-fold request multiplication against ScraperAPI quota/Cloudflare blocking).
- **2e. Time-spent stat → click-to-explain** *(image #11)*. `HeroStats.tsx:51-56` (the orange "X% of your time spent watching films" card) is the only stat box in that row without an `onClick` — the director/decade cards two rows down (`onClickDirector` ~line 57, `onClickDecade` ~line 68) already show the exact click+hover-scale pattern to copy. Formula lives in `page.tsx:319-335` (hours watched ÷ waking-hours-over-the-period, 16h/day if range >30 days else 24h/day, capped at 100%). Add a small, reusable `StatInfoPopover` (not a full modal — this is a one-paragraph explainer) with friendly copy, e.g.: *"We compared the hours you spent watching films to how many hours you're awake over [period]. That's how much of your year went to the screen."* No existing "explain this calculation" pattern exists anywhere else in the codebase — this becomes the first instance, designed to be reused for other stats later (ties into Track 3a).
- **2f. PersonFilmsModal visual elevation** *(image #5, "we can beat this design")*. Scoped to `PersonFilmsModal.tsx:61-87` (the header) only — independent of the 3c extraction-timing decision. Replace the plain photo+name+count header with a more cinematic treatment (e.g. a backdrop-blurred enlarged crop of the person photo behind a gradient-to-transparent overlay, name/count text over it), and refine the poster-grid hover states (scale/shadow on hover, consistent with the polish already going into 2b's `LangModal` grid redesign). Purely visual — no data/prop shape changes, so it doesn't conflict with or block 3c's "defer extraction" call.

---

## Track 3 — Design decisions (RESOLVED with user)

- **3a. Quick Facts "looks dead" → DECIDED: icons + motion now, defer bigger redesign.** `QuickFacts.tsx` (154 lines) gets lucide-react icons (already installed/used in `ShareCard.tsx`) + a framer-motion stagger-in matching `LanguagesLeaderboard.tsx:65-70`'s pattern. No new data plumbing. Clickable tiles / inline mini-charts explicitly deferred to a later pass — folds into Track 2 as a concrete, low-risk item.
- **3b. Share card bottom box → DECIDED: giant shareable stat callout.** Replaces the 4-poster "Favorite films" strip (`ShareCard.tsx:312-320`, sourced from `topFilms`/top-rated fallback) with a big-number treatment reusing the existing `GiantNumber` component (`ShareCard.tsx:43`). Natural content: hours watched + the existing `timePct` calc (`page.tsx:319-335`) reframed as a headline, e.g. "X hours of film — Y% of your year" — nice tie-in with 2e's new time-spent explainer, same underlying number, two surfaces. Must survive the `html-to-image` export pipeline (`ShareModal.tsx` `handleSavePNG`, fixed 1200×630/675×1200 canvas); no external images needed for this content so `shareSafeUrl()` plumbing isn't even a concern here.
- **3c. FilmGridModal extraction → DECIDED: defer.** Three hand-rolled "header + film grid" modals exist (`PersonFilmsModal.tsx`, `LangModal.tsx`, and `WrappedBrutal.jsx`'s `DecadeModal` on the separate, unconfirmed-maintenance `/brutal` route). Build 2a's new rating-bucket modal to the same prop shape (`open`, `onClose`, header content, `films: {title,year,poster_path,rating}[]`) so a future extraction stays mechanical, but don't extract now.
- **3d. Persona/playlist feature → DECIDED: experiment-branch only.** `cinematic_persona` already exists end-to-end: computed in `backend/app/services/persona.py:33` (`compute_cinematic_persona`) from top genre+decade+country (10 fixed combos + ~6 genre-fallback labels, e.g. "Adrenaline Junkie"), persisted to Supabase, but only rendered in one ShareCard export variant (`Variant3ShareCard.tsx`) today. No "recommend films based on persona/genre" logic exists anywhere yet (`recommender.py` only does two-person watchlist comparison) — this is genuinely new logic, built and iterated in `experiment` only, no production commitment this round.
- **3e. Spotify-story progressive loading → DECIDED: animated reveal first (Option A), in the experiment branch.** Backend computes all metrics in one synchronous pass today (`analysis.py`) — `/api/progress` never carries partial stats. Build the client-side animated story sequence first (`AnimatePresence mode="wait"`, not used anywhere yet but Framer Motion v12.23.6 already installed) against the full result we already get — zero backend risk. True incremental streaming (Option B: plumbing partial `stats` through `task_manager.py`'s `trace_events` channel) stays on the table as a follow-up, evaluated after A ships in `experiment`. **Both live in the experiment branch, not main/desktop_server, until proven.** Long-term native-app idea stays in Future Plans (out of scope this batch).
- **3f. "Roast" system → DECIDED: experiment-branch only.** Explicitly scoped by the user as experimental/iterative (guilty-pleasures, genre-overindulgence callouts). No production commitment this round.

---

## Track 4 — Diagnosed fixes (depends on Track 0)

- **4a. Watchlist images** — branches on D2: scraper selector fix (`scraper.py:256-381`) if `poster_url` comes back empty, or proxy watchlist posters through the backend (like TMDB images already do via `/tmdb-proxy`) if the CDN is rejecting hotlinks.
- **4b. Scraper error transparency** — fix the confirmed `LetterboxdLanding.tsx:173,186` bare-catch bug (bind the error, `console.error` with context); audit other `catch {}` blocks across watchlist components and worker-heartbeat polling (excluding intentionally-silent analytics catches, e.g. `LetterboxdLanding.tsx:207,234,283,308`); ensure `backend/app/worker/desktop_scrape_worker.py`'s `_failure_message()` (`:198-225`, which computes an `error_stage` locally at lines 214-220 but only returns a flat message string) forwards structured `error_stage`/`error_code` instead, so the frontend has something to log. Pair with D1/D3.
- **4c. Admin dashboard freshness (watchlist/date-night tabs)** — `admin_dashboard.html` has zero client-side refresh for these two tabs and the header summary counts (only Analysis tab polls today, `:649-662`). Add `/admin/api/watchlist-runs` + `/admin/api/date-night-runs` (reuse existing `_load_watchlist_runs_supabase()`/`_load_date_night_runs_supabase()`, `backend/app/admin.py:157-164`) and matching `setInterval` JS functions mirroring the existing pattern.

---

## Track 5 — Watchlist Tinder-swipe + most-watched sort (largest existing-scope item, ships last)

- **5a. Backend enrichment.** `public_film()` (`backend/app/services/recommender.py:30-36`) currently strips every compare-result film to `{title,year,slug,poster_url}`. TMDB `popularity`/`vote_count`/`genres` enrichment exists (`tmdb_client.py:328-330` and surrounding) but is only wired into the single 30-film-capped "tonight's pick" flow. Extend to the full compare set, but **must** switch `enrich_films()`'s current sequential `for film in list(films)[:limit]: await ...` loop (`recommender.py:86-92`) to `asyncio.gather` + a concurrency semaphore — naively raising the cap multiplies wall-clock time linearly and risks TMDB rate limits.
- **5b. Frontend swipe UI.** No new dependency needed — Framer Motion (already installed) supports `drag`/`dragConstraints`/`onDragEnd` natively; nothing in the codebase uses these yet (10 files use Framer Motion only for fade/scale/stagger). Build as an alternate view mode alongside the existing accordion (`WatchlistCompare.tsx`), not a hard replacement — sort control wired to the new `popularity` field from 5a.
- **Curated romcom/date-night list** — explicitly deferred per the user ("human curates, AI implements later"). Just leave the extension point (a static curated-list config keyed by TMDB id) noted, build nothing now.

---

## Track 6 — Experiment branch for fast local iteration

**Confirmed feasible with zero new infrastructure:**
- `results/page.tsx` gets `stats` exclusively from `sessionStorage['letterboxdStats']`, written once by `LetterboxdLanding.tsx:219,294` after a live scrape/upload — no existing mock/dev escape hatch.
- `backend/runs/*.json`'s `.stats` key is **byte-for-byte the same object** the frontend renders (confirmed: `routes/analyze.py` passes the same `stats` variable to both `task_manager.set_task_done(task_id, {"status": "success", "stats": stats})` and `persist_run(username, ..., stats, ...)`, for both the upload path and the scrape-profile path).
- `frontend/src/lib/supabase/analysis_runs.ts` is currently **write-only** — `startAnalysis`/`finishAnalysis` exist but no read helper. Needs one new function (e.g. `getLatestAnalysisRunByUsername()` doing `.select("summary").eq("username", u).eq("ok", true).order("finished_at", {ascending:false}).limit(1)`).
- Vitest (frontend, `"test": "vitest run"`) and pytest (backend, 14 existing test files) are both already wired — no new test framework needed.

**Test dataset — 5 real accounts (live-checked against Supabase `analysis_runs`, 2026-06-30):**

| Account | Status |
|---|---|
| `semihmutsuz` | ✓ latest successful run: 692 films, sinefil_meter 68 |
| `helincanpolat` | ✓ latest successful run: 795 films, sinefil_meter 66 |
| `mertefesenturk` | ✓ latest successful run: 823 films, sinefil_meter 67 |
| `isilaykolik` | ⚠️ row exists, `summary` JSONB is populated (usable), but the extracted `total_films`/`sinefil_meter` convenience columns are null — likely predates a migration or an extraction-step bug; use `summary.details` directly, don't rely on the extracted columns for this one |
| `barissaydam` | ✗ no row at all — needs one fresh run before it can be used |

**Plan:** branch `experiment` off `desktop_server` @ `104ffbf`. Add the `analysis_runs.ts` read helper above, plus a small dev-only loader (e.g. a `/dev/load-run?u=<username>` page) that fetches a given account's `summary.details` from Supabase, seeds `sessionStorage['letterboxdStats']`, and navigates straight to `/results?u=<username>` — reproducing the full results page with **zero live scraping**. Preview new designs (Tracks 1–5, and 3d/3e/3f experimental features) across all 5 real accounts side-by-side rather than a single fixture or A/B design variants — checks how each redesign actually holds up against different real data shapes (823 films vs 46, different genre/country spreads, etc.) before merging back. Only `barissaydam` needs a fresh run first; the other 4 are ready today.

---

## Track 7 — Repo hygiene

- **CONTRIBUTING.md.** Repo root has `README.md`, `CLAUDE.md`, `TECH_DEBT_AUDIT.md`, `SCRATCHPAD.md` — no `CONTRIBUTING.md`/`AGENTS.md`. `CLAUDE.md` already has a full "Contribution workflow" section (branch strategy, PR checklist, what-went-wrong-before notes) but external contributors' AI tools conventionally read `AGENTS.md`/`CONTRIBUTING.md`, not a Claude-specific file — recommend extracting that section into a new top-level file so it isn't missed.
- **Baseline commit.** Record `104ffbf3b13b09293683c23b67800a117917cec4` (2026-06-30) as the pre-batch baseline in memory before any Track 1–6 commits land.
- **Memory cleanup.** `project_beta-feedback-tracks-jun27.md` (stranded/unpushed commits, main RED on tests) reads as stale given today's clean `desktop_server` and the recent fix commits — needs supersession, not deletion, per the project's own memory-governance rules. Do this once this plan is approved and execution starts, not before.

---

## Verification plan

- **Track 1/2:** `cd frontend && npx tsc --noEmit && npx vitest run`; manual hover/click checks; broken-image (DevTools offline) check for placeholders.
- **Track 4:** `cd backend && python3 -m pytest`; live repro per Track 0 before/after; manual admin-dashboard poll check.
- **Track 5:** extend `backend/tests/test_review_metrics_and_watchlist.py` for `enrich_films` concurrency + `public_film` payload shape; manual mobile-viewport drag test (no automated drag-gesture coverage exists today).
- **Track 6:** manually confirm the dev-loader reproduces a known account's data pixel-identically against the real `/results` page for that same account.

## Critical files
`frontend/src/containers/results/FilmAndRatings.tsx`, `LanguagesLeaderboard.tsx`,
`frontend/src/containers/results/experimental/sections/{LangModal,PersonFilmsModal,DirectorsGrid,RatingDeviation}.tsx`,
`frontend/src/containers/results/HeroStats.tsx`, `frontend/src/components/ShareCard.tsx`,
`frontend/src/components/watchlist/WatchlistCompare.tsx`, `frontend/src/components/LetterboxdLanding.tsx`,
`backend/app/services/{recommender,persona,scraper,analysis,run_log}.py`,
`backend/app/admin.py`, `backend/app/templates/admin_dashboard.html`,
`frontend/src/lib/supabase/analysis_runs.ts`.
