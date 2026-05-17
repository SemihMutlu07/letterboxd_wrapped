from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from pathlib import Path
import time
from collections import deque
from typing import Any, Dict, List, Optional
import unicodedata

import aiofiles
import aiohttp
import pandas as pd

from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.tmdb")

CACHE_DIR = Path("tmdb_cache")
CACHE_DIR.mkdir(exist_ok=True)
_tmdb_request_times: deque[float] = deque()
_tmdb_rate_lock = asyncio.Lock()


async def _wait_for_tmdb_slot() -> None:
    """Conservative process-wide TMDB request pacing.

    TMDB no longer publishes a fixed hard quota, but its docs mention upper
    limits around 40 req/sec. We stay below that by default and still rely on
    429 backoff if the effective limit changes.
    """
    limit = max(1, settings.tmdb_requests_per_second)

    while True:
        async with _tmdb_rate_lock:
            now = time.monotonic()
            while _tmdb_request_times and now - _tmdb_request_times[0] >= 1:
                _tmdb_request_times.popleft()

            if len(_tmdb_request_times) < limit:
                _tmdb_request_times.append(now)
                return

            sleep_for = max(0.01, 1 - (now - _tmdb_request_times[0]))

        await asyncio.sleep(sleep_for)


async def tmdb_get(
    session: aiohttp.ClientSession,
    endpoint: str,
    params: dict | None = None,
    cache: bool = True,
) -> Optional[Dict[str, Any]]:
    """GET from TMDB API with disk caching."""
    params = dict(params or {})
    params["api_key"] = settings.tmdb_api_key

    params_str = json.dumps(params, sort_keys=True)
    cache_key = hashlib.md5(f"{endpoint}{params_str}".encode()).hexdigest()
    cache_file = CACHE_DIR / f"{cache_key}.json"

    if cache and cache_file.exists():
        try:
            async with aiofiles.open(cache_file, "r", encoding="utf-8") as f:
                return json.loads(await f.read())
        except Exception:
            pass

    url = f"https://api.themoviedb.org/3/{endpoint}"
    for attempt in range(settings.tmdb_429_retries + 1):
        try:
            await _wait_for_tmdb_slot()
            async with session.get(url, params=params) as response:
                if response.status == 429:
                    retry_after = response.headers.get("Retry-After")
                    try:
                        delay = float(retry_after) if retry_after else 1.5 * (attempt + 1)
                    except ValueError:
                        delay = 1.5 * (attempt + 1)
                    if attempt < settings.tmdb_429_retries:
                        await asyncio.sleep(delay)
                        continue

                response.raise_for_status()
                data = await response.json()
                async with aiofiles.open(cache_file, "w", encoding="utf-8") as f:
                    await f.write(json.dumps(data, ensure_ascii=False, indent=2))
                return data
        except aiohttp.ClientError as e:
            print(f"Error fetching {url}: {e}")
            return None

    return None


def _normalize_person_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(ascii_name.lower().split())


async def search_person_with_fallback(
    session: aiohttp.ClientSession,
    name: str,
) -> Optional[Dict[str, Any]]:
    """Search TMDB person by name with a 3-step fallback strategy."""
    try:
        normalized_name = _normalize_person_name(name)
        logger.debug("[tmdb-search] '%s' → normalized='%s'", name, normalized_name)

        # Step 1: search with exact name
        exact_data = await tmdb_get(session, "search/person", {"query": name})
        exact_results = exact_data.get("results", []) if exact_data else []
        logger.debug("[tmdb-search] step1 exact: %s results, data=%s", len(exact_results), "present" if exact_data else "NONE")
        if exact_results:
            exact_matches = [
                result
                for result in exact_results
                if _normalize_person_name(str(result.get("name") or "")) == normalized_name
            ]
            if exact_matches:
                logger.debug("[tmdb-search] step1 exact_matches=%s", len(exact_matches))
                other_results = [result for result in exact_results if result not in exact_matches]
                return {**exact_data, "results": exact_matches + other_results}
            else:
                logger.debug("[tmdb-search] step1 no exact name match in %s results", len(exact_results))

        # Step 2: retry with language=en-US
        if not exact_results and normalized_name != name.lower().strip():
            en_data = await tmdb_get(session, "search/person", {"query": name, "language": "en-US"})
            en_results = en_data.get("results", []) if en_data else []
            logger.debug("[tmdb-search] step2 en-US: %s results", len(en_results))
            if en_results:
                en_matches = [
                    r for r in en_results
                    if _normalize_person_name(str(r.get("name") or "")) == normalized_name
                ]
                if en_matches:
                    other_results = [r for r in en_results if r not in en_matches]
                    return {**en_data, "results": en_matches + other_results}

        # Step 3: search with diacritic-stripped name
        if normalized_name and normalized_name != name.lower().strip():
            normalized_data = await tmdb_get(session, "search/person", {"query": normalized_name})
            logger.debug("[tmdb-search] step3 normalized: data=%s", "present" if normalized_data else "NONE")
            if normalized_data and normalized_data.get("results"):
                return normalized_data

        logger.debug("[tmdb-search] '%s' returning exact_data (no matches)", name)
        return exact_data
    except Exception as exc:
        logger.warning("[tmdb-search] '%s' crashed: %s", name, exc)
        return None


