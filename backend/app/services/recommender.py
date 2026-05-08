from __future__ import annotations

import random
from collections import Counter
from typing import Any, Iterable, Optional

import aiohttp

from app.models.recommend import FilmRecommendation, RecommendationStrategy
from app.services.tmdb_client import fetch_comprehensive_film_details, resolve_tmdb_id, tmdb_get


GENRE_IDS = {
    "Action": 28,
    "Adventure": 12,
    "Animation": 16,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Family": 10751,
    "Fantasy": 14,
    "History": 36,
    "Horror": 27,
    "Music": 10402,
    "Mystery": 9648,
    "Romance": 10749,
    "Science Fiction": 878,
    "TV Movie": 10770,
    "Thriller": 53,
    "War": 10752,
    "Western": 37,
}


def film_key(film: dict[str, Any]) -> tuple[str, str]:
    return (str(film.get("title", "")).strip().lower(), str(film.get("year", "")).strip())


def public_film(film: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": film.get("title", ""),
        "year": str(film.get("year", "") or ""),
        "slug": film.get("slug", ""),
    }


def compare_watchlist_sets(first_watchlist: list[dict], second_watchlist: list[dict]) -> dict[str, Any]:
    first_by_key = {film_key(film): film for film in first_watchlist if film.get("title")}
    second_by_key = {film_key(film): film for film in second_watchlist if film.get("title")}
    common_keys = sorted(first_by_key.keys() & second_by_key.keys(), key=lambda k: (k[0], k[1]))
    first_only_keys = sorted(first_by_key.keys() - second_by_key.keys(), key=lambda k: (k[0], k[1]))
    second_only_keys = sorted(second_by_key.keys() - first_by_key.keys(), key=lambda k: (k[0], k[1]))

    larger_count = max(len(first_by_key), len(second_by_key), 1)
    match_score = round((len(common_keys) / larger_count) * 100, 1)

    return {
        "counts": {
            "first_total": len(first_by_key),
            "second_total": len(second_by_key),
            "common": len(common_keys),
            "first_only": len(first_only_keys),
            "second_only": len(second_only_keys),
        },
        "match_score": match_score,
        "common": [public_film(first_by_key[key]) for key in common_keys],
        "first_only": [public_film(first_by_key[key]) for key in first_only_keys],
        "second_only": [public_film(second_by_key[key]) for key in second_only_keys],
    }


def _year_from_film(film: dict[str, Any]) -> Optional[int]:
    try:
        year = str(film.get("year", "") or film.get("release_date", "")[:4])
        return int(year) if year else None
    except ValueError:
        return None


async def enrich_films(
    session: aiohttp.ClientSession,
    films: Iterable[dict[str, Any]],
    limit: int = 20,
) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for film in list(films)[:limit]:
        year = _year_from_film(film)
        tmdb_id = await resolve_tmdb_id(session, str(film.get("title", "")), year)
        details = await fetch_comprehensive_film_details(session, tmdb_id) if tmdb_id else {}
        enriched.append({**film, **details})
    return enriched


def pick_from_common(
    films: list[dict[str, Any]],
    strategy: RecommendationStrategy,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not films:
        raise ValueError("no_common_films")

    ranked = list(films)
    if strategy == "random":
        random.shuffle(ranked)
    elif strategy == "highest_rated":
        ranked.sort(key=lambda film: float(film.get("vote_average") or 0), reverse=True)
    elif strategy == "newest":
        ranked.sort(key=lambda film: str(film.get("release_date") or film.get("year") or ""), reverse=True)

    return ranked[0], ranked[1:6]


def recommendation_from_film(film: dict[str, Any], reason: str) -> FilmRecommendation:
    return FilmRecommendation(
        title=str(film.get("title", "")),
        year=str(film.get("year") or str(film.get("release_date", ""))[:4] or ""),
        reason=reason,
        poster_path=str(film.get("poster_path") or ""),
        slug=str(film.get("slug") or ""),
        vote_average=film.get("vote_average") if isinstance(film.get("vote_average"), (int, float)) else None,
        release_date=str(film.get("release_date") or ""),
    )


def build_mutual_profile(first_enriched: list[dict], second_enriched: list[dict]) -> dict[str, Any]:
    def counts(items: list[dict], field: str) -> Counter:
        counter: Counter = Counter()
        for film in items:
            values = film.get(field)
            if isinstance(values, list):
                counter.update(str(value) for value in values if value)
            elif values:
                counter.update([str(values)])
        return counter

    first_genres = counts(first_enriched, "genres")
    second_genres = counts(second_enriched, "genres")
    first_directors = counts(first_enriched, "directors")
    second_directors = counts(second_enriched, "directors")

    mutual_genres = [
        name for name, _ in (first_genres & second_genres).most_common(5)
    ] or [name for name, _ in (first_genres + second_genres).most_common(3)]
    mutual_directors = [
        name for name, _ in (first_directors & second_directors).most_common(5)
    ]

    decade_counts: Counter = Counter()
    for film in first_enriched + second_enriched:
        decade = film.get("decade")
        if decade:
            decade_counts.update([str(decade)])
    era_overlap = decade_counts.most_common(1)[0][0] if decade_counts else "mixed eras"

    return {
        "top_genres": mutual_genres,
        "top_directors": mutual_directors,
        "era_overlap": era_overlap,
    }


async def discover_date_night_recommendations(
    session: aiohttp.ClientSession,
    mutual_profile: dict[str, Any],
    watched_keys: set[tuple[str, str]],
    limit: int = 6,
) -> list[FilmRecommendation]:
    genre_id = None
    for genre in mutual_profile.get("top_genres", []):
        if genre in GENRE_IDS:
            genre_id = GENRE_IDS[genre]
            break

    params: dict[str, Any] = {
        "include_adult": "false",
        "sort_by": "vote_average.desc",
        "vote_count.gte": "300",
    }
    if genre_id:
        params["with_genres"] = str(genre_id)

    data = await tmdb_get(session, "discover/movie", params)
    results = data.get("results", []) if data else []

    recommendations: list[FilmRecommendation] = []
    for result in results:
        title = str(result.get("title") or "")
        release_date = str(result.get("release_date") or "")
        year = release_date[:4]
        if not title or (title.strip().lower(), year) in watched_keys:
            continue
        reason_parts = []
        if mutual_profile.get("top_genres"):
            reason_parts.append(f"you both lean toward {mutual_profile['top_genres'][0]}")
        if mutual_profile.get("era_overlap") and mutual_profile["era_overlap"] != "mixed eras":
            reason_parts.append(f"your overlap points to {mutual_profile['era_overlap']}")
        reason = "Matched from your shared taste profile" if not reason_parts else "Matched because " + " and ".join(reason_parts)
        recommendations.append(
            FilmRecommendation(
                title=title,
                year=year,
                reason=reason,
                poster_path=str(result.get("poster_path") or ""),
                vote_average=result.get("vote_average") if isinstance(result.get("vote_average"), (int, float)) else None,
                release_date=release_date,
            )
        )
        if len(recommendations) >= limit:
            break

    return recommendations
