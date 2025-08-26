# Performance Baseline (Phase 0)

This report captures the current state and a checklist to measure on your machine. No code changes here.

## App/Build Context
- Framework: Next.js 15.x (app router)
- Output: `export` with `dist` dir (static export)
- Images: Next/Image unoptimized=true; TMDB remote patterns allowed for `image.tmdb.org/t/p/**`
- React: 19.x

## Notable Dependencies (bundle-impacting)
- framer-motion (^12) — animations
- recharts (^3) — charts (not found in source imports; verify usage)
- chart.js + react-chartjs-2 — charts (import present for next/image only in results)
- jszip — used on landing for client-side zipping
- lucide-react — icons (used selectively)
- react-konva, fabric, html2canvas, html-to-image — image/canvas export utilities
- next-plausible — analytics

## Current Usage (quick scan)
- framer-motion: used in `src/components/LetterboxdLanding.tsx`, `src/app/results/page.tsx`, `src/app/loading/page.tsx`
- lucide-react: used in the same places
- next/image: used in `src/app/results/page.tsx`
- fetch: found in landing/results for backend progress and analysis
- TMDB: references present; requests likely via backend API (verify in backend)

## Network Notes
- Frontend calls API_URL root and `/api/analyze`, `/api/progress` (backend FastAPI). TMDB enrichment happens server-side; client should avoid duplicate polling.

## To Measure Locally (fill numbers below)
Run these on your machine to populate metrics. These need local environment/browser and cannot be measured here.

1) Build profile
- Command: `npm run build` (or `pnpm build`) then collect Next build output sizes.
- If you can, run `next build --profile` and (optionally) a bundle analyzer plugin.
- Record: main/app JS total, largest page chunks, any heavy libs identified.

2) Lighthouse (Mobile + Desktop)
- Open production build locally and run Lighthouse.
- Record: LCP, CLS, TBT, Total JS, first load JS (main+app), and notes.

3) React Profiler
- Profile key pages (landing and results) for typical interactions.
- Record: most re-rendered components, wasted renders, expensive commits.

4) Network (DevTools)
- Observe `/api/progress`, `/api/analyze` polling/requests.
- Note: duplicate calls, TMDB calls (if any client-side), caching headers.

## Findings (fill after measurement)
- Largest chunks:
- Heavy dependencies contributing to bundle:
- Lighthouse Desktop: LCP/CLS/TBT:
- Lighthouse Mobile: LCP/CLS/TBT:
- Total JS (initial):
- Most re-rendered components:
- Duplicate network calls / cache opportunities:

## Quick Wins Checklist (from spec)
- [ ] Disable console.* in prod
- [ ] Dynamic import: framer-motion, chart libs; wrap with Suspense
- [ ] Tree-shake lucide-react imports; remove unused icons
- [ ] Remove unused utils/components/styles
- [ ] Convert <img> to <Image> where safe; set sizes/priority
- [ ] Add localStorage TTL cache for TMDB name lookups (client-side, if any)
- [ ] Limit concurrent fetches to 5; defer via IntersectionObserver
- [ ] Retry once on fetch error; have quick fallback
- [ ] Memoize hot props; stable keys in lists
- [ ] Respect reduced motion; LazyMotion + domAnimation
- [ ] Reduce chart animation on mobile; cheap tooltip/legend
- [ ] AbortController on fetch; fewer awaits/try-catch
- [ ] Cache-Control on /api proxy responses (1–6h)
- [ ] Tailwind cleanup / dedupe

---
After you fill in the metrics above, we’ll proceed with Phase 1 (bundle/tree-shaking) in a separate PR.
