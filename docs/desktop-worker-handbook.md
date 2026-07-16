# Desktop Scrape Worker — Handbook

> Durable reference so we **never re-derive** how the desktop server works.
> Branch of record: `feat/desktop-direct-scrape`. Paths relative to repo root.
> Last verified: 2026-06-26.

## 1. Mental model (read this first)

Public users hit the **Render-hosted FastAPI backend**. The heavy Letterboxd HTML
scrape does **not** run on Render (datacenter IPs get Cloudflare-blocked). Instead
an **always-on home desktop worker** (residential IP, no public exposure)
**polls the backend outbound** for queued jobs, scrapes, and posts results back.
(The old ScraperAPI proxy fallback was removed entirely on 2026-07-02.)

```
Browser ──HTTPS──> Render backend ──(job queue)──> [desktop polls outbound] ──> Letterboxd
                        ▲                                      │
                        └──────── postback (stats) ◀───────────┘
```

The desktop is **never exposed publicly**. It only makes outbound calls. The
shared secret `WORKER_TOKEN` (sent as `X-Worker-Token`) authenticates it.

Transport is **direct cloudscraper** — ScraperAPI was removed from the codebase
on 2026-07-02, so there is no proxy code path at all. A stale `SCRAPER_API_KEY`
in an old `.env` is inert; delete it.

## 2. End-to-end request lifecycle

Two modes, gated by `settings.desktop_worker_enabled` (= truthy `WORKER_TOKEN`,
`backend/app/config.py:40`).

**Desktop-worker mode (production):**
1. `POST /api/scrape-profile {username}` → `scrape_profile()` (`backend/app/routes/analyze.py:129`). Username sanitized to `^[a-z0-9_]+$`.
2. **Online gate:** `task_manager.is_worker_online(max_age)` (`analyze.py:162`). If the worker's last heartbeat is older than `worker_heartbeat_max_age_seconds` (default **60s**) → persist a failed run (`error_stage="desktop_worker_offline"`) and return **503** `{error_code:"desktop_worker_offline"}`.
3. **Queue:** `create_scrape_job(username)` mints a `TaskState(kind="scrape", status="pending", claimed=False)` keyed by UUID `task_id` (`task_manager.py:54`). Returns **202** `{task_id, status:"pending"}`.
4. **Frontend polls** `GET /api/progress/{task_id}` (`analyze.py:312`) → `{status, stage, message, result, error, *_seconds, trace_events}`. 404 if the task expired.
5. **Worker claims:** `GET /api/worker/scrape/next` → oldest `pending && !claimed`, flips to `claimed/running` (`task_manager.py:69`). Response `{job:{task_id, username}}` or `{job:null}`.
6. **Scrape + analyze:** worker runs `scrape_and_analyze(...)` — the **same** pipeline as the sync route (`backend/app/services/scrape_pipeline.py:53`). Scrapes diary+grid+overview(+reviews) concurrently, merges/dedups, runs `process_comprehensive_letterboxd_data`, TMDB-enriches.
7. **Live trace:** worker batches events, flushes every ~5s via `POST /api/worker/scrape/{task_id}/event` → appended to task `trace_events` → visible in the user's poll.
8. **Postback:** `POST /api/worker/scrape/{task_id}/complete {username, stats, telemetry, trace_events}` → `set_task_done` + `persist_run` (`backend/app/routes/worker.py:186`). Failure path: `.../failed`.
9. **User result:** next poll sees `status="done"`, `result={status:"success", stats}`.

**Sync fallback mode (local dev, no `WORKER_TOKEN`):** `/api/scrape-profile` runs
`scrape_and_analyze` inline and returns stats directly (no task_id).

## 3. Worker protocol & env vars

Loop (`desktop_scrape_worker.py:404`): validate env → Windows wakelock → ThreadPool(10)
→ one `aiohttp` session → `POST /api/worker/startup` → optional self-test →
heartbeat loop → poll `/scrape/next` every 5s, **one job at a time** → on exit
`POST /api/worker/shutdown`.

- **Heartbeat:** every 20s (`POST /api/worker/heartbeat`); online = age ≤ 60s ⇒ tolerates ~2 missed beats.
- **Version gate:** claim returns **409 worker_version_mismatch** if the worker's `worker_protocol_version` ≠ backend's (default 1). **Bump both sides together** when control-plane payloads change, or an online-but-stale worker gets 409'd off all jobs.
- **Auth:** every `/api/worker/*` needs `X-Worker-Token == WORKER_TOKEN` else 401.
- **Outbox:** before each complete/failed, the payload is written to `.worker_outbox/{task_id}-{kind}.json` and retried on every idle poll — protects a finished result if the backend is briefly down.

| Env var | Default | Purpose |
|---|---|---|
| `WORKER_BACKEND_URL` | — (required) | Backend base URL to poll |
| `WORKER_TOKEN` | — (required) | Shared secret → `X-Worker-Token` |
| `TMDB_API_KEY` | "" (required to work) | TMDB enrichment in analysis |
| `WORKER_SELF_TEST_ON_START` | **off** | Real scrape smoke test on boot — keep off (hits Letterboxd) |
| `WORKER_SELF_TEST_USERNAME` | `semihmutsuz` | Self-test target |
| `WORKER_POLL_INTERVAL` | 5s | Idle poll cadence |
| `WORKER_HEARTBEAT_INTERVAL` | 20s | Heartbeat cadence |
| `WORKER_TRACE_FLUSH_INTERVAL` | 5s | Live-trace flush |
| `WORKER_OUTBOX_DIR` | `.worker_outbox` | Failed-postback durability |
| `LETTERBOXD_PAGE_DELAY` | 0.25s | Per-page politeness delay |

