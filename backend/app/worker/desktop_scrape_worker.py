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
    python -m app.worker.desktop_scrape_worker

TMDB_API_KEY must also be set (via .env or env) — the analysis pipeline enriches
films through TMDB exactly as the server does.
"""
from __future__ import annotations

import asyncio
import logging
import os

import aiohttp

from app.routes.analyze import _persist_run
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


class WorkerConfig:
    def __init__(self) -> None:
        self.base_url = (os.getenv("WORKER_BACKEND_URL") or "").rstrip("/")
        self.token = os.getenv("WORKER_TOKEN") or ""

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


async def _heartbeat_loop(session: aiohttp.ClientSession, cfg: WorkerConfig) -> None:
    while True:
        try:
            async with session.post(f"{cfg.base_url}/api/worker/heartbeat", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
                if r.status != 200:
                    logger.warning("Heartbeat rejected: HTTP %s", r.status)
        except Exception as exc:
            logger.warning("Heartbeat failed: %s", exc)
        await asyncio.sleep(HEARTBEAT_INTERVAL)


async def _claim_next(session: aiohttp.ClientSession, cfg: WorkerConfig) -> dict | None:
    async with session.get(f"{cfg.base_url}/api/worker/scrape/next", headers=cfg.headers, timeout=CONTROL_TIMEOUT) as r:
        if r.status != 200:
            logger.warning("Claim failed: HTTP %s", r.status)
            return None
        return (await r.json()).get("job")


async def _process_job(session: aiohttp.ClientSession, cfg: WorkerConfig, job: dict) -> None:
    task_id = job["task_id"]
    username = job["username"]
    logger.info("Processing scrape job %s for @%s", task_id, username)
    try:
        stats = await scrape_and_analyze(session, username)
    except Exception as exc:  # noqa: BLE001 — any failure must report back, not crash the loop
        message = _failure_message(username, exc)
        logger.warning("Scrape job %s for @%s failed: %s", task_id, username, exc)
        _persist_run(username, "desktop-worker", {}, ok=False, error_message=message)
        await _post(session, cfg, f"/api/worker/scrape/{task_id}/failed", {"message": message})
        return

    _persist_run(username, "desktop-worker", stats, ok=True)
    await _post(session, cfg, f"/api/worker/scrape/{task_id}/complete", {"stats": stats})
    logger.info("Completed scrape job %s for @%s (films=%s)", task_id, username, stats.get("total_films"))


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


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        logger.info("Desktop scrape worker stopped.")
