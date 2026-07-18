from __future__ import annotations

import copy
import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from app import supabase_ops
from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.run_log")

RUNS_DIR = Path("runs")

# Bulky fields kept in the local file but stripped before mirroring to Supabase.
# trace_events is lightweight (list of small dicts) and needed by the admin dashboard.
_HEAVY_KEYS = ("stats",)


async def cleanup_expired_runs() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, settings.run_retention_days))
    for directory in (RUNS_DIR, Path("watchlist_runs"), Path("date_night_runs")):
        if directory.exists():
            for path in directory.glob("*.json"):
                try:
                    if datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) < cutoff:
                        path.unlink()
                except OSError as exc:
                    logger.warning("Failed retention cleanup for %s: %s", path, exc)
    if settings.supabase_enabled:
        cutoff_iso = cutoff.isoformat()
        await asyncio.gather(*(supabase_ops.delete_before(table, cutoff_iso) for table in (
            "ops_runs", "ops_watchlist_runs", "ops_date_night_runs", "ops_worker_events"
        )))


def _remote_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Trim bulky fields before mirroring; the dashboard list only needs scalars."""
    return {k: v for k, v in payload.items() if k not in _HEAVY_KEYS}


async def _mirror_to_supabase(payload: dict[str, Any]) -> None:
    """Best-effort copy of the run log to Supabase ops_runs so the admin dashboard
    survives Render restarts (local runs/ is ephemeral there). No-op without env."""
    await supabase_ops.insert("ops_runs", {
        "username": payload.get("username"),
        "ok": payload.get("ok"),
        "total_films": payload.get("total_films"),
        "payload": _remote_payload(payload),
    })

TIMING_FIELDS = (
    "duration_seconds",
    "queue_wait_seconds",
    "worker_seconds",
    "scrape_seconds",
    "analysis_seconds",
    "postback_seconds",
)


def _safe_username(username: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9_-]", "_", (username or "anon").lower()) or "anon"


def _redact_third_party_likers(stats: dict[str, Any]) -> dict[str, Any]:
    """Remove third-party identities from durable logs, retaining aggregates."""
    redacted = copy.deepcopy(stats)
    analysis = redacted.get("review_analysis")
    if not isinstance(analysis, dict):
        return redacted
    for key in ("reviews", "top_liked_reviews", "socially_active_reviews"):
        for review in analysis.get(key, []) or []:
            if isinstance(review, dict):
                review.pop("likers", None)
                review.pop("liked_by", None)
    analysis.pop("top_recurring_likers", None)
    return redacted


def persist_run(
    username: Optional[str],
    source: str,
    stats: Optional[dict[str, Any]],
    ok: bool = True,
    error_message: Optional[str] = None,
    *,
    duration_seconds: Optional[float] = None,
    queue_wait_seconds: Optional[float] = None,
    worker_seconds: Optional[float] = None,
    scrape_seconds: Optional[float] = None,
    analysis_seconds: Optional[float] = None,
    postback_seconds: Optional[float] = None,
    error_type: Optional[str] = None,
    error_stage: Optional[str] = None,
    task_id: Optional[str] = None,
    trace_events: Optional[list[dict[str, Any]]] = None,
    telemetry: Optional[dict[str, Any]] = None,
) -> Optional[Path]:
    """Best-effort run log under runs/{username}-{iso-ts}-{task}.json."""
    try:
        stats = _redact_third_party_likers(stats or {})
        telemetry = telemetry or {}
        RUNS_DIR.mkdir(parents=True, exist_ok=True)

        safe_user = _safe_username(username)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        suffix = (task_id or str(uuid.uuid4()))[:8]
        path = RUNS_DIR / f"{safe_user}-{ts}-{suffix}.json"

        payload: dict[str, Any] = {
            "task_id": task_id,
            "username": username,
            "source": source,
            "timestamp": ts,
            "ok": ok,
            "error_message": error_message,
            "error_type": error_type,
            "error_stage": error_stage,
            "total_films": stats.get("total_films"),
            "sinefil_meter": stats.get("sinefil_meter"),
            "stats": stats,
            "trace_events": trace_events or [],
        }
        explicit_timings = {
            "duration_seconds": duration_seconds,
            "queue_wait_seconds": queue_wait_seconds,
            "worker_seconds": worker_seconds,
            "scrape_seconds": scrape_seconds,
            "analysis_seconds": analysis_seconds,
            "postback_seconds": postback_seconds,
        }
        for field in TIMING_FIELDS:
            value = explicit_timings.get(field)
            payload[field] = telemetry.get(field, value)

        if not payload.get("error_type"):
            payload["error_type"] = telemetry.get("error_type")
        if not payload.get("error_stage"):
            payload["error_stage"] = telemetry.get("error_stage")

        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(
            "Persisted run: %s (source=%s, ok=%s, films=%s)",
            path,
            source,
            ok,
            payload["total_films"],
        )
        # Durable mirror so the admin dashboard survives Render restarts. Fired
        # off in the background so the network call never blocks the caller.
        if settings.supabase_enabled:
            supabase_ops.fire_and_forget(_mirror_to_supabase(payload))
        return path
    except Exception as exc:
        logger.warning("Failed to persist run for %s: %s", username, exc)
        return None
