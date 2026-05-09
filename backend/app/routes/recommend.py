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
)
from app.services.scraper import merge_scraped_films, scrape_profile_sources, scrape_watchlist

logger = logging.getLogger("letterboxd_wrapped.recommend")

router = APIRouter()

MAX_PROFILE_PAGES = 25
MAX_ENRICHED_FILMS = 80
SCRAPE_TIMEOUT = 90  # seconds per scrape operation
ENRICH_TIMEOUT = 90  # seconds per enrich operation


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
        first_sources, second_sources, first_watchlist, second_watchlist = await asyncio.gather(
            asyncio.wait_for(scrape_profile_sources(first, max_pages=MAX_PROFILE_PAGES), timeout=SCRAPE_TIMEOUT),
            asyncio.wait_for(scrape_profile_sources(second, max_pages=MAX_PROFILE_PAGES), timeout=SCRAPE_TIMEOUT),
            asyncio.wait_for(scrape_watchlist(first, max_pages=MAX_PROFILE_PAGES), timeout=SCRAPE_TIMEOUT),
            asyncio.wait_for(scrape_watchlist(second, max_pages=MAX_PROFILE_PAGES), timeout=SCRAPE_TIMEOUT),
        )
    except asyncio.TimeoutError:
        logger.exception("Date night scrape timed out for %s/%s", first, second)
        raise HTTPException(
            status_code=504,
            detail={"error_code": "scrape_timeout", "message": "Reading profiles took too long. Try again later."},
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
        raise HTTPException(
            status_code=504,
            detail={"error_code": "enrich_timeout", "message": "Film enrichment took too long. Try again later."},
        )
    except Exception:
        logger.exception("Date night TMDB enrich failed for %s/%s", first, second)
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
        raise HTTPException(
            status_code=504,
            detail={"error_code": "profile_timeout", "message": "Building taste profile took too long. Try again later."},
        )
    except Exception:
        logger.exception("Date night mutual profile failed for %s/%s", first, second)
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
        raise HTTPException(
            status_code=502,
            detail={"error_code": "recommendation_failed", "message": "Could not find recommendations. Try again later."},
        )

    if not recommendations:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "no_recommendations", "message": "No strong mutual recommendation was found yet."},
        )

    return DateNightResponse(
        mutual_profile=MutualProfile(**mutual_profile),
        recommendations=recommendations,
    )
