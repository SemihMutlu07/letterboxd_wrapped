from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app import supabase_ops, task_manager
from app.config import settings
from app.models.recommend import DateNightResponse, MutualProfile, UserPairRequest
from app.routes.watchlist import (
    _await_worker_job,
    _check_rate_limit,
    _client_key,
    _rate_limit_exception,
    _validate_username,
    _worker_failure_exception,
    _worker_paused_exception,
)
from app.services.recommender import (
    build_mutual_profile,
    discover_date_night_recommendations,
    enrich_films,
)
from app.services import dashboard_settings
from app.services.scraper import merge_scraped_films

logger = logging.getLogger("letterboxd_wrapped.recommend")

router = APIRouter()

MAX_ENRICHED_FILMS = 80
ENRICH_TIMEOUT = 90  # seconds per enrich operation

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


@router.post("/api/date-night", response_model=DateNightResponse)
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

    task_id = task_manager.create_date_night_job([first, second])
    # date-night scrapes 4 sources — allow more time than watchlist compare
    outcome, scraped = await _await_worker_job(task_id, 180)

    if outcome == "failed":
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message=scraped)
        raise _worker_failure_exception(scraped)
    if outcome == "timeout":
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="worker_timeout")
        raise HTTPException(
            status_code=504,
            detail={"error_code": "scrape_timeout", "message": "Desktop worker took too long. Try again later."},
        )

    first_films = merge_scraped_films(scraped.get("first_diary", []), scraped.get("first_grid", []))
    second_films = merge_scraped_films(scraped.get("second_diary", []), scraped.get("second_grid", []))
    first_watchlist = scraped.get("first_watchlist", [])
    second_watchlist = scraped.get("second_watchlist", [])

    session = request.app.state.aiohttp_session

    try:
        first_enriched, second_enriched, first_wl_enriched, second_wl_enriched = await asyncio.gather(
            asyncio.wait_for(enrich_films(session, first_films, limit=MAX_ENRICHED_FILMS), timeout=ENRICH_TIMEOUT),
            asyncio.wait_for(enrich_films(session, second_films, limit=MAX_ENRICHED_FILMS), timeout=ENRICH_TIMEOUT),
            asyncio.wait_for(enrich_films(session, first_watchlist, limit=MAX_ENRICHED_FILMS), timeout=ENRICH_TIMEOUT),
            asyncio.wait_for(enrich_films(session, second_watchlist, limit=MAX_ENRICHED_FILMS), timeout=ENRICH_TIMEOUT),
        )
    except asyncio.TimeoutError:
        logger.exception("Date night TMDB enrich timed out for %s/%s", first, second)
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="enrich_timeout")
        raise HTTPException(
            status_code=504,
            detail={"error_code": "enrich_timeout", "message": "Film enrichment took too long. Try again later."},
        )
    except Exception:
        logger.exception("Date night TMDB enrich failed for %s/%s", first, second)
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="enrichment_failed")
        raise HTTPException(
            status_code=502,
            detail={"error_code": "enrichment_failed", "message": "Could not look up film details. Try again later."},
        )

    try:
        mutual_profile = await asyncio.wait_for(
            asyncio.to_thread(build_mutual_profile, first_enriched, second_enriched),
            timeout=60,
        )
    except asyncio.TimeoutError:
        logger.exception("Date night mutual profile timed out for %s/%s", first, second)
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="profile_timeout")
        raise HTTPException(
            status_code=504,
            detail={"error_code": "profile_timeout", "message": "Building taste profile took too long. Try again later."},
        )
    except Exception:
        logger.exception("Date night mutual profile failed for %s/%s", first, second)
        _persist_date_night_run([first, second], None, [], request, ok=False, error_message="profile_failed")
        raise HTTPException(
            status_code=502,
            detail={"error_code": "profile_failed", "message": "Could not build taste profile. Try again later."},
        )

    try:
        recommendations = await discover_date_night_recommendations(
            first_wl_enriched, second_wl_enriched, mutual_profile
        )
    except Exception:
        logger.exception("Date night recommendation discovery failed for %s/%s", first, second)
        _persist_date_night_run([first, second], mutual_profile, [], request, ok=False, error_message="recommendation_failed")
        raise HTTPException(
            status_code=502,
            detail={"error_code": "recommendation_failed", "message": "Could not find recommendations. Try again later."},
        )

    if not recommendations:
        _persist_date_night_run([first, second], mutual_profile, [], request, ok=False, error_message="no_recommendations")
        raise HTTPException(
            status_code=404,
            detail={"error_code": "no_recommendations", "message": "No strong mutual recommendation was found yet."},
        )

    _persist_date_night_run([first, second], mutual_profile, recommendations, request, ok=True)
    return DateNightResponse(
        mutual_profile=MutualProfile(**mutual_profile),
        recommendations=recommendations,
    )
