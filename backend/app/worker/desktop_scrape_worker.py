"""
Outbound desktop scrape worker.

Runs on the always-on home desktop (residential IP, no public exposure). It
polls the public backend for queued scrape jobs, runs the SAME local scrape +
analysis pipeline used by the synchronous route (app.services.scrape_pipeline),
and posts the final stats back. Public users keep using the normal site; the
heavy Letterboxd HTML scrape just executes here instead of on Render/ScraperAPI.

Run from the backend/ directory (so .env and runs/ resolve correctly):

    WORKER_BACKEND_URL=https://your-backend.example.com \
    WORKER_TOKEN=your-shared-secret \
    WORKER_SELF_TEST_ON_START=1 \
    python -m app.worker.desktop_scrape_worker

TMDB_API_KEY must also be set (via .env or env) — the analysis pipeline enriches
films through TMDB exactly as the server does.
"""
from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
from threading import Lock
from time import monotonic
from typing import Any

from dotenv import load_dotenv
load_dotenv()

import aiohttp

from app.config import settings
from app.services.scrape_pipeline import (
    ScrapeAnalysisEmpty,
    ScraperAPIError,
    scrape_and_analyze,
)
from app.services.scraper import scrape_watchlist, scrape_profile_sources

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(levelname)-8s [%(name)s] %(message)s",
)
logger = logging.getLogger("letterboxd_wrapped.desktop_worker")

POLL_INTERVAL = float(os.getenv("WORKER_POLL_INTERVAL", "5"))
HEARTBEAT_INTERVAL = float(os.getenv("WORKER_HEARTBEAT_INTERVAL", "20"))
# Short timeout for the small control-plane calls; the scrape itself is unbounded.
CONTROL_TIMEOUT = aiohttp.ClientTimeout(total=15)
TRACE_FLUSH_INTERVAL = float(os.getenv("WORKER_TRACE_FLUSH_INTERVAL", "5"))
WORKER_PROTOCOL_VERSION = 1
OUTBOX_DIR = Path(os.getenv("WORKER_OUTBOX_DIR", ".worker_outbox"))
PROCESS_STARTED_AT = datetime.now(timezone.utc).isoformat()


def _set_windows_wakelock(enable: bool) -> None:
    """Keep Windows from idle-sleeping while the worker runs.

    The desktop worker only earns its keep if the always-on machine stays awake
    to poll for jobs; ES_SYSTEM_REQUIRED blocks *automatic* idle sleep for the
    life of this process. No-op off Windows so the same code runs on the Fedora
    dev box and on Render.

    ponytail: idle-sleep only — a user/lid-forced sleep still sleeps; switch to a
    powercfg override if that ever becomes the problem.
    """
    if sys.platform != "win32":
        return
    import ctypes

    ES_CONTINUOUS = 0x80000000
    ES_SYSTEM_REQUIRED = 0x00000001
    flags = ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if enable else 0)
    try:
        ctypes.windll.kernel32.SetThreadExecutionState(flags)  # type: ignore[attr-defined]
        logger.info("Windows wakelock %s", "enabled" if enable else "released")
    except Exception as exc:  # noqa: BLE001 — wakelock is best-effort, never fatal
        logger.warning("Windows wakelock call failed: %s", exc)


class WorkerConfig:
    def __init__(self) -> None:
        self.base_url = (os.getenv("WORKER_BACKEND_URL") or "").rstrip("/")
        self.token = os.getenv("WORKER_TOKEN") or ""
        self.self_test_on_start = os.getenv("WORKER_SELF_TEST_ON_START", "").lower() in {"1", "true", "yes", "on"}
        self.self_test_username = (os.getenv("WORKER_SELF_TEST_USERNAME") or "semihmutsuz").strip().lower()

    @property
    def headers(self) -> dict:
        return {"X-Worker-Token": self.token}

    def validate(self) -> None:
        missing = [
            name for name, val in (("WORKER_BACKEND_URL", self.base_url), ("WORKER_TOKEN", self.token))
            if not val
        ]
        if missing:
            raise SystemExit(f"Missing required env: {', '.join(missing)}")
        if settings.scraper_api_key:
            raise SystemExit("SCRAPER_API_KEY must be unset for the direct-cloudscraper desktop worker")