def _name_match(query_name: str, candidate_name: str) -> bool:
    """Fuzzy name comparison: diacritic-stripped, case-insensitive, token overlap >= 80%."""
    q_tokens = set(_normalize_person_name(query_name).split())
    c_tokens = set(_normalize_person_name(candidate_name).split())
    if not q_tokens or not c_tokens:
        return False
    overlap = len(q_tokens & c_tokens)
    return (overlap / max(len(q_tokens), len(c_tokens))) >= 0.8


async def find_person_by_film_credit(
    session: aiohttp.ClientSession,
    person_name: str,
    films: list[dict],
) -> Optional[str]:
    """Reverse-lookup a person's TMDB profile_path via film credits.

    When search/person returns no results, try searching for films the
    person is known for and extracting their profile_path from the
    film's credits response (crew + cast).

    Returns the profile_path string or None.
    """
    for film in films[:3]:
        year = film.get("year")
        params: dict = {"query": str(film.get("title", ""))}
        if year:
            try:
                params["year"] = int(year)
            except (ValueError, TypeError):
                pass
        movie = await tmdb_get(session, "search/movie", params)
        if not movie or not movie.get("results"):
            # Retry without year constraint
            movie = await tmdb_get(session, "search/movie", {"query": str(film.get("title", ""))})
            if not movie or not movie.get("results"):
                continue
        tmdb_id = movie["results"][0]["id"]
        credits = await tmdb_get(session, f"movie/{tmdb_id}/credits", {})
        if not credits:
            continue
        # Check crew first (for directors)
        for member in credits.get("crew", []):
            if _name_match(person_name, member.get("name", "")):
                pp = member.get("profile_path")
                if isinstance(pp, str) and pp:
                    return pp
        # Then cast (for actors)
        for member in credits.get("cast", []):
            if _name_match(person_name, member.get("name", "")):
                pp = member.get("profile_path")
                if isinstance(pp, str) and pp:
                    return pp
    return None


async def resolve_tmdb_id(
    session: aiohttp.ClientSession,
    title: str,
    year: Optional[int] = None,
) -> Optional[int]:
    """Find TMDB movie ID by title (and optional year)."""
    query_params: dict = {"query": title, "include_adult": "false"}
    if year and not pd.isna(year):
        query_params["year"] = int(year)

    try:
        data = await tmdb_get(session, "search/movie", query_params)
        results = data.get("results", []) if data else []

        if not results and year:
            data = await tmdb_get(session, "search/movie", {"query": title, "include_adult": "false"})
            results = data.get("results", []) if data else []

        return results[0]["id"] if results else None
    except Exception:
        return None


async def fetch_comprehensive_film_details(
    session: aiohttp.ClientSession,
    tmdb_id: int,
) -> Dict[str, Any]:
    """Fetch details, credits, and keywords for a single film concurrently."""
    if pd.isna(tmdb_id):
        return {}

    try:
        details, credits, keywords = await asyncio.gather(
            tmdb_get(session, f"movie/{int(tmdb_id)}"),
            tmdb_get(session, f"movie/{int(tmdb_id)}/credits"),
            tmdb_get(session, f"movie/{int(tmdb_id)}/keywords"),
        )

        if not details:
            return {}

        directors: List[str] = [c["name"] for c in credits.get("crew", []) if c["job"] == "Director"] if credits else []
        writers: List[str] = [c["name"] for c in credits.get("crew", []) if c["job"] in ["Writer", "Screenplay", "Story"]] if credits else []
        cast: List[str] = [c["name"] for c in credits.get("cast", [])[:10]] if credits else []
        genres: List[str] = [g["name"] for g in details.get("genres", [])]
        countries: List[str] = [c["name"] for c in details.get("production_countries", [])]
        production_countries = details.get("production_countries", [])
        companies: List[str] = [c["name"] for c in details.get("production_companies", [])]
        keyword_list: List[str] = [k["name"] for k in keywords.get("keywords", [])] if keywords else []
        keywords_full = keywords.get("keywords", []) if keywords else []

        release_date: str = details.get("release_date", "")
        decade: Optional[str] = None
        if release_date:
            try:
                year_val = int(release_date[:4])
                decade = f"{(year_val // 10) * 10}s"
            except ValueError:
                pass

        return {
            "tmdb_id": tmdb_id,
            "title": details.get("title", ""),
            "original_title": details.get("original_title", ""),
            "release_date": release_date,
            "runtime": details.get("runtime"),
            "language": details.get("original_language"),
            "budget": details.get("budget", 0),
            "revenue": details.get("revenue", 0),
            "popularity": details.get("popularity", 0.0),
            "vote_average": details.get("vote_average", 0),
            "vote_count": details.get("vote_count", 0),
            "decade": decade,
            "tagline": details.get("tagline", ""),
            "overview": details.get("overview", ""),
            "director": directors[0] if directors else None,
            "directors": directors,
            "writers": writers,
            "cast": cast,
            "genres": genres,
            "countries": countries,
            "production_countries": production_countries,
            "companies": companies,
            "keywords": keyword_list,
            "keywords_full": keywords_full,
            "adult": details.get("adult", False),
            "status": details.get("status", ""),
            "poster_path": details.get("poster_path", ""),
            "backdrop_path": details.get("backdrop_path", ""),
        }
    except Exception as e:
        print(f"Error fetching comprehensive details for ID {tmdb_id}: {e}")
        return {"tmdb_id": tmdb_id}
