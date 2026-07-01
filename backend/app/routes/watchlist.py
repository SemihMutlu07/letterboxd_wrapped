from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app import supabase_ops, task_manager
from app.models.recommend import RecommendFromCompareRequest, RecommendFromCompareResponse
from app.services.recommender import (
    compare_watchlist_sets,
    enrich_films,
    enrich_films_concurrent,
    pick_from_common,
    public_film,
    recommendation_from_film,
)
from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.watchlist")

router = APIRouter()

USERNAME_RE = re.compile(r"^[a-z0-9_]+$")

WATCHLIST_RUNS_DIR = Path("watchlist_runs")


async def _await_worker_job(task_id: str, max_seconds: int) -> tuple[str, Any]:
    """Poll a worker job to a terminal state.

    Returns ('done', result_dict) | ('failed', error_message) | ('timeout', None).
    Shared by all three worker-routed endpoints so they stay consistent — a task
    vanishing (purged by cleanup_loop) is treated as a timeout, not a success.
    """
    for _ in range(max_seconds):
        await asyncio.sleep(1)
        task = task_manager.get_task_state(task_id)
        if task is None:
            return ("timeout", None)
        if task.status == "done":
            return ("done", task.result or {})
        if task.status == "failed":
            return ("failed", task.error)
    return ("timeout", None)


def _worker_failure_exception(error_message: str | None) -> HTTPException:
    """Map a worker scrape failure message back to the original HTTP semantics.

    The worker forwards the raw scraper exception text; preserve the 404/503
    distinction (and clean user-facing messages) the direct-scrape path used to
    return, instead of collapsing everything into a generic 503.
    """
    msg = error_message or ""
    if "Letterboxd is blocking" in msg or "blocking" in msg.lower():
        return HTTPException(status_code=503, detail={"error_code": "scrape_blocked", "message": msg})
    if "not found" in msg.lower():
        return HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": "One of those Letterboxd users could not be found."},
        )
    return HTTPException(
        status_code=503,
        detail={"error_code": "scraper_unavailable", "message": msg or "Worker failed to scrape Letterboxd."},
    )


def _worker_paused_exception() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "error_code": "desktop_worker_paused",
            "message": "The desktop scraper is paused for maintenance. Please try again shortly.",
        },
    )


def _mirror_watchlist_to_supabase(payload: dict[str, Any]) -> None:
    """Best-effort mirror of watchlist comparison run to Supabase."""
    supabase_ops.insert("ops_watchlist_runs", {
        "usernames": payload.get("usernames"),
        "ok": payload.get("ok"),
        "match_score": payload.get("match_score"),
        "payload": payload,
    })


def _persist_watchlist_run(
    usernames: list[str],
    comparison: dict,
    request: Request,
    ok: bool = True,
    error_message: str | None = None,
) -> None:
    """Best-effort log of a watchlist comparison."""
    try:
        WATCHLIST_RUNS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        safe = "_".join(usernames)
        path = WATCHLIST_RUNS_DIR / f"{safe}-{ts}.json"
        payload = {
            "usernames": usernames,
            "timestamp": ts,
            "ok": ok,
            "error_message": error_message,
            "match_score": comparison.get("match_score") if comparison else None,
            "counts": comparison.get("counts") if comparison else None,
            "common_films": (comparison.get("common") or [])[:10] if comparison else [],
            "device": {
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            },
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        if settings.supabase_enabled:
            try:
                asyncio.get_running_loop().run_in_executor(None, _mirror_watchlist_to_supabase, payload)
            except RuntimeError:
                _mirror_watchlist_to_supabase(payload)
    except Exception as exc:
        logger.warning("Failed to persist watchlist run: %s", exc)

_RATE_LIMIT_WINDOW = 600  # 10 minutes
_RATE_LIMIT_MAX = 10
_rate_limiter: dict[str, list[float]] = {}


def _client_key(request: Request) -> str:
    xfwd = request.headers.get("x-forwarded-for")
    if xfwd:
        return xfwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(client_key: str) -> bool:
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    events = [t for t in _rate_limiter.get(client_key, []) if t >= cutoff]
    if len(events) >= _RATE_LIMIT_MAX:
        return False
    events.append(now)
    _rate_limiter[client_key] = events
    return True


def _rate_limit_exception() -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "error_code": "watchlist_lab_rate_limited",
            "message": "Too many watchlist lab requests. Wait a few minutes, then try again.",
        },
    )


class WatchlistCompareRequest(BaseModel):
    usernames: list[str] = Field(..., min_length=2, max_length=2)


def _normalize_username(username: str) -> str:
    return username.strip().removeprefix("@").lower()


def _validate_username(username: str) -> str:
    normalized = _normalize_username(username)
    if not normalized or not USERNAME_RE.match(normalized):
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_username", "message": "Please enter two valid Letterboxd usernames."},
        )
    return normalized


