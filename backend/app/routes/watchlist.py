from __future__ import annotations

import asyncio
import logging
import re
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.scraper import scrape_watchlist

logger = logging.getLogger("letterboxd_wrapped.watchlist")

router = APIRouter()

USERNAME_RE = re.compile(r"^[a-z0-9_]+$")
MAX_WATCHLIST_PAGES = 40

_RATE_LIMIT_WINDOW = 600  # 10 minutes
_RATE_LIMIT_MAX = 3
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


def _film_key(film: dict) -> tuple[str, str]:
    return (str(film.get("title", "")).strip().lower(), str(film.get("year", "")).strip())


def _public_film(film: dict) -> dict:
    return {
        "title": film.get("title", ""),
        "year": film.get("year", ""),
        "slug": film.get("slug", ""),
    }


@router.post("/api/watchlist-compare")
async def compare_watchlists(request: Request, payload: WatchlistCompareRequest):
    if not _check_rate_limit(_client_key(request)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

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
    except ValueError as exc:
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

    first_by_key = {_film_key(film): film for film in first_watchlist if film.get("title")}
    second_by_key = {_film_key(film): film for film in second_watchlist if film.get("title")}
    common_keys = sorted(first_by_key.keys() & second_by_key.keys(), key=lambda k: (k[0], k[1]))
    first_only_keys = sorted(first_by_key.keys() - second_by_key.keys(), key=lambda k: (k[0], k[1]))
    second_only_keys = sorted(second_by_key.keys() - first_by_key.keys(), key=lambda k: (k[0], k[1]))

    larger_count = max(len(first_by_key), len(second_by_key), 1)
    match_score = round((len(common_keys) / larger_count) * 100, 1)

    return {
        "status": "success",
        "users": [first, second],
        "counts": {
            "first_total": len(first_by_key),
            "second_total": len(second_by_key),
            "common": len(common_keys),
            "first_only": len(first_only_keys),
            "second_only": len(second_only_keys),
        },
        "match_score": match_score,
        "common": [_public_film(first_by_key[key]) for key in common_keys],
        "first_only": [_public_film(first_by_key[key]) for key in first_only_keys],
        "second_only": [_public_film(second_by_key[key]) for key in second_only_keys],
    }
