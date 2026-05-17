from __future__ import annotations

import random
import re
from collections import Counter
from typing import Any, Iterable, Optional

import aiohttp

from app.models.recommend import FilmRecommendation, RecommendationStrategy
from app.services.tmdb_client import fetch_comprehensive_film_details, resolve_tmdb_id


def _slugify_title(title: str) -> str:
    """Convert a film title to a Letterboxd-compatible URL slug."""
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def film_key(film: dict[str, Any]) -> tuple[str, str]:
    return (str(film.get("title", "")).strip().lower(), str(film.get("year", "")).strip())


BUCKET_CAP = 50  # max items per compare-bucket array


def public_film(film: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": film.get("title", ""),
        "year": str(film.get("year", "") or ""),
        "slug": film.get("slug", ""),
        "poster_url": str(film.get("poster_url") or ""),
    }


def compare_watchlist_sets(first_watchlist: list[dict], second_watchlist: list[dict]) -> dict[str, Any]:
    first_by_key = {film_key(film): film for film in first_watchlist if film.get("title")}
    second_by_key = {film_key(film): film for film in second_watchlist if film.get("title")}
    common_keys = sorted(first_by_key.keys() & second_by_key.keys(), key=lambda k: (k[0], k[1]))
    first_only_keys = sorted(first_by_key.keys() - second_by_key.keys(), key=lambda k: (k[0], k[1]))
    second_only_keys = sorted(second_by_key.keys() - first_by_key.keys(), key=lambda k: (k[0], k[1]))

    larger_count = max(len(first_by_key), len(second_by_key), 1)
    match_score = round((len(common_keys) / larger_count) * 100, 1)

    common = [public_film(first_by_key[key]) for key in common_keys[:BUCKET_CAP]]
    first_only = [public_film(first_by_key[key]) for key in first_only_keys[:BUCKET_CAP]]
    second_only = [public_film(second_by_key[key]) for key in second_only_keys[:BUCKET_CAP]]

    return {
        "counts": {
            "first_total": len(first_by_key),
            "second_total": len(second_by_key),
            "common": len(common_keys),
            "first_only": len(first_only_keys),
            "second_only": len(second_only_keys),
        },
        "returned_counts": {
            "common": len(common),
            "first_only": len(first_only),
            "second_only": len(second_only),
        },
        "truncated": {
            "common": len(common_keys) > len(common),
            "first_only": len(first_only_keys) > len(first_only),
            "second_only": len(second_only_keys) > len(second_only),
        },
        "match_score": match_score,
        "common": common,
        "first_only": first_only,
        "second_only": second_only,
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
    slug = str(film.get("slug") or "")
    letterboxd_slug = slug or _slugify_title(str(film.get("title", "")))
    return FilmRecommendation(
        title=str(film.get("title", "")),
        year=str(film.get("year") or str(film.get("release_date", ""))[:4] or ""),
        reason=reason,
        poster_path=str(film.get("poster_path") or ""),
        slug=slug,
        letterboxd_slug=letterboxd_slug,
        vote_average=film.get("vote_average") if isinstance(film.get("vote_average"), (int, float)) else None,
        release_date=str(film.get("release_date") or ""),
    )


def build_mutual_profile(first_enriched: list[dict], second_enriched: list[dict]) -> dict[str, Any]:
    """Build a shared taste profile from two enriched film lists.

    Pure-computation function. Callers should wrap with asyncio.wait_for
    (~60 s) to guard against degenerate data.
    """
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


def _profile_match_score(film: dict[str, Any], mutual_genres: set[str], era_overlap: str) -> int:
    """Score how well a film matches the mutual taste profile."""
    score = 0
    film_genres = {str(g) for g in (film.get("genres") or [])}
    if film_genres & mutual_genres:
        score += 2
    film_decade = str(film.get("decade") or "")
    if film_decade and era_overlap and film_decade == era_overlap:
        score += 1
    return score


def _recommendation_reason(film: dict[str, Any], mutual_profile: dict[str, Any], whose: str) -> str:
    """Build a human-readable reason string for a recommendation."""
    mutual_genres = mutual_profile.get("top_genres", [])
    film_genres = {str(g) for g in (film.get("genres") or [])}
    matched_genre = next((g for g in mutual_genres if g in film_genres), None)
    if matched_genre:
        return f"On {whose} watchlist — you both lean toward {matched_genre}"
    if mutual_profile.get("era_overlap") and str(film.get("decade") or "") == mutual_profile["era_overlap"]:
        return f"On {whose} watchlist — fits your shared {mutual_profile['era_overlap']} era"
    return f"On {whose} watchlist"


async def discover_date_night_recommendations(
    first_enriched: list[dict],
    second_enriched: list[dict],
    mutual_profile: dict[str, Any],
    limit: int = 6,
) -> list[FilmRecommendation]:
    """Recommend films ONLY from the union of both users' watchlists.

    Priority order:
      1. Intersection — films on BOTH watchlists (score 10)
      2. First-only films that match the mutual taste profile (score 1-3)
      3. Second-only films that match the mutual taste profile (score 1-3)
    """
    first_by_key = {film_key(f): f for f in first_enriched if f.get("title")}
    second_by_key = {film_key(f): f for f in second_enriched if f.get("title")}

    first_keys = set(first_by_key.keys())
    second_keys = set(second_by_key.keys())

    common_keys = first_keys & second_keys
    first_only_keys = first_keys - second_keys
    second_only_keys = second_keys - first_keys

    mutual_genres = set(mutual_profile.get("top_genres", []))
    era_overlap = str(mutual_profile.get("era_overlap", ""))

    scored: list[tuple[int, dict[str, Any], str]] = []

    # 1. Intersection (both watchlists) — highest priority
    for key in common_keys:
        film = first_by_key[key]
        scored.append((10, film, "On both your watchlists — you both want to see this!"))

    # 2. First-only films that match mutual taste profile
    for key in first_only_keys:
        film = first_by_key[key]
        score = _profile_match_score(film, mutual_genres, era_overlap)
        if score > 0:
            scored.append((score, film, _recommendation_reason(film, mutual_profile, "their")))

    # 3. Second-only films that match mutual taste profile
    for key in second_only_keys:
        film = second_by_key[key]
        score = _profile_match_score(film, mutual_genres, era_overlap)
        if score > 0:
            scored.append((score, film, _recommendation_reason(film, mutual_profile, "their")))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    recommendations: list[FilmRecommendation] = []
    seen: set[tuple[str, str]] = set()
    for _, film, reason in scored:
        key = film_key(film)
        if key in seen:
            continue
        seen.add(key)
        recommendations.append(recommendation_from_film(film, reason))
        if len(recommendations) >= limit:
            break

    return recommendations
