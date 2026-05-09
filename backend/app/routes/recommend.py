from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from app.models.recommend import DateNightResponse, MutualProfile, UserPairRequest
from app.routes.watchlist import _check_rate_limit, _client_key, _rate_limit_exception, _validate_username
from app.services.recommender import (
    build_mutual_profile,
    discover_date_night_recommendations,
    enrich_films,
    film_key,
)
from app.services.scraper import merge_scraped_films, scrape_profile_sources

logger = logging.getLogger("letterboxd_wrapped.recommend")

router = APIRouter()

MAX_PROFILE_PAGES = 25
MAX_ENRICHED_FILMS = 80


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

    try:
        first_sources, second_sources = await asyncio.gather(
            scrape_profile_sources(first, max_pages=MAX_PROFILE_PAGES),
            scrape_profile_sources(second, max_pages=MAX_PROFILE_PAGES),
        )
    except ValueError as exc:
        logger.warning("Date night user lookup failed for %s/%s: %s", first, second, exc)
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": "One of those Letterboxd users could not be found."},
        )
    except Exception:
        logger.exception("Date night scrape failed for %s/%s", first, second)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "profile_scrape_failed", "message": "Could not read one of the public profiles. Try again later."},
        )

    first_films = merge_scraped_films(*first_sources)
    second_films = merge_scraped_films(*second_sources)
    watched_keys = {film_key(film) for film in first_films + second_films}

    session = request.app.state.aiohttp_session
    first_enriched, second_enriched = await asyncio.gather(
        enrich_films(session, first_films, limit=MAX_ENRICHED_FILMS),
        enrich_films(session, second_films, limit=MAX_ENRICHED_FILMS),
    )

    mutual_profile = build_mutual_profile(first_enriched, second_enriched)
    recommendations = await discover_date_night_recommendations(session, mutual_profile, watched_keys)

    if not recommendations:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "no_recommendations", "message": "No strong mutual recommendation was found yet."},
        )

    return DateNightResponse(
        mutual_profile=MutualProfile(**mutual_profile),
        recommendations=recommendations,
    )
