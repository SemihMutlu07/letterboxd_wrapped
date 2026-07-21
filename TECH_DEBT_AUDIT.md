# Tech Debt Audit — letterboxd_wrapped (Movies Wrapped)
Generated: 2026-06-27
Scope: full repo (backend FastAPI + frontend Next.js static export). ~24k LOC of app code (excl. `tmdb_cache/`, `node_modules/`).

> ⚠️ **State caveat — read first.** This audit ran against a working tree with a **`git merge` in progress on `main`** (`.git/MERGE_HEAD` → `70364d2 fix(results): show real watched runtime`), with **3 unresolved conflicts**: `README.md`, `frontend/src/components/LetterboxdLanding.tsx`, `frontend/src/components/landing/LoadingScreen.tsx`. During the audit, the same two `test_worker.py` tests went **RED → GREEN** as the merge's staged files landed on disk (a transient `ImportError: cannot import name 'backend_git_sha' from 'app.config'` — old `config.py` against new `test_worker.py`). Findings that touch the three conflicted files are marked `[IN-MERGE]` and should be re-checked after the merge is resolved. This in-flight-merge-on-main is itself finding **F001**.

---

## Executive summary (ranked by impact)

1. **`main` is mid-merge with 3 unresolved conflicts (F001).** The repo is being integrated directly on `main`, not a feature branch — against the project's own git rules. Tests are non-deterministically RED/GREEN depending on how much of the merge has hit disk. This is the "unknown/half-done state" risk, live right now.
2. **~~Hardcoded admin password in source (F002).~~** ✅ Fixed — removed hardcoded default `mw3169305`. Auth now via `Authorization: Bearer` header (primary) with `?key=` fallback for GET nav. Env var `ADMIN_SECRET` mandatory (fail-closed). Secret rotated.
3. ~~**Maintainer-confirmed secret leak in git history (F003).**~~ **Downgraded 2026-07-21 — not reproducible.** A full scan of every blob across all refs found no actual `service_role` JWT anywhere in history; the `eyJ…`/`service_role` hits `git log -p` surfaces are false positives (an npm `package-lock.json` integrity hash + env-var-name text in docs/config). Old project is decommissioned regardless. See F003 row for the investigation detail — **no `git filter-repo` rewrite recommended** (28 branches + open PRs would be broken for a scrub of a key that doesn't appear to exist in history).
4. ~~**A single ~1,200-line function does all CSV analysis (F004).**~~ **Resolved 2026-07-21.** The file was actually 676 lines (not ~1,200) — it already delegated most computation to sibling modules (`ratings.py`, `geography.py`, `people.py`, `persona.py`). The remaining 5 pure inline blocks (data-quality coverage, rewatch champions, date/timeline analytics, cinema-scale inputs, rated/all-films dataset builders) were extracted into `viewing_habits.py` / `film_datasets.py` / `analysis_utils.compute_cinema_scale_inputs`, each with a new unit test file — previously the orchestrator function had **zero** test coverage, direct or indirect. `analysis.py` is now 443 lines.
5. **Two whole dead subsystems still shipped (F005, F006).** The RSS preview path (`rss_source.py`, `rss_preview.py`, `/api/rss-preview`, `api.ts:rssPreview`, plus `test_rss.py` + `landing-rss-flow.test.tsx`) is never invoked. Sentry existed twice (frontend `sentry.ts`, backend `main.py:_init_sentry`) — **both deleted in c2eae18 [F005 ✓, F006 ✓]**
6. **~50–100 MB of dead Python deps (F007).** `matplotlib` + `seaborn` (and their transitive chain: `fonttools`, `kiwisolver`, `contourpy`, `pillow`, `cycler`, `pyparsing`) are in `requirements.txt` but never imported. They bloat the Render image and install time.
7. **Documentation drift on env/CORS (F008).** `CLAUDE.md:34` documents `ALLOW_ALL_NETLIFY` for `*.netlify.app` CORS; `config.py` never reads it (it's set in `.env`/`.env.example`). CORS only allows two hardcoded Netlify hosts — any other preview/prod URL silently breaks.
8. **In-memory task state caps the backend at one process (F009).** `task_manager.py:40 _tasks: Dict = {}` is a module global. `/api/analyze` polling, worker queue, and progress all depend on it; a second uvicorn worker or a restart loses every in-flight job.
9. ~~**Dead stub/duplicate utility modules (F010–F012).**~~ **All three resolved.** `errorCapture.ts` and `session.ts` were deleted in `c2eae18` (confirmed zero importers); `/brutal` was deleted 2026-07-20.
10. ~~**Observability inconsistency (F013, F014).**~~ **Both resolved 2026-07-21.** `datetime.utcnow()` was already at 0 occurrences (fixed in an earlier, undocumented pass). `print()` had 5 remaining non-`main.py` sites (`task_manager.py`, `analysis.py` x2, `tmdb_client.py` x2) — all converted to `logger.info`/`logger.warning`; `backend/app/**/*.py` now has zero `print()` calls. (28 frontend `console.*` calls, F021, are a separate item and untouched.)

Severity tally at generation (2026-06-27): **3 Critical · 6 High · ~18 Medium · ~11 Low.** As of 2026-07-21: F001/F002/F005/F006/F007/F008/F012 resolved earlier; this pass additionally resolved F004, F010, F011, F013, F014, downgraded F003 (Critical → Low, not reproducible), and partially resolved F009 (desktop-worker jobs now persist; CSV-analyze jobs deliberately still don't). Remaining open Critical/High items: none — see per-row status above for what's left at Medium/Low.

---

## Architectural mental model (as it actually is)

Two deployables sharing a repo. **Frontend** is a Next.js 15 static export (`output: 'export'`) on Netlify — no SSR, all data fetched client-side from the backend. **Backend** is a FastAPI app (`create_app()` factory, lifespan-managed `aiohttp` session) intended for Render but described as local-only.

The real engine is a **three-stage scrape pipeline**: `routes/analyze.py` / `routes/worker.py` → `services/scrape_pipeline.py` → `services/scraper.py` (cloudscraper + BeautifulSoup, direct residential-IP fetch — ScraperAPI proxy removed 2026-07-02) → `services/analysis.py` (the giant pandas function) → `services/tmdb_client.py` enrichment. Because Letterboxd blocks datacenter IPs, profile scrapes are designed to be handed to an **outbound desktop worker** (`worker/desktop_scrape_worker.py`) that long-polls a job queue held in `task_manager.py`'s in-memory dict. That in-memory design is the load-bearing constraint the rest of the system is shaped around.

State lives in three places with three mechanisms: ephemeral `runs/*.json` files, a best-effort Supabase mirror (`supabase_ops.py`, ops tables, anon key only, errors swallowed by design), and PostHog for consent-gated behavioral analytics. The `admin.py` dashboard reads whichever of files/Supabase is available.

This model **matches** CLAUDE.md's description well — the backend is genuinely modular (routes/services/models split), and the documented CORS-inside-error-middleware ordering is real and deliberate. Where the docs diverge from reality is env vars (`ALLOW_ALL_NETLIFY`), the now-removed-from-docs-but-still-in-code RSS path, and the "not yet deployed" backend that clearly has run in production (Render-specific env handling, leaked prod key).

---

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|----------------|
| F001 | Process/State | `.git/MERGE_HEAD`; `LoadingScreen.tsx`, `LetterboxdLanding.tsx`, `README.md` | Critical | S | Merge of `70364d2` in progress **on `main`** with 3 unresolved conflicts; test state flips RED/GREEN as files land. Violates "branch first" rule in AGENTS.md. | Finish/abort the merge on a branch, resolve conflicts, run full suite, then fast-forward `main`. Don't audit-fix anything else until this settles. |
| ~~F002~~ | ~~Security~~ | ~~`backend/app/admin.py:28`~~ | ~~Critical~~ | ~~S~~ | ~~Hardcoded fallback admin secret `mw3169305` committed; auth via `?key=` query param (logged, referrer-leaked). Gates a dashboard of real user data.~~ | ~~✅ Fixed 2026-06-28 — removed default, lazy-load from env (fail-closed). Primary auth via `Authorization: Bearer` header; `?key=` retained for GET nav fallback. Rotated secret.~~ |
| ~~F003~~ | ~~Security~~ | ~~git history; `CLAUDE.md:55`~~ | ~~Critical~~ → **Low (downgraded)** | M | ~~`service_role` Supabase key leaked in git history (maintainer-confirmed); `eyJ…` JWTs present in `git log -p`.~~ **Investigated 2026-07-21, not reproducible:** scanned every blob across all local + fetched refs (`git rev-list --all --objects \| git cat-file --batch`) for a real JWT (`eyJhbGci...` 3-segment structure) — **zero matches**. The `-S 'service_role'`/`-S 'eyJ'` commit hits are false positives: the only `eyJ...`-prefixed string anywhere in history is `frontend/package-lock.json`'s npm `sha512` integrity hash, and every `service_role`/`SUPABASE_SERVICE_ROLE` hit is env-var-name documentation, never a value. No `.env` (vs `.env.example`) was ever committed on any branch; `.gitignore` correctly excludes it. | Old project is decommissioned per CLAUDE.md regardless, so this is not urgent even if a real key existed. **Do not run `git filter-repo`** — 28 remote branches + open PRs/dependabot branches would all break for a rewrite of history that doesn't appear to contain the secret. If further certainty is wanted, run `gitleaks`/`trufflehog` (or GitHub's server-side secret scanning, which also covers refs deleted from this clone) rather than rewriting. |
| ~~F004~~ | ~~Architectural decay~~ | ~~`backend/app/services/analysis.py:24`~~ | ~~High~~ → **Resolved** | L | ~~One async function spans 24→1204 (~1,180 LOC); only top-level def in the file. Nested helpers at 924/932/940/997. Untestable, high-churn.~~ **Resolved 2026-07-21.** Actual size was 676 lines, not ~1,200 (already delegating to `ratings.py`/`geography.py`/`people.py`/`persona.py`). Extracted the 5 remaining pure inline blocks: `compute_data_quality`/`build_film_datasets` → new `film_datasets.py`; `compute_rewatch_champions`/`compute_date_analytics` → new `viewing_habits.py`; `compute_cinema_scale_inputs` → `analysis_utils.py`. Each has a dedicated unit-test file (26 new tests) — the orchestrator function itself had zero prior coverage (API tests mock `_run_analysis` out entirely). `analysis.py` is now 443 lines, purely orchestration + async sections. | Done — extracted incrementally, no rewrite. Remaining async sections (TMDB matching, director/actor profile resolution) are intentionally left in the orchestrator; they're already thin wrappers around tested `people.py` functions. |
| ~~F005~~ | ~~Dead code~~ | ~~`services/rss_source.py`, `services/rss_preview.py`, `routes/analyze.py:240`, `lib/api.ts:283`, `test_rss.py`, `landing-rss-flow.test.tsx`~~ | ~~High~~ | ~~M~~ | ~~RSS preview subsystem never invoked — `rssPreview()` only appears in comments + a test asserting it's *not* called (`LetterboxdLanding.tsx:296`).~~ | ~~Deleted in c2eae18 — both services, the route, the client fn, and both tests removed. ~600+ LOC.~~ |
~~ F006 | Dead code | `frontend/src/lib/sentry.ts`, `backend/app/main.py:122` (`_init_sentry`) | High | S | **DONE — deleted in c2eae18.** Both Sentry integrations were no-ops: `@sentry/nextjs` not in `package.json`, `sentry-sdk` not in `requirements.txt`. Guarded imports always fell to the silent `except`. | Deleted. Both stubs removed. |
| ~~F007~~ | ~~Dependency debt~~ | ~~`backend/requirements.txt:33,50` (+ transitive 24–46)~~ | ~~High~~ | ~~S~~ | ✅ Resolved 2026-06-28 — matplotlib/seaborn/fonttools/kiwisolver/contourpy/pillow/cycler removed from `requirements.txt`. | |
| F008 | Doc/Config drift | `CLAUDE.md:34`; `backend/app/config.py:49`; `.env.example:5` | High | S | **FIXED** — Removed phantom `ALLOW_ALL_NETLIFY` env var from CLAUDE.md, README.md, and .env.example. Replaced with documented `FRONTEND_ORIGINS` which config.py already reads. No code change needed — the real CORS override knob was already wired. |
| F009 | Architecture/Scaling | `backend/app/task_manager.py` | High → **Partially resolved** | M | `_tasks`/`_last_worker_meta` are process-global dicts. Single-worker only; restart drops all in-flight jobs and worker queue. **Fixed 2026-07-20 for desktop-worker jobs**: scrape/watchlist/date-night/find-film tasks now write-through-persist to `ops_tasks` (migration `006_ops_tasks.sql`) and reload at startup (`task_manager.load_pending_tasks()`) — see CLAUDE.md Known Issues. CSV-upload ("analyze") tasks are deliberately still excluded (they read local disk files a restart also wipes; nothing to resume regardless). | Remaining: none required — the analyze-task exclusion is a considered design choice, not an oversight. |
| ~~F010~~ | ~~Dead code~~ | ~~`frontend/src/lib/session.ts`~~ | ~~Medium~~ → **Resolved** | S | ~~Entirely superseded by `session-id.ts`; `getSessionId` has zero importers (ts-prune confirms).~~ Confirmed deleted in `c2eae18`; zero references anywhere in `frontend/src`. | Done. |
| ~~F011~~ | ~~Dead code~~ | ~~`frontend/src/lib/errorCapture.ts`~~ | ~~Medium~~ → **Resolved** | S | ~~`initErrorCapture()` is an explicit no-op stub; flagged dead by ts-prune.~~ Confirmed deleted in `c2eae18`; zero references anywhere in `frontend/src`. | Done. |
| ~~F012~~ | ~~Duplicate code~~ | ~~`frontend/src/app/brutal/page.tsx` vs `app/results/page.tsx`~~ | ~~Medium~~ → **Resolved** | S | ~~Both render `<WrappedBrutal/>` — `/brutal` is a leftover dev route shipped to the static export.~~ Deleted 2026-07-20 — all 5 features already ported to `results/page.tsx`. | Done. |
| ~~F013~~ | ~~Observability~~ | ~~`backend/app/main.py:39,40,52,56,113`~~ | ~~Medium~~ → **Resolved** | S | ~~`print()` for startup/shutdown/banner despite a configured `logger`. Mixed with `print()` in 9 non-test sites across `app/`.~~ `main.py` was already clean (0 prints). 5 remaining sites converted 2026-07-21: `task_manager.py` (new module logger added), `analysis.py` x2, `tmdb_client.py` x2 (existing loggers). `grep -rn "print(" backend/app` now returns nothing. | Done. |
| ~~F014~~ | ~~Maintenance~~ | ~~`backend/app/task_manager.py` (+14 sites)~~ | ~~Medium~~ → **Resolved** | S | ~~15 `datetime.utcnow()` calls — deprecated on the Python 3.14 runtime in use (warnings flood the test run).~~ Verified 2026-07-21: 0 occurrences of `utcnow(` anywhere in `backend/app`. Already fixed in an earlier, undocumented pass. | Done — nothing to do. |
| F015 | Dependency debt | `backend/requirements.txt` | Medium | M | A `pip freeze` dump: 60 fully-pinned lines mixing direct deps (fastapi, pandas, cloudscraper) with transitive ones (h11, sniffio, yarl, attrs). No way to tell what's actually depended on; upgrades are landmines. | Split into direct deps (loose/compatible pins) + optional `requirements.lock`. Or adopt `pyproject.toml` + a lock tool. |
| F016 | Dead branch | `frontend/src/lib/errors.ts:177` | Medium | S | `if (/402\|429\|rate.?limit/...)` is unreachable — the `/429\|rate.?limit/` branch at :94 already returns. Only a bare `402` could reach, and the copy says "rate-limiting". | Drop `429\|rate.?limit` from the :177 regex (leave `402`), or remove the block. |
| F017 | Type/contract | `frontend/src/lib/api-schema.ts` (574 LOC, generated) | Medium | M | Large generated OpenAPI types exist, but `api.ts` parses responses by hand (`as`-shaped) rather than validating at the trust boundary. No runtime schema check on backend JSON. | Use the generated types as the source of truth in `api.ts`; add a lightweight runtime guard (or zod) on the analyze/scrape responses. |
| F018 | Consistency | `frontend/src/components/WrappedBrutal.jsx` | Medium | M | 852-LOC `.jsx` file — the **only** non-TS source in a TS frontend, and it's the actual results screen (`results/page.tsx` renders it). No type coverage on the highest-value component. | Rename to `.tsx` and type incrementally; at minimum add prop/stat types. |
| F019 | Consistency | `frontend/src/components/ShareCard.tsx` (421) + `share/variants/*` (3 files) + `WrappedBrutal` | Medium | M | Multiple parallel "render a share card" implementations with overlapping layout logic; `StatHeroShareCard` is being deleted in the in-flight merge, signalling churn here. | Consolidate variants behind one card primitive + a variant prop; delete superseded ones. |
| ~~F020~~ | ~~Test debt~~ | ~~`backend/tests/test_rss.py`, `frontend/.../landing-rss-flow.test.tsx`~~ | ~~Medium~~ | ~~S~~ | ~~Tests covering the dead RSS path (F005) — green tests for code nothing calls give false coverage confidence.~~ | ~~Deleted with F005 in c2eae18.~~ |
| F021 | Observability | frontend, 28 sites | Low | S | 28 `console.log/warn/error` in non-test `.ts/.tsx` (project rule: no `console.log` in prod). Many are legit `console.error` in catches; some are debug `log`. | Strip debug `console.log`; keep error logging behind the analytics/error layer. |
| F022 | Error handling | `backend/app`, 57 `except Exception` | Low | M | 57 broad catches. Most are the documented best-effort Supabase/ops mirrors (intentional — see "actually fine"), but a sweep would find a few that mask real bugs. | Spot-audit the non-ops ones; narrow exception types where the failure should surface. |
| F023 | Type debt | `frontend` 16 `any`/`as any`/ts-ignore | Low | S | Low overall; `(navigator as any).deviceMemory` is a legit browser-API gap. | Leave the browser-API casts; clean up any incidental `as any` in app logic. |
| F024 | Resource hygiene | `backend/app/tmdb_cache/` (100 MB local) | Low | S | Correctly gitignored, but grows unbounded on disk with no eviction. Fine locally; on Render's ephemeral FS it's wiped each deploy (cache cold-starts). | If cache hit-rate matters in prod, move to a TTL'd store; otherwise document it as throwaway. |
| F025 | Doc drift | `CLAUDE.md:14` ("backend … not yet deployed — local-only") | Low | S | Contradicted by Render-specific env handling (`RENDER_GIT_COMMIT`), the admin-persistence work, and the leaked prod key. The backend has clearly been deployed. | Update the deployment status line to match reality. |

---

## Top 5 — if you fix nothing else

**1. F001 — Get `main` out of its half-merged state.** This blocks trustworthy everything else.
```bash
git merge --abort                       # if the merge isn't wanted on main
# OR, to keep it:
git switch -c chore/integrate-runtime   # move the merge off main
git checkout --conflict=diff3 frontend/src/components/landing/LoadingScreen.tsx
# resolve the 3 conflicts, then:
cd backend && python -m pytest -q      # must be fully green
git switch main && git merge --ff-only chore/integrate-runtime
```

**2. ~~F002 — Fail closed on the admin secret, and stop using query-param auth.~~ ✅ Done.** Hardcoded default removed (fail-closed). Auth switched to `Authorization: Bearer` header (primary) with `?key=` fallback for GET nav. Secret rotated. See F002 row in findings for details.

**3. ~~F004 — Carve the analysis god function into testable pieces.~~ ✅ Done 2026-07-21.** Extracted incrementally, no rewrite:
```
analysis.py (orchestrator, 443 LOC)
  ├─ ratings.py          parse/clean ratings + deviation        (pre-existing)
  ├─ geography.py        country aggregation + map data         (pre-existing)
  ├─ people.py           director/cast resolve (the async bits) (pre-existing)
  ├─ persona.py          sinefil_meter + cinematic_persona      (pre-existing)
  ├─ film_datasets.py    data-quality coverage, rated/all-films  + test (new)
  ├─ viewing_habits.py   rewatch champions, date/timeline        + test (new)
  └─ analysis_utils.py   + compute_cinema_scale_inputs()         + test (new)
```
The `_clean_year`/`_clean_rating`/`_community_rating` closures moved to module-level helpers in `film_datasets.py`.

**4. F005 + F020 — RSS dead subsystem deleted. ✓** ~600 LOC of services/route/client/tests for RSS removed in c2eae18. Along with F006 (Sentry stubs, also c2eae18), this clears all "scaffolding for later" that never shipped.

**5. F007 + F015 — Cut dead deps and de-freeze `requirements.txt`.**
```diff
- matplotlib==3.10.3
- seaborn==0.13.2
- # (+ fonttools, kiwisolver, contourpy, cycler, pillow if nothing else needs them)
```
Then split direct deps from the transitive freeze so the next dependency bump isn't a guessing game.

---

## Quick wins (Low effort × Medium+ impact)

- [x] **F002** Remove hardcoded `mw3169305` default; rotate. — done 2026-06-28
- [x] **F007** Drop `matplotlib`/`seaborn` from `requirements.txt`.
- [x] **F010** Delete `lib/session.ts`. — confirmed already deleted in c2eae18
- [x] **F011** Delete `lib/errorCapture.ts`. — confirmed already deleted in c2eae18
- [x] **F012** Delete `app/brutal/` duplicate route. — done 2026-07-20 (WrappedBrutal.jsx removed; all 5 features already ported to `results/page.tsx`)
- [✓] **F006** Delete both dead Sentry stubs (or install one). — DONE in c2eae18
- [x] **F008** Reconcile `ALLOW_ALL_NETLIFY` doc vs code — done: removed phantom env var, replaced with documented `FRONTEND_ORIGINS`.
- [x] **F014** `utcnow()` → `now(datetime.UTC)` (15 sites, mechanical). — verified 0 occurrences 2026-07-21, already fixed in an earlier pass
- [ ] **F016** Remove unreachable `429` branch in `errors.ts:177`.
- [x] **F013** `print()` → `logger` in `main.py`. — main.py was already clean; 5 sites elsewhere converted 2026-07-21

---

## Things that look bad but are actually fine

- **`backend/app/tmdb_cache/` (100 MB, hundreds of JSON files).** Looked like a giant committed blob. It's correctly `.gitignore`d (`**/tmdb_cache/`) — 0 tracked. Local-only disk cache. Not debt (see F024 only for the prod-eviction nuance).
- **The custom `@app.middleware("http")` exception handler (`main.py:85`).** Reads like an anti-pattern vs. `@app.exception_handler(Exception)`. It's deliberate and load-bearing: it keeps 500s *inside* the CORS layer so `Access-Control-Allow-Origin` survives. CLAUDE.md documents why. Leave it.
- **57 `except Exception` in the backend.** Most are the Supabase/ops mirror writes that are *designed* to swallow errors so an analytics outage never breaks the request path (documented data-model contract). That's correct defensive design, not laziness — only the non-ops ones (F022) are worth a look.
- **`allow_credentials=True` with `allow_methods/headers=["*"]` (`main.py:67`).** Looks permissive, but `allow_origins` is an explicit allowlist (not `*`), so the wildcard methods/headers are safe. The app uses no cookies, so `allow_credentials` is merely unnecessary, not dangerous.
- **`DevDebugPanel.tsx` shipped in the bundle.** Looked like a debug panel leaking to prod. It self-gates: `if (process.env.NODE_ENV !== 'development') return null` (`:66`). Fine.
- **`ts-prune`/`depcheck` "unused" lists.** Most entries (Next.js page `default` exports, `metadata`, Tailwind/ESLint devDeps, `ThemeProvider`) are framework-convention imports the tools can't see. Only the cross-verified ones (`session.ts`, `errorCapture.ts`) are real — the rest are tool noise, not findings. (sentry.ts was real too, but was deleted in c2eae18.)

---

## Open questions for the maintainer

1. ~~**RSS path (F005):**~~ ✅ **Resolved — deleted in c2eae18.** The code was genuinely abandoned (nothing called it), never revived. Removed all ~600 LOC + 2 test files.
2. **Backend deployment (F025):** is the FastAPI backend live on Render now? The docs say local-only, but the code and the leaked key suggest otherwise. This changes the severity of F002/F003 from "future risk" to "active exposure."
3. **`worker_self_test_on_start` / `worker_self_test_username="semihmutsuz"` (`config.py:37-38`):** a personal username as a default in shipped config — intentional smoke-test convenience, or should it be unset by default?
4. **In-memory `task_manager` (F009):** is the backend pinned to a single uvicorn worker in prod? If it ever runs >1, the queue/progress model silently breaks. Worth confirming the deploy command.
5. **Three share-card systems (F019):** is the multi-variant share card an active A/B experiment (keep all) or settling toward one winner (consolidate)?
