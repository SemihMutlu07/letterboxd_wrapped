"""
RSS preview stat builder.

Takes normalized RSS items (which already carry ``tmdb_id``) and enriches them
by calling ``fetch_comprehensive_film_details`` DIRECTLY — it never calls the
fuzzy ``resolve_tmdb_id`` title search, because RSS already gives us the exact
TMDB id. Fuzzy title/year matching stays reserved for the export-CSV and HTML
scraper paths.

The stats produced here are an honest *recent sample*, not full history:
``source`` and ``data_quality`` are embedded so the frontend can label the
preview and never present sampled numbers as lifetime facts.
"""
from __future__ import annotations

import asyncio
from collections import Counter
from datetime import datetime
from statistics import median
from typing import Any, Optional

import aiohttp

from app.services.tmdb_client import fetch_comprehensive_film_details

PREVIEW_LIMITATIONS = [
    "Based on recent public RSS activity, not your full Letterboxd history.",
    "Totals and pace reflect this recent sample only.",
    "Upload your Letterboxd export for complete, exact stats.",
]


def _clean_str(value: Any) -> str:
    return value if isinstance(value, str) else ""


async def build_preview_stats(
    session: aiohttp.ClientSession,
    items: list[dict],
) -> dict[str, Any]:
    """Enrich RSS items by tmdb_id and aggregate honest recent-sample stats.

    Returns a stats dict shaped compatibly with the results page, with embedded
    ``source`` and ``data_quality`` so the preview is never mistaken for a full
    Wrapped.
    """
    sample_size = len(items)
    with_tmdb = [it for it in items if it.get("tmdb_id") is not None]
    unique_ids = list({int(it["tmdb_id"]) for it in with_tmdb})

    # TMDB-ID-native enrichment: straight to detail fetch, never resolve_tmdb_id.
    detail_results = await asyncio.gather(
        *[fetch_comprehensive_film_details(session, tmdb_id) for tmdb_id in unique_ids]
    )
    details_by_id: dict[int, dict] = {}
    for tmdb_id, detail in zip(unique_ids, detail_results):
        if detail:
            details_by_id[tmdb_id] = detail

    genre_counts: Counter = Counter()
    country_counts: Counter = Counter()
    language_counts: Counter = Counter()
    director_counts: Counter = Counter()
    decade_counts: Counter = Counter()
    cast_counts: Counter = Counter()

    ratings: list[float] = []
    runtimes: list[int] = []
    watched_dates: list[str] = []
    rated_films: list[dict] = []
    all_films: list[dict] = []

    for it in items:
        rating = it.get("rating")
        if isinstance(rating, (int, float)):
            ratings.append(float(rating))
        if it.get("watched_date"):
            watched_dates.append(it["watched_date"])

        tmdb_id = it.get("tmdb_id")
        detail = details_by_id.get(int(tmdb_id)) if tmdb_id is not None else None
        title = (detail or {}).get("title") or it.get("title") or ""
        poster_path = _clean_str((detail or {}).get("poster_path"))

        if detail:
            for g in detail.get("genres") or []:
                genre_counts[g] += 1
            for c in detail.get("countries") or []:
                country_counts[c] += 1
            lang = detail.get("language")
            if lang:
                language_counts[lang] += 1
            director = detail.get("director")
            if director:
                director_counts[director] += 1
            decade = detail.get("decade")
            if decade:
                decade_counts[decade] += 1
            for actor in (detail.get("cast") or [])[:5]:
                cast_counts[actor] += 1
            rt = detail.get("runtime")
            if isinstance(rt, (int, float)) and rt > 0:
                runtimes.append(int(rt))

        film_row = {
            "title": title,
            "year": it.get("year"),
            "rating": float(rating) if isinstance(rating, (int, float)) else None,
            "poster_path": poster_path,
            "director": (detail or {}).get("director"),
            "genres": (detail or {}).get("genres") or [],
            "countries": (detail or {}).get("countries") or [],
            "language": (detail or {}).get("language"),
            "decade": (detail or {}).get("decade"),
        }
        all_films.append(film_row)
        if film_row["rating"] is not None:
            rated_films.append({
                "title": title,
                "year": it.get("year"),
                "rating": film_row["rating"],
                "poster_path": poster_path,
            })

    stats: dict[str, Any] = {
        "source": "rss",
        "recent_films_count": sample_size,
        # total_films here is the recent sample size, not lifetime — flagged via
        # data_quality and the results banner so it is never read as full history.
        "total_films": sample_size,
        "diary_film_count": len(watched_dates),
        "all_films": all_films,
        "rated_films": sorted(rated_films, key=lambda f: f["rating"], reverse=True),
        "analysis_date": datetime.now().isoformat(),
    }

    if ratings:
        dist: Counter = Counter(ratings)
        stats["average_rating"] = round(sum(ratings) / len(ratings), 2)
        stats["median_rating"] = round(median(ratings), 1)
        stats["total_rated_films"] = len(ratings)
        stats["rating_distribution"] = {str(k): dist[k] for k in sorted(dist)}
        stats["most_common_rating"] = dist.most_common(1)[0][0]

    if runtimes:
        total_runtime = sum(runtimes)
        stats["total_runtime"] = total_runtime
        stats["hours_watched"] = round(total_runtime / 60, 1)
        stats["days_watched"] = round(total_runtime / (60 * 24), 1)
        stats["average_runtime"] = round(total_runtime / len(runtimes), 1)

    stats["top_genres"] = [{"name": n, "count": c} for n, c in genre_counts.most_common(15)]
    stats["favorite_genre"] = (
        {"name": genre_counts.most_common(1)[0][0], "count": genre_counts.most_common(1)[0][1]}
        if genre_counts else None
    )

    stats["top_countries"] = [{"name": n, "count": c} for n, c in country_counts.most_common(15)]
    stats["total_countries"] = len(country_counts)

    stats["top_languages"] = [{"language": n, "count": c} for n, c in language_counts.most_common(10)]

    stats["top_directors"] = [
        {"name": n, "count": c, "profile_path": None} for n, c in director_counts.most_common(20)
    ]
    stats["total_directors"] = len(director_counts)
    stats["most_watched_director"] = (
        {"name": director_counts.most_common(1)[0][0], "count": director_counts.most_common(1)[0][1], "profile_path": None}
        if director_counts else None
    )

    stats["top_actors"] = [
        {"name": n, "count": c, "profile_path": None} for n, c in cast_counts.most_common(20)
    ]

    stats["decades"] = [
        {"decade": d, "count": c}
        for d, c in sorted(
            decade_counts.items(),
            key=lambda x: int(x[0].replace("s", "")) if x[0] and x[0] != "Unknown" else 0,
        )
    ]
    stats["favorite_decade"] = (
        {"name": decade_counts.most_common(1)[0][0], "count": decade_counts.most_common(1)[0][1]}
        if decade_counts else None
    )

    if watched_dates:
        parsed = sorted(d for d in watched_dates if _is_iso_date(d))
        if parsed:
            earliest, latest = parsed[0], parsed[-1]
            total_days = max(1, (datetime.fromisoformat(latest) - datetime.fromisoformat(earliest)).days)
            stats["data_timeline"] = {
                "earliest_date": datetime.fromisoformat(earliest).isoformat(),
                "latest_date": datetime.fromisoformat(latest).isoformat(),
                "total_days": total_days,
                "period_description": f"Your last {len(parsed)} logged films",
            }
            month_counts = Counter(d[:7] for d in parsed)
            stats["monthly_viewing_habits"] = [
                {"month": m, "count": month_counts[m]} for m in sorted(month_counts)
            ]

    tmdb_coverage = round(len(with_tmdb) / sample_size * 100, 1) if sample_size else 0.0
    stats["data_quality"] = {
        "mode": "preview",
        "exactness": "sampled",
        "sample_size": sample_size,
        "tmdb_id_coverage": tmdb_coverage,
        "limitations": list(PREVIEW_LIMITATIONS),
    }

    return stats


def _is_iso_date(value: str) -> bool:
    if not value:
        return False
    try:
        datetime.fromisoformat(value)
        return True
    except ValueError:
        return False
