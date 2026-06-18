from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("letterboxd_wrapped.run_log")

RUNS_DIR = Path("runs")

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
        return path
    except Exception as exc:
        logger.warning("Failed to persist run for %s: %s", username, exc)
        return None
