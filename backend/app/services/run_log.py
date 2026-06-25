from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.run_log")

RUNS_DIR = Path("runs")

# Bulky fields kept in the local file but stripped before mirroring to Supabase.
# trace_events is lightweight (list of small dicts) and needed by the admin dashboard.
_HEAVY_KEYS = ("stats",)


def _remote_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Trim bulky fields before mirroring; the dashboard list only needs scalars."""
    return {k: v for k, v in payload.items() if k not in _HEAVY_KEYS}


def _mirror_to_supabase(payload: dict[str, Any]) -> None:
    """Best-effort copy of the run log to Supabase ops_runs so the admin dashboard
    survives Render restarts (local runs/ is ephemeral there). No-op without env."""
    try:
        httpx.post(
            f"{settings.supabase_url}/rest/v1/ops_runs",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {settings.supabase_anon_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "username": payload.get("username"),
                "ok": payload.get("ok"),
                "total_films": payload.get("total_films"),
                "payload": _remote_payload(payload),
            },
            timeout=5.0,
        )
    except Exception as exc:
        logger.warning("Failed to mirror run to Supabase: %s", exc)

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
        stats = stats or {}
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
        # Durable mirror so the admin dashboard survives Render restarts. Offloaded
        # to a thread so the 5s network call never blocks the event loop.
        if settings.supabase_enabled:
            try:
                asyncio.get_running_loop().run_in_executor(None, _mirror_to_supabase, payload)
            except RuntimeError:
                _mirror_to_supabase(payload)
        return path
    except Exception as exc:
        logger.warning("Failed to persist run for %s: %s", username, exc)
        return None
