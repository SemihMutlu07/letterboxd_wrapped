from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app import supabase_ops, task_manager
from app.config import settings
from app.models.recommend import UserPairRequest
from app.routes.watchlist import (
    _check_rate_limit,
    _client_key,
    _rate_limit_exception,
    _validate_username,
    _worker_paused_exception,
)
from app.services import dashboard_settings

logger = logging.getLogger("letterboxd_wrapped.recommend")

router = APIRouter()

DATE_NIGHT_RUNS_DIR = Path("date_night_runs")


async def _mirror_date_night_to_supabase(payload: dict[str, Any]) -> None:
    """Best-effort mirror of date night recommendation run to Supabase."""
    await supabase_ops.insert("ops_date_night_runs", {
        "usernames": payload.get("usernames"),
        "ok": payload.get("ok"),
        "payload": payload,
    })


def _persist_date_night_run(
    usernames: list[str],
    mutual_profile: dict | None,
    recommendations: list,
    request: Request,
    ok: bool = True,
    error_message: str | None = None,
) -> None:
    """Best-effort log of a date-night request."""
    try:
        DATE_NIGHT_RUNS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        safe = "_".join(usernames)
        path = DATE_NIGHT_RUNS_DIR / f"{safe}-{ts}.json"
        payload = {
            "usernames": usernames,
            "timestamp": ts,
            "ok": ok,
            "error_message": error_message,
            "mutual_profile": {
                "top_genres": mutual_profile.get("top_genres") if mutual_profile else [],
                "top_directors": mutual_profile.get("top_directors") if mutual_profile else [],
                "era_overlap": mutual_profile.get("era_overlap") if mutual_profile else None,
            },
            "recommendations": [r.get("title") for r in recommendations[:3]] if recommendations else [],
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if settings.supabase_enabled:
            supabase_ops.fire_and_forget(_mirror_date_night_to_supabase(payload))
    except Exception as exc:
        logger.warning("Failed to persist date night run: %s", exc)


@router.post("/api/date-night", response_model=None)
async def date_night(request: Request, payload: UserPairRequest):
    if not _check_rate_limit(_client_key(request)):
        raise _rate_limit_exception()

    first = _validate_username(payload.usernames[0])
    second = _validate_username(payload.usernames[1])

    if first == second:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "same_username", "message": "Enter two different Letterboxd usernames."},
        )

    await dashboard_settings.load_worker_control_state()
    if task_manager.is_worker_paused():
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="worker_paused")
        raise _worker_paused_exception()

    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="worker_offline")
        raise HTTPException(
            status_code=503,
            detail={"error_code": "worker_offline", "message": "The desktop scraper is currently offline. Please try again later."},
        )

    try:
        task_id = task_manager.create_date_night_job([first, second], owner_key=_client_key(request))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"error_code": "queue_full", "message": "Worker queue is full."}) from exc
    task = task_manager.get_task_state(task_id)
    return JSONResponse(status_code=202, content={"task_id": task_id, "status": "pending", "poll_token": task.poll_token})