@router.post("/api/watchlist-compare")
async def compare_watchlists(request: Request, payload: WatchlistCompareRequest):
    if not _check_rate_limit(_client_key(request)):
        raise _rate_limit_exception()

    first = _validate_username(payload.usernames[0])
    second = _validate_username(payload.usernames[1])

    if first == second:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "same_username", "message": "Enter two different Letterboxd usernames."},
        )

    if task_manager.is_worker_paused():
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_paused")
        raise _worker_paused_exception()

    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_offline")
        raise HTTPException(
            status_code=503,
            detail={"error_code": "worker_offline", "message": "The desktop scraper is currently offline. Please try again later."},
        )

    task_id = task_manager.create_watchlist_compare_job([first, second])
    outcome, data = await _await_worker_job(task_id, 120)

    if outcome == "failed":
        _persist_watchlist_run([first, second], None, request, ok=False, error_message=data)
        raise _worker_failure_exception(data)
    if outcome == "timeout":
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_timeout")
        raise HTTPException(
            status_code=504,
            detail={"error_code": "scrape_timeout", "message": "Desktop worker took too long. Try again later."},
        )

    comparison = compare_watchlist_sets(data.get("first_watchlist", []), data.get("second_watchlist", []))
    _persist_watchlist_run([first, second], comparison, request, ok=True)
    return {"status": "success", "users": [first, second], **comparison}


@router.post("/api/recommend-from-compare", response_model=RecommendFromCompareResponse)
async def recommend_from_compare(request: Request, payload: RecommendFromCompareRequest):
    if not _check_rate_limit(_client_key(request)):
        raise _rate_limit_exception()

    first = _validate_username(payload.usernames[0])
    second = _validate_username(payload.usernames[1])

    if first == second:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "same_username", "message": "Enter two different Letterboxd usernames."},
        )

    if task_manager.is_worker_paused():
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_paused")
        raise _worker_paused_exception()

    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_offline")
        raise HTTPException(
            status_code=503,
            detail={"error_code": "worker_offline", "message": "The desktop scraper is currently offline. Please try again later."},
        )

    task_id = task_manager.create_watchlist_compare_job([first, second])
    outcome, data = await _await_worker_job(task_id, 120)

    if outcome == "failed":
        _persist_watchlist_run([first, second], None, request, ok=False, error_message=data)
        raise _worker_failure_exception(data)
    if outcome == "timeout":
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="worker_timeout")
        raise HTTPException(
            status_code=504,
            detail={"error_code": "scrape_timeout", "message": "Desktop worker took too long. Try again later."},
        )

    common = compare_watchlist_sets(data.get("first_watchlist", []), data.get("second_watchlist", []))["common"]
    if not common:
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="no_common_watchlist")
        raise HTTPException(
            status_code=404,
            detail={"error_code": "no_common_watchlist", "message": "Those watchlists do not overlap yet."},
        )

    try:
        enriched = await enrich_films(request.app.state.aiohttp_session, common, limit=30)
        selected, alternatives = pick_from_common(enriched, payload.strategy)
    except Exception:
        logger.exception("Recommend-from-compare enrichment failed for %s/%s", first, second)
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="enrichment_failed")
        raise HTTPException(
            status_code=502,
            detail={"error_code": "enrichment_failed", "message": "Could not look up film details. Try again later."},
        )

    reason = "Both of you have it on your watchlist."
    response = RecommendFromCompareResponse(
        recommendation=recommendation_from_film(selected, reason),
        alternatives=[recommendation_from_film(film, reason) for film in alternatives],
    )
    _persist_watchlist_run([first, second], {"recommendation": selected.get("title"), "alternatives": len(alternatives)}, request, ok=True)
    return response


@router.post("/api/watchlist-enrich")
async def enrich_watchlist_films(request: Request, payload: WatchlistCompareRequest):
    """Enrich the common films from a watchlist compare with TMDB metadata.

    Returns the common bucket with popularity, vote_average, vote_count, and
    genres added — used by the swipe UI for sorting by popularity.
    """
    if not _check_rate_limit(_client_key(request)):
        raise _rate_limit_exception()

    first = _validate_username(payload.usernames[0])
    second = _validate_username(payload.usernames[1])

    if first == second:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "same_username", "message": "Enter two different Letterboxd usernames."},
        )

    if task_manager.is_worker_paused():
        raise _worker_paused_exception()

    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        raise HTTPException(
            status_code=503,
            detail={"error_code": "worker_offline", "message": "The desktop scraper is currently offline. Please try again later."},
        )

    task_id = task_manager.create_watchlist_compare_job([first, second])
    outcome, data = await _await_worker_job(task_id, 120)

    if outcome == "failed":
        raise _worker_failure_exception(data)
    if outcome == "timeout":
        raise HTTPException(
            status_code=504,
            detail={"error_code": "scrape_timeout", "message": "Desktop worker took too long. Try again later."},
        )

    comparison = compare_watchlist_sets(data.get("first_watchlist", []), data.get("second_watchlist", []))
    common = comparison["common"]

    if not common:
        return {"status": "success", "users": [first, second], "films": []}

    try:
        enriched = await enrich_films_concurrent(
            request.app.state.aiohttp_session, common, limit=50, max_concurrency=5,
        )
    except Exception:
        logger.exception("Watchlist-enrich failed for %s/%s", first, second)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "enrichment_failed", "message": "Could not look up film details. Try again later."},
        )

    films = [public_film(f) for f in enriched]
    return {"status": "success", "users": [first, second], "films": films}
