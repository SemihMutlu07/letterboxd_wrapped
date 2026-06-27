"""Background task that detects worker online/offline transitions and logs them.

Runs as a single asyncio.Task spawned in the FastAPI lifespan. Checks heartbeat
state every CHECK_INTERVAL_SECONDS. On a transition, writes one row to the
ops_worker_events Supabase table so the admin dashboard can show a timeline of
why the worker went offline and when it came back.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app import supabase_ops, task_manager
from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.worker_monitor")

CHECK_INTERVAL_SECONDS = 30


def log_worker_event(event_type: str, meta: dict[str, Any] | None = None) -> None:
    """Best-effort synchronous Supabase insert for a worker lifecycle event."""
    if not settings.supabase_enabled:
        return
    supabase_ops.insert("ops_worker_events", {
        "event_type": event_type,
        "meta": meta or {},
    })


async def _run_monitor() -> None:
    was_online: bool | None = None  # None = unknown at startup

    while True:
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
        try:
            now_online = task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds)

            if was_online is None:
                # First check — just record baseline, no transition yet
                was_online = now_online
                continue

            if was_online and not now_online:
                # Worker went offline
                status = task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)
                logger.warning("Worker heartbeat expired — worker is offline")
                log_worker_event("offline", {
                    "last_heartbeat": status.get("last_heartbeat"),
                    "seconds_since_heartbeat": status.get("seconds_since_heartbeat"),
                    "worker_git_sha": status.get("worker_git_sha"),
                    "worker_branch": status.get("worker_branch"),
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                })

            elif not was_online and now_online:
                # Worker came back online
                status = task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)
                logger.info("Worker heartbeat resumed — worker is back online")
                log_worker_event("online", {
                    "last_heartbeat": status.get("last_heartbeat"),
                    "worker_git_sha": status.get("worker_git_sha"),
                    "worker_branch": status.get("worker_branch"),
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                })

            was_online = now_online
        except Exception as exc:
            logger.debug("Worker monitor tick error (non-fatal): %s", exc)


async def start_worker_monitor() -> asyncio.Task:
    """Spawn the monitor loop as a background task. Call from FastAPI lifespan."""
    task = asyncio.create_task(_run_monitor(), name="worker_monitor")
    logger.info("Worker monitor started (interval=%ds)", CHECK_INTERVAL_SECONDS)
    return task