def _git_value(*args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=Path(__file__).resolve().parents[3],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except Exception:
        return None
    value = result.stdout.strip()
    return value or None


def _worker_meta(cfg: WorkerConfig) -> dict[str, Any]:
    return {
        "worker_protocol_version": WORKER_PROTOCOL_VERSION,
        "worker_git_sha": os.getenv("WORKER_GIT_SHA") or _git_value("rev-parse", "--short", "HEAD"),
        "worker_branch": os.getenv("WORKER_BRANCH") or _git_value("branch", "--show-current"),
        "worker_started_at": PROCESS_STARTED_AT,
        "poll_interval": POLL_INTERVAL,
        "heartbeat_interval": HEARTBEAT_INTERVAL,
        "trace_flush_interval": TRACE_FLUSH_INTERVAL,
        "self_test_on_start": cfg.self_test_on_start,
        "self_test_username": cfg.self_test_username,
        "scrape_transport": "direct_cloudscraper",
    }


class TraceBuffer:
    def __init__(self) -> None:
        self.started = monotonic()
        self._events: list[dict[str, Any]] = []
        self._pending: list[dict[str, Any]] = []
        self._lock = Lock()
        self._stage_started: dict[str, float] = {}
        self._timings: dict[str, float] = {}

    def add(
        self,
        stage: str,
        message: str,
        metrics: dict[str, Any] | None = None,
        *,
        level: str = "info",
    ) -> None:
        elapsed = round(monotonic() - self.started, 1)
        metrics = dict(metrics or {})
        if stage.endswith("_started"):
            self._stage_started[stage.removesuffix("_started")] = elapsed
        if stage.endswith("_done"):
            key = stage.removesuffix("_done")
            started = self._stage_started.get(key)
            if started is not None:
                self._timings[f"{key}_seconds"] = round(elapsed - started, 1)
        for timing_key in ("scrape_seconds", "analysis_seconds", "postback_seconds"):
            if isinstance(metrics.get(timing_key), (int, float)):
                self._timings[timing_key] = round(float(metrics[timing_key]), 1)

        event = {
            "stage": stage,
            "message": message,
            "elapsed_seconds": elapsed,
            "level": level,
            "metrics": metrics,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._events.append(event)
            self._pending.append(event)

    def drain(self) -> list[dict[str, Any]]:
        with self._lock:
            events = list(self._pending)
            self._pending.clear()
            return events

    def snapshot(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._events)

    def timings(self) -> dict[str, float]:
        return dict(self._timings)


def _failure_message(username: str, exc: Exception) -> str:
    """Map a pipeline exception to a frontend-readable error string."""
    if isinstance(exc, ScrapeAnalysisEmpty):
        if exc.scraper_ok:
            return f"Scraped @{username} but the analysis came back empty. Please try again."
        return f"No public films found for @{username}. The profile may be private, empty, or blocked by Letterboxd."
    if isinstance(exc, ScraperAPIError):
        # Forward the specific scraper message (all ScraperAPIError strings are
        # hand-crafted + secret-free, e.g. "Too many people are using the scraper")
        # so the frontend can classify + log the real cause instead of a flat generic.
        return str(exc) or f"Scraper service error while reading @{username}. Please try again shortly."
    if isinstance(exc, ValueError):
        return str(exc)
    return f"Letterboxd returned an unexpected response for @{username}. Please try again later."


def _failure_telemetry(exc: Exception, duration_seconds: float) -> dict:
    """Classify failures enough for the admin dashboard and future fix loops."""
    if isinstance(exc, ScraperAPIError):
        error_stage = "scraper_api"
        error_code = "scraper_unavailable"
    elif isinstance(exc, ScrapeAnalysisEmpty):
        error_stage = "analysis_empty" if exc.scraper_ok else "scrape_empty"
        error_code = "analysis_failed" if exc.scraper_ok else "no_films"
    elif isinstance(exc, ValueError):
        error_stage = "letterboxd_or_scrape"
        error_code = "scrape_failed"
    else:
        error_stage = "pipeline_unexpected"
        error_code = "scrape_failed"

    return {
        "duration_seconds": duration_seconds,
        "error_type": type(exc).__name__,
        "error_stage": error_stage,
        "error_code": error_code,
    }


async def _heartbeat_loop(session: aiohttp.ClientSession, cfg: WorkerConfig) -> None:
    while True:
        try:
            async with session.post(f"{cfg.base_url}/api/worker/heartbeat", headers=cfg.headers, json=_worker_meta(cfg), timeout=CONTROL_TIMEOUT) as r:
                if r.status != 200:
                    logger.warning("Heartbeat rejected: HTTP %s", r.status)
        except Exception as exc:
            logger.warning("Heartbeat failed: %s", exc)
        await asyncio.sleep(HEARTBEAT_INTERVAL)


async def _report_lifecycle(session: aiohttp.ClientSession, cfg: WorkerConfig, event: str, payload: dict | None = None) -> None:
    await _post(session, cfg, f"/api/worker/{event}", payload or {})


async def _run_startup_self_test(session: aiohttp.ClientSession, cfg: WorkerConfig) -> None:
    username = cfg.self_test_username
    started = monotonic()
    logger.info("Running startup self-test for @%s", username)
    try:
        stats = await scrape_and_analyze(session, username)
    except Exception as exc:  # noqa: BLE001 - report the failed smoke test and continue polling jobs
        message = _failure_message(username, exc)
        await _post(
            session,
            cfg,
            "/api/worker/self-test",
            {
                "username": username,
                "ok": False,
                "message": message,
                "duration_seconds": round(monotonic() - started, 1),
            },
        )
        logger.warning("Startup self-test failed for @%s: %s", username, exc)
        return

    total_films = stats.get("total_films")
    await _post(
        session,
        cfg,
        "/api/worker/self-test",
        {
            "username": username,
            "ok": True,
            "message": "Startup scrape self-test passed.",
            "total_films": total_films,
            "duration_seconds": round(monotonic() - started, 1),
        },
    )
    logger.info("Startup self-test passed for @%s (films=%s)", username, total_films)


async def _claim_next_watchlist(session: aiohttp.ClientSession, cfg: WorkerConfig) -> dict | None:
    async with session.get(f"{cfg.base_url}/api/worker/watchlist/next", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
        if r.status != 200:
            logger.warning("Watchlist claim failed: HTTP %s", r.status)
            return None
        return (await r.json()).get("job")


async def _process_watchlist_job(session: aiohttp.ClientSession, cfg: WorkerConfig, job: dict) -> None:
    task_id = job["task_id"]
    job_type = job["job_type"]
    usernames = job["usernames"]
    first, second = usernames[0], usernames[1]
    logger.info("Processing watchlist job %s type=%s users=%s/%s", task_id, job_type, first, second)

    try:
        if job_type == "watchlist_compare":
            first_wl, second_wl = await asyncio.gather(
                scrape_watchlist(first, max_pages=40),
                scrape_watchlist(second, max_pages=40),
            )
            payload = {"first_watchlist": first_wl, "second_watchlist": second_wl}
        else:  # date_night
            first_src, second_src, first_wl, second_wl = await asyncio.gather(
                scrape_profile_sources(first, max_pages=25),
                scrape_profile_sources(second, max_pages=25),
                scrape_watchlist(first, max_pages=25),
                scrape_watchlist(second, max_pages=25),
            )
            payload = {
                "first_diary": first_src.diary,
                "first_grid": first_src.grid,
                "second_diary": second_src.diary,
                "second_grid": second_src.grid,
                "first_watchlist": first_wl,
                "second_watchlist": second_wl,
            }
    except Exception as exc:  # noqa: BLE001
        message = str(exc) if isinstance(exc, ValueError) else f"Scrape failed for {first}/{second}."
        logger.warning("Watchlist job %s failed: %s", task_id, exc)
        await _post(session, cfg, f"/api/worker/watchlist/{task_id}/failed", {"message": message})
        return

    ok = await _post(session, cfg, f"/api/worker/watchlist/{task_id}/complete", payload)
    if ok:
        logger.info("Watchlist job %s complete", task_id)


async def _claim_next(session: aiohttp.ClientSession, cfg: WorkerConfig) -> dict | None:
    async with session.get(f"{cfg.base_url}/api/worker/scrape/next", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
        if r.status == 409:
            body = await r.text()
            logger.warning("Claim blocked by backend: %s", body)
            return None
        if r.status != 200:
            logger.warning("Claim failed: HTTP %s", r.status)
            return None
        return (await r.json()).get("job")


def _outbox_path(task_id: str, kind: str) -> Path:
    safe_task = "".join(ch for ch in task_id if ch.isalnum() or ch in {"-", "_"}) or "unknown"
    return OUTBOX_DIR / f"{safe_task}-{kind}.json"


def _write_outbox(task_id: str, kind: str, path: str, payload: dict) -> Path:
    OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    outbox_path = _outbox_path(task_id, kind)
    outbox_path.write_text(json.dumps({"path": path, "payload": payload}, ensure_ascii=False, indent=2), encoding="utf-8")
    return outbox_path


async def _send_outbox_item(session: aiohttp.ClientSession, cfg: WorkerConfig, outbox_path: Path) -> bool:
    try:
        item = json.loads(outbox_path.read_text(encoding="utf-8"))
        path = item["path"]
        payload = item["payload"]
    except Exception as exc:
        logger.error("Outbox item %s is unreadable: %s", outbox_path, exc)
        return False
    ok = await _post(session, cfg, path, payload)
    if ok:
        with suppress(FileNotFoundError):
            outbox_path.unlink()
    return ok


async def _flush_outbox(session: aiohttp.ClientSession, cfg: WorkerConfig) -> None:
    if not OUTBOX_DIR.exists():
        return
    for outbox_path in sorted(OUTBOX_DIR.glob("*.json")):
        await _send_outbox_item(session, cfg, outbox_path)


async def _flush_trace(session: aiohttp.ClientSession, cfg: WorkerConfig, task_id: str, trace: TraceBuffer) -> None:
    events = trace.drain()
    if events:
        await _post(session, cfg, f"/api/worker/scrape/{task_id}/event", {"events": events})


async def _trace_flush_loop(session: aiohttp.ClientSession, cfg: WorkerConfig, task_id: str, trace: TraceBuffer) -> None:
    while True:
        await asyncio.sleep(TRACE_FLUSH_INTERVAL)
        await _flush_trace(session, cfg, task_id, trace)


async def _process_job(session: aiohttp.ClientSession, cfg: WorkerConfig, job: dict) -> None:
    task_id = job["task_id"]
    username = job["username"]
    started = monotonic()
    trace = TraceBuffer()
    trace.add(
        "worker_received",
        "Worker received scrape job",
        {"username": username, "scrape_transport": "direct_cloudscraper"},
    )
    trace_flush = asyncio.create_task(_trace_flush_loop(session, cfg, task_id, trace))
    logger.info("Processing scrape job %s for @%s", task_id, username)
    try:
        stats = await scrape_and_analyze(session, username, trace_callback=trace.add)
    except Exception as exc:  # noqa: BLE001 — any failure must report back, not crash the loop
        message = _failure_message(username, exc)
        duration_seconds = round(monotonic() - started, 1)
        telemetry = _failure_telemetry(exc, duration_seconds)
        telemetry["postback_seconds"] = 0.0
        telemetry.update(trace.timings())
        trace.add(telemetry["error_stage"], message, {"error_type": telemetry["error_type"]}, level="error")
        trace.add("postback_started", "Posting failure to backend")
        logger.warning("Scrape job %s for @%s failed: %s", task_id, username, exc)
        await _flush_trace(session, cfg, task_id, trace)
        trace_flush.cancel()
        with suppress(asyncio.CancelledError):
            await trace_flush
        payload = {"username": username, "message": message, "telemetry": telemetry, "trace_events": trace.snapshot()}
        outbox_path = _write_outbox(task_id, "failed", f"/api/worker/scrape/{task_id}/failed", payload)
        if await _send_outbox_item(session, cfg, outbox_path):
            logger.info("Failure postback acknowledged for job %s", task_id)
        return

    duration_seconds = round(monotonic() - started, 1)
    trace.add("postback_started", "Posting result to backend")
    telemetry = {"duration_seconds": duration_seconds, "postback_seconds": 0.0, **trace.timings()}
    await _flush_trace(session, cfg, task_id, trace)
    trace_flush.cancel()
    with suppress(asyncio.CancelledError):
        await trace_flush
    payload = {"username": username, "stats": stats, "telemetry": telemetry, "trace_events": trace.snapshot()}
    outbox_path = _write_outbox(task_id, "complete", f"/api/worker/scrape/{task_id}/complete", payload)
    if await _send_outbox_item(session, cfg, outbox_path):
        logger.info("Completion postback acknowledged for job %s", task_id)
    logger.info(
        "Completed scrape job %s for @%s (films=%s, duration=%ss)",
        task_id,
        username,
        stats.get("total_films"),
        duration_seconds,
    )


async def _post(session: aiohttp.ClientSession, cfg: WorkerConfig, path: str, payload: dict) -> bool:
    try:
        async with session.post(f"{cfg.base_url}{path}", headers=cfg.headers, json=payload, timeout=CONTROL_TIMEOUT) as r:
            if r.status != 200:
                logger.error("POST %s rejected: HTTP %s", path, r.status)
                return False
            return True
    except Exception as exc:
        logger.error("POST %s failed: %s", path, exc)
        return False


async def run() -> None:
    cfg = WorkerConfig()
    cfg.validate()
    _set_windows_wakelock(True)
    logger.info(
        "Desktop scrape worker starting — backend=%s poll=%ss transport=direct_cloudscraper",
        cfg.base_url,
        POLL_INTERVAL,
    )

    # Set process-wide default ThreadPoolExecutor limit to prevent connection spikes from concurrent scraping threads.
    # ponytail: limit thread count to 10 to keep concurrent scraping connections minimal.
    import concurrent.futures
    loop = asyncio.get_running_loop()
    loop.set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=10))

    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit=100, limit_per_host=20)
    ) as session:
        await _report_lifecycle(
            session,
            cfg,
            "startup",
            _worker_meta(cfg),
        )
        if cfg.self_test_on_start:
            await _run_startup_self_test(session, cfg)
        heartbeat = asyncio.create_task(_heartbeat_loop(session, cfg))
        try:
            while True:
                try:
                    job = await _claim_next(session, cfg)
                except Exception as exc:  # noqa: BLE001 — keep polling through transient backend errors
                    logger.warning("Poll error: %s", exc)
                    job = None

                if job is None:
                    # Also check for watchlist/date-night jobs
                    try:
                        wl_job = await _claim_next_watchlist(session, cfg)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("Watchlist poll error: %s", exc)
                        wl_job = None

                    if wl_job is not None:
                        await _flush_outbox(session, cfg)
                        await _process_watchlist_job(session, cfg, wl_job)
                        continue

                    await _flush_outbox(session, cfg)
                    await asyncio.sleep(POLL_INTERVAL)
                    continue

                # Process one job at a time (V1 — no concurrency).
                await _flush_outbox(session, cfg)
                await _process_job(session, cfg, job)
        finally:
            heartbeat.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat
            await _report_lifecycle(session, cfg, "shutdown", {"reason": "worker_stopped"})
            _set_windows_wakelock(False)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("Desktop scrape worker stopped.")
