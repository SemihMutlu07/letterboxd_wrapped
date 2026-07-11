# Letterboxd Wrapped — Remaining Work (post-push, 2026-07-01)

Origin/main is at f95e4ae. Tracks 1-4 shipped and verified.
This doc replaces the 7-track plan — it was over-structured and mixed
shipped work, non-decisions, and unbuilt features into the same tracks.

Branch policy (per Codex note 2026-05-11): main is live, dev is integration,
feature/... for work. No "experiment" branch until there's something to
experiment with.

## 1. Repo hygiene — do first (15 min, zero risk)

Extract CONTRIBUTING.md from CLAUDE.md "Contribution workflow" section.
External contributors' AI tools read AGENTS.md/CONTRIBUTING.md, not CLAUDE.md.

Files: CLAUDE.md (source), new CONTRIBUTING.md (target)

## 2. Watchlist poster bug — diagnose before fixing

The error-forwarding plumbing shipped (Track 4a) but the actual poster
regression was never diagnosed. Real users may still see broken posters.

Two possible root causes:
  a) Scraper returns empty poster_url — selector drift in
     scraper.py:256-381 (_parse_grid_items). The selector tries
     data-poster-url, then img[data-src], then img[src]. If Letterboxd
     changed their grid markup, all three miss.
  b) Scraper returns a valid URL but the <img> fails in browser —
     CDN rejecting hotlinks. WatchlistCompare.tsx:100 already sets
     referrerPolicy="no-referrer" and has an onError that hides the img,
     but there's no fallback placeholder shown.

How to diagnose: run a live watchlist-compare, inspect /api/watchlist-compare
JSON. If poster_url is null/empty → (a). If populated but <img> fails → (b).

Fix for (a): update selectors in _parse_grid_items
Fix for (b): proxy watchlist posters through backend like TMDB images
            already do via /tmdb-proxy

## 3. Watchlist Tinder-swipe + most-watched sort — the one real feature

Backend (recommender.py):
  - public_film() at :30-36 currently strips to {title, year, slug, poster_url}
    — add popularity, vote_count, genres from TMDB enrichment
  - enrich_films() at :86-92 is a sequential for-loop capped at 20 films
    — switch to asyncio.gather + semaphore before raising the cap, or TMDB
    rate limits get hit linearly
  - TMDB enrichment exists in tmdb_client.py:328-330 but only wired into the
    single 30-film "tonight's pick" flow, not the full compare set

Frontend (WatchlistCompare.tsx):
  - Framer Motion drag/dragConstraints/onDragEnd — nothing in the codebase
    uses these yet (10 files use Framer Motion only for fade/scale/stagger)
  - Build as alternate view mode alongside existing accordion, not replacement
  - Sort control wired to new popularity field from backend
  - No automated drag-gesture test coverage exists — test in mobile viewport
    manually

Test accounts for verification: semihmutsuz (692 films), helincanpolat (795),
mertefesenturk (823), isilaykolik (usable via summary.details), barissaydam
(needs fresh run before usable)

## 4. Experiment infra — only if you build persona/roast/story

Don't build this until you have something to experiment with. If/when needed:

  - Branch experiment off current main (was desktop_server @ 104ffbf, now
    main is ahead)
  - Add getLatestAnalysisRunByUsername() read helper in analysis_runs.ts
    (currently write-only — startAnalysis/finishAnalysis exist, no read)
  - Dev-only /dev/load-run?u=<username> page: fetches summary.details from
    Supabase, seeds sessionStorage['letterboxdStats'], navigates to
    /results?u=<username> — reproduces full results with zero scraping
  - sessionStorage write happens at LetterboxdLanding.tsx:219,294
  - results/page.tsx reads sessionStorage['letterboxdStats'] exclusively

Features that would live here:
  - Persona/playlist: cinematic_persona already computed in persona.py:33,
    rendered only in Variant3ShareCard. Needs recommendation logic + UI.
  - Spotify-story: AnimatePresence mode="wait" animated sequence against
    full result. No backend streaming needed for Option A.
  - Roast: guilty-pleasures, genre-overindulgence callouts. New logic.

## Known issues NOT in the original plan (from CLAUDE.md)

  - WrappedBrutal orphan gap: FeedbackFab, ShareModal, PageViewTracker exist
    but are NOT imported by WrappedBrutal.jsx. Must be re-integrated into the
    neo-brutalist shell.
  - desktop_server branch: no upstream, 3 commits behind main. Needs reset
    + sync before next Windows worker deploy.
  - frontend/src/app/api/upload/route.ts returns 501 (intentional for static
    export, but should be documented for contributors)

## Verification commands

  cd frontend && npx tsc --noEmit
  cd frontend && npx vitest run
  cd backend && python -m pytest
