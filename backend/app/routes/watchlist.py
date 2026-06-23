from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.models.recommend import RecommendFromCompareRequest, RecommendFromCompareResponse
from app.services.recommender import (
    compare_watchlist_sets,
    enrich_films,
    pick_from_common,
    recommendation_from_film,
)
from app.services.scraper import ScraperAPIError, scrape_watchlist
from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.watchlist")

router = APIRouter()

USERNAME_RE = re.compile(r"^[a-z0-9_]+$")
MAX_WATCHLIST_PAGES = 40

WATCHLIST_RUNS_DIR = Path("watchlist_runs")


def _mirror_watchlist_to_supabase(payload: dict[str, Any]) -> None:
    """Best-effort mirror of watchlist comparison run to Supabase."""
    try:
        httpx.post(
            f"{settings.supabase_url}/rest/v1/ops_watchlist_runs",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {settings.supabase_anon_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={
                "usernames": payload.get("usernames"),
                "ok": payload.get("ok"),
                "match_score": payload.get("match_score"),
                "payload": payload,
            },
            timeout=5.0,
        )
    except Exception as exc:
        logger.warning("Failed to mirror watchlist run to Supabase: %s", exc)


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

    try:
        first_watchlist, second_watchlist = await asyncio.gather(
            scrape_watchlist(first, max_pages=MAX_WATCHLIST_PAGES),
            scrape_watchlist(second, max_pages=MAX_WATCHLIST_PAGES),
        )
    except ScraperAPIError as exc:
        # Scraper service itself failed (quota, bad key, upstream 5xx) — NOT a
        # missing user. ScraperAPIError subclasses ValueError, so it must be
        # caught first or it would be mislabeled as user_not_found below.
        logger.error("Watchlist compare scraper unavailable for %s/%s: %s", first, second, exc)
        raise HTTPException(
            status_code=503,
            detail={"error_code": "scraper_unavailable", "message": str(exc)},
        )
    except ValueError as exc:
        msg = str(exc)
        if "Letterboxd is blocking" in msg:
            logger.warning("Watchlist compare blocked for %s/%s: %s", first, second, msg)
            raise HTTPException(
                status_code=503,
                detail={"error_code": "scrape_blocked", "message": msg},
            )
        logger.warning("Watchlist compare user lookup failed for %s/%s: %s", first, second, exc)
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": "One of those Letterboxd users could not be found."},
        )
    except Exception:
        logger.exception("Watchlist compare scrape failed for %s/%s", first, second)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "watchlist_scrape_failed", "message": "Could not read one of the public watchlists. Try again later."},
        )

    comparison = compare_watchlist_sets(first_watchlist, second_watchlist)
    _persist_watchlist_run([first, second], comparison, request, ok=True)

    return {
        "status": "success",
        "users": [first, second],
        **comparison,
    }


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

    try:
        first_watchlist, second_watchlist = await asyncio.gather(
            scrape_watchlist(first, max_pages=MAX_WATCHLIST_PAGES),
            scrape_watchlist(second, max_pages=MAX_WATCHLIST_PAGES),
        )
    except ScraperAPIError as exc:
        logger.error("Recommendation scraper unavailable for %s/%s: %s", first, second, exc)
        raise HTTPException(
            status_code=503,
            detail={"error_code": "scraper_unavailable", "message": str(exc)},
        )
    except ValueError as exc:
        msg = str(exc)
        if "Letterboxd is blocking" in msg:
            logger.warning("Recommendation blocked for %s/%s: %s", first, second, msg)
            raise HTTPException(
                status_code=503,
                detail={"error_code": "scrape_blocked", "message": msg},
            )
        logger.warning("Recommendation user lookup failed for %s/%s: %s", first, second, exc)
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": "One of those Letterboxd users could not be found."},
        )
    except Exception:
        logger.exception("Recommendation scrape failed for %s/%s", first, second)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "watchlist_scrape_failed", "message": "Could not read one of the public watchlists. Try again later."},
        )

    common = compare_watchlist_sets(first_watchlist, second_watchlist)["common"]
    if not common:
        _persist_watchlist_run([first, second], None, request, ok=False, error_message="no_common_watchlist")
        raise HTTPException(
            status_code=404,
            detail={"error_code": "no_common_watchlist", "message": "Those watchlists do not overlap yet."},
        )

    enriched = await enrich_films(request.app.state.aiohttp_session, common, limit=30)
    selected, alternatives = pick_from_common(enriched, payload.strategy)
    reason = "Both of you have it on your watchlist."
    response = RecommendFromCompareResponse(
        recommendation=recommendation_from_film(selected, reason),
        alternatives=[recommendation_from_film(film, reason) for film in alternatives],
    )
    _persist_watchlist_run([first, second], {"recommendation": selected.get("title"), "alternatives": len(alternatives)}, request, ok=True)
    return response
