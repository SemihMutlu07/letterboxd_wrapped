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
import logging
import os
from threading import Lock
from time import monotonic
from typing import Any

from dotenv import load_dotenv
load_dotenv()

import aiohttp

from app.services.scrape_pipeline import (
    ScrapeAnalysisEmpty,
    ScraperAPIError,
    scrape_and_analyze,
)

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
        return f"Scraper service error while reading @{username}. Please try again shortly."
    if isinstance(exc, ValueError):
        return str(exc)
    return f"Letterboxd returned an unexpected response for @{username}. Please try again later."


def _failure_telemetry(exc: Exception, duration_seconds: float) -> dict:
    """Classify failures enough for the admin dashboard and future fix loops."""
    if isinstance(exc, ScraperAPIError):
        error_stage = "scraper_api"
    elif isinstance(exc, ScrapeAnalysisEmpty):
        error_stage = "analysis_empty" if exc.scraper_ok else "scrape_empty"
    elif isinstance(exc, ValueError):
        error_stage = "letterboxd_or_scrape"
    else:
        error_stage = "pipeline_unexpected"

    return {
        "duration_seconds": duration_seconds,
        "error_type": type(exc).__name__,
        "error_stage": error_stage,
    }


async def _heartbeat_loop(session: aiohttp.ClientSession, cfg: WorkerConfig) -> None:
    while True:
        try:
            async with session.post(f"{cfg.base_url}/api/worker/heartbeat", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
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


async def _claim_next(session: aiohttp.ClientSession, cfg: WorkerConfig) -> dict | None:
    async with session.get(f"{cfg.base_url}/api/worker/scrape/next", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
        if r.status != 200:
            logger.warning("Claim failed: HTTP %s", r.status)
            return None
        return (await r.json()).get("job")


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
    trace.add("worker_received", "Worker received scrape job", {"username": username})
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
        await _post(
            session,
            cfg,
            f"/api/worker/scrape/{task_id}/failed",
            {"message": message, "telemetry": telemetry, "trace_events": trace.snapshot()},
        )
        return

    duration_seconds = round(monotonic() - started, 1)
    trace.add("postback_started", "Posting result to backend")
    telemetry = {"duration_seconds": duration_seconds, "postback_seconds": 0.0, **trace.timings()}
    await _flush_trace(session, cfg, task_id, trace)
    trace_flush.cancel()
    with suppress(asyncio.CancelledError):
        await trace_flush
    await _post(
        session,
        cfg,
        f"/api/worker/scrape/{task_id}/complete",
        {"stats": stats, "telemetry": telemetry, "trace_events": trace.snapshot()},
    )
    logger.info(
        "Completed scrape job %s for @%s (films=%s, duration=%ss)",
        task_id,
        username,
        stats.get("total_films"),
        duration_seconds,
    )


async def _post(session: aiohttp.ClientSession, cfg: WorkerConfig, path: str, payload: dict) -> None:
    try:
        async with session.post(f"{cfg.base_url}{path}", headers=cfg.headers, json=payload, timeout=CONTROL_TIMEOUT) as r:
            if r.status != 200:
                logger.error("POST %s rejected: HTTP %s", path, r.status)
    except Exception as exc:
        logger.error("POST %s failed: %s", path, exc)


async def run() -> None:
    cfg = WorkerConfig()
    cfg.validate()
    logger.info("Desktop scrape worker starting — backend=%s poll=%ss", cfg.base_url, POLL_INTERVAL)

    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit_per_host=20)) as session:
        await _report_lifecycle(
            session,
            cfg,
            "startup",
            {
                "poll_interval": POLL_INTERVAL,
                "heartbeat_interval": HEARTBEAT_INTERVAL,
                "self_test_on_start": cfg.self_test_on_start,
                "self_test_username": cfg.self_test_username,
            },
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
                    await asyncio.sleep(POLL_INTERVAL)
                    continue

                # Process one job at a time (V1 — no concurrency).
                await _process_job(session, cfg, job)
        finally:
            heartbeat.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat
            await _report_lifecycle(session, cfg, "shutdown", {"reason": "worker_stopped"})


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("Desktop scrape worker stopped.")
