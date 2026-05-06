from __future__ import annotations

import asyncio
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
import aiohttp
import pandas as pd

from app.config import settings

CACHE_DIR = Path("tmdb_cache")
CACHE_DIR.mkdir(exist_ok=True)


async def tmdb_get(
    session: aiohttp.ClientSession,
    endpoint: str,
    params: dict | None = None,
    cache: bool = True,
) -> Optional[Dict[str, Any]]:
    """GET from TMDB API with disk caching."""
    params = params or {}
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
    try:
        async with session.get(url, params=params) as response:
            response.raise_for_status()
            data = await response.json()
            async with aiofiles.open(cache_file, "w", encoding="utf-8") as f:
                await f.write(json.dumps(data, ensure_ascii=False, indent=2))
            await asyncio.sleep(0.05)
            return data
    except aiohttp.ClientError as e:
        print(f"Error fetching {url}: {e}")
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