Backend side (`config.py`): `worker_heartbeat_max_age_seconds=60`,
`worker_protocol_version=1`, `worker_self_test_on_start=False`.

## 4. Operating it (the practical bit)

- **Start:** from `backend/`, `python -m app.worker.desktop_scrape_worker` (reads `backend/.env`). On Windows use `backend/start-worker.bat` (drop a shortcut into `shell:startup` for auto-boot at login).
- **Stop:** Ctrl-C / close. Backend notices via heartbeat age within ~60s; new public requests then get a clean 503 telling users to upload their export.
- **After a code/env change:** the worker must be **restarted** — it does not hot-reload.
- **Invariants / do-nots:**
  - Run from `backend/` (so `.env`, `runs/`, `.worker_outbox/` resolve).
  - Never run two workers on the same `WORKER_TOKEN`.
  - Keep `WORKER_SELF_TEST_ON_START` off (it runs a real Letterboxd scrape).
  - Desktop `.env` must use the new `SUPABASE_URL` + `SUPABASE_ANON_KEY` only — **no** old `SUPABASE_SERVICE_ROLE`.

## 5. Failure & offline behavior

- **Worker offline at request time:** clean 503 + "upload your export" message; a failed run is logged. User is never left polling a job that can't run.
- **Worker dies AFTER a job is queued/claimed:** the backend requeues stale profile, watchlist, and date-night claims after 15 minutes, then fails any job still active after 30 minutes so public polling reaches a clean terminal state. Completed/failed jobs remain available for one hour before cleanup.
- **Orphan postback:** a complete/failed for a task the backend forgot (restart/cleanup) is still `persist_run`'d (`orphan:true`) for the dashboard, but the **public user never gets it** (their poll already 404'd).
- **Pipeline errors** map to readable messages; a single failure never crashes the poll loop. Scrape is resilient: only if **both** diary and grid fail does it raise; reviews/overview are best-effort.

## 6. Observability

- **Dashboard:** `GET /admin/dashboard?key=...` (auth `?key`/`x-admin-key` == `ADMIN_SECRET`). Shows runs + worker status + queue counts.
- **Worker status** (`task_manager.get_worker_status`, also `GET /admin/api/worker`): `online`, `heartbeat_age_seconds`, version match, last self-test, queue counts, `current_jobs[:10]` with per-stage timings, `recent_failures[:10]`.
- **Run history:** every complete/failed calls `persist_run` → local `runs/*.json` **and** best-effort mirror to Supabase `ops_runs` (heavy `stats` stripped, `trace_events` kept). On Render (ephemeral FS) the dashboard reads from Supabase so history survives restarts; per-run detail `/admin/run/{id}` reads Supabase by UUID.
- **Measure timings** (no code needed):
  ```bash
  curl -s "$BACKEND/admin/api/runs?key=$ADMIN_KEY&limit=20" \
  | jq -r '.runs[] | "\(.username) \(.total_films)f  scrape=\(.scrape_seconds)s analysis=\(.analysis_seconds)s bottleneck=\(.bottleneck_stage)(\(.bottleneck_seconds)s)"'
  ```

## 7. Production-readiness gaps (ranked) + target architecture

### Gaps (smallest fix each)
| Sev | Gap | Smallest fix |
|---|---|---|
| HIGH | In-memory queue + task state lost on Render restart (`_tasks` is a module dict) | Persist jobs + terminal results to Supabase; `/api/progress` falls back to Supabase on cache miss |
| HIGH | Single worker SPOF; **no job timeout/retry/requeue** — a claimed-then-lost job is stuck `running` until 1h cleanup → 404 | Stale-claim reaper in `cleanup_loop`: `running` + `claimed_at` older than N min → reset to `pending` (idempotent; postback keyed by task_id) |
| MED | `cleanup_loop` deletes `pending`/`running` jobs by age too | Only clean terminal (`done`/`failed`) tasks |
| MED | `ADMIN_SECRET` hardcoded default in source | Fail closed if `ADMIN_SECRET` unset; remove literal default |
| MED | Worker offline mid-job shows as silent 404, not `failed` | Surface "worker went offline" as `failed` so UI prompts upload fallback |

### The product decision (so we stop iterating)
The desktop exists only for **deep HTML history**. Two already-built, zero-block,
zero-cost paths cover most of the need and are currently underused:
- **CSV/ZIP export upload** (`/api/analyze`) — production-complete, exact lifetime stats, no scrape at all.

**Note:** The **RSS preview** subsystem (`/api/rss-preview`, `rss_source.py`) — which previously offered instant recent-sample Wrapped — was **removed in c2eae18** as dead code. It was never invoked in production (the UI hardcoded `method='scrape'`). If an instant-preview path is wanted in the future, it should be rebuilt from scratch, not resurrected.

**Recommended target ("production level") — tiered cascade, desktop demoted to an optimization:**
```
Username → (no RSS preview — removed) → Upload export (exact, $0, zero block)
                └─ optional background upgrade to full history:
                      └─ desktop worker if online (free, residential)
        → co-primary CTA: Upload export (exact, $0, zero block)
Cross-cutting: per-username result cache (TTL ~12h, in ops_runs) + persistent TMDB cache
```
**Do-first (all S-effort):** default `include_reviews=False` · per-username result cache + persistent TMDB cache.

> Note: paid-proxy fallbacks (ScraperAPI etc.) were considered and rejected — the
> decision on 2026-07-02 is desktop-worker-only, with export upload as the offline path.
