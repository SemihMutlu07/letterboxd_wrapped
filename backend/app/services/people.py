"""
People analysis for Letterboxd Wrapped.

Extracted from the analysis.py god function. Computes director and actor
statistics, including async TMDB profile lookups with fallback.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

import aiohttp
import pandas as pd

from app.services.tmdb_client import (
    find_person_by_film_credit,
    search_person_with_fallback,
)


def compute_genre_stats(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute genre counts and favourite genre."""
    result: Dict[str, Any] = {}

    if films_enriched.empty or "genres" not in films_enriched.columns:
        return result

    genre_counts = Counter(
        g for genres in films_enriched["genres"].dropna() for g in genres
    )
    result["top_genres"] = [
        {"name": n, "count": c} for n, c in genre_counts.most_common(15)
    ]
    if genre_counts:
        n, c = genre_counts.most_common(1)[0]
        result["favorite_genre"] = {"name": n, "count": c}
    else:
        result["favorite_genre"] = None

    return result


def compute_decade_stats(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute decade distribution and favourite decade."""
    result: Dict[str, Any] = {}

    if films_enriched.empty or "decade" not in films_enriched.columns:
        return result

    decade_counts = Counter(films_enriched["decade"].dropna())
    result["decades"] = [
        {"decade": d, "count": c}
        for d, c in sorted(
            decade_counts.items(),
            key=lambda x: (
                int(x[0].replace("s", ""))
                if x[0] and x[0] != "Unknown"
                else 0
            ),
        )
    ]
    if decade_counts:
        n, c = decade_counts.most_common(1)[0]
        result["favorite_decade"] = {"name": n, "count": c}
    else:
        result["favorite_decade"] = None

    return result


def compute_director_counts(films_enriched: pd.DataFrame) -> Counter:
    """Return Counter of director names."""
    if films_enriched.empty or "director" not in films_enriched.columns:
        return Counter()
    return Counter(films_enriched["director"].dropna())


def compute_actor_counts(films_enriched: pd.DataFrame) -> Counter:
    """Return Counter of actor names (from the first cast entry)."""
    if films_enriched.empty or "cast" not in films_enriched.columns:
        return Counter()
    all_actors: List[str] = []
    for cast_list in films_enriched["cast"].dropna():
        if isinstance(cast_list, list) and len(cast_list) > 0:
            all_actors.append(cast_list[0])
    return Counter(all_actors)


def compute_all_cast_counts(films_enriched: pd.DataFrame) -> Counter:
    """Return Counter of ALL cast member names (not just first)."""
    if films_enriched.empty or "cast" not in films_enriched.columns:
        return Counter()
    return Counter(
        actor
        for cast_list in films_enriched["cast"].dropna()
        if isinstance(cast_list, list)
        for actor in cast_list
    )


def compute_my_star(actor_counts: Counter) -> Optional[Dict[str, Any]]:
    """Return the most-watched actor."""
    if not actor_counts:
        return None
    top_actor = actor_counts.most_common(1)[0]
    return {"name": top_actor[0], "count": top_actor[1]}


def compute_movie_crush(top_actors_with_profiles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Return the movie crush (top actor with profile)."""
    if not top_actors_with_profiles:
        return None
    top = top_actors_with_profiles[0]
    return {
        "name": top["name"],
        "profile_path": top["profile_path"],
        "count": top["count"],
    }


def compute_director_deep_analysis(
    films_enriched: pd.DataFrame,
    films_df: pd.DataFrame,
    most_watched_director: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Deep analysis of the most-watched director: average rating given."""
    if not most_watched_director or films_enriched.empty:
        return None

    director_name = most_watched_director["name"]
    director_films = films_enriched[films_enriched["director"] == director_name]

    if director_films.empty or "rating" not in films_df.columns:
        return None

    director_with_ratings = pd.merge(
        director_films,
        films_df[["title", "year", "rating"]],
        on=["title", "year"],
        how="left",
    )
    director_ratings = director_with_ratings["rating"].dropna()
    if director_ratings.empty:
        return None

    avg_rating = round(float(director_ratings.mean()), 2)
    return {
        "director_name": director_name,
        "average_rating_given": avg_rating,
        "total_films": int(len(director_films)),
        "relationship": (
            "critical" if avg_rating < 3.5
            else "generous" if avg_rating > 4.0
            else "balanced"
        ),
    }


def compute_signature_duo(films_enriched: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """Find the most common director-actor combo and return a story."""
    if films_enriched.empty:
        return None
    if "director" not in films_enriched.columns or "cast" not in films_enriched.columns:
        return None

    director_actor_combos: List[Dict[str, str]] = []
    for _, film in films_enriched.iterrows():
        if pd.notna(film["director"]) and isinstance(film.get("cast"), list) and len(film["cast"]) > 0:
            director = film["director"]
            main_actor = next((a for a in film["cast"] if a != director), None)
            if main_actor:
                director_actor_combos.append({
                    "combo": f"{director}#{main_actor}",
                    "director": director,
                    "actor": main_actor,
                    "film": film["title"],
                })

    if not director_actor_combos:
        return None

    combo_counts = Counter(c["combo"] for c in director_actor_combos)
    top_combo = combo_counts.most_common(1)[0]
    combo_info = next((c for c in director_actor_combos if c["combo"] == top_combo[0]), None)
    if not combo_info:
        return None

    if top_combo[1] >= 3:
        combo_story = (
            f"You've got a serious thing for {combo_info['director']} directing "
            f"{combo_info['actor']}. {top_combo[1]} films together? "
            "That's not coincidence, that's obsession."
        )
    elif top_combo[1] == 2:
        combo_story = (
            f"{combo_info['director']} + {combo_info['actor']} = your comfort zone. "
            f"{top_combo[1]} films prove it."
        )
    else:
        combo_story = (
            f"Your go-to combo: {combo_info['director']} directing {combo_info['actor']}."
        )

    return {
        "director": combo_info["director"],
        "actor": combo_info["actor"],
        "count": top_combo[1],
        "story": combo_story,
    }


def compute_popularity_info(films_enriched: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """Compute mainstream/niche popularity percentages."""
    if films_enriched.empty or "popularity" not in films_enriched.columns:
        return None
    popularity_scores = films_enriched["popularity"].dropna()
    if popularity_scores.empty:
        return None
    avg_popularity = float(popularity_scores.mean())
    return {
        "average": round(avg_popularity, 1),
        "mainstream_pct": round(float((popularity_scores > 20).mean() * 100), 1),
        "niche_pct": round(float((popularity_scores < 5).mean() * 100), 1),
    }


def compute_favorite_genre_combo(films_enriched: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """Find the most common two-genre combination."""
    if films_enriched.empty or "genres" not in films_enriched.columns:
        return None
    genre_combinations: List[str] = []
    for genres in films_enriched["genres"].dropna():
        if isinstance(genres, list) and len(genres) >= 2:
            genre_combinations.append(f"{genres[0]}-{genres[1]}")
    if genre_combinations:
        combo_counts = Counter(genre_combinations)
        top_combo = combo_counts.most_common(1)[0]
        return {
            "combination": top_combo[0],
            "count": top_combo[1],
        }
    return None


async def compute_director_profiles(
    session: aiohttp.ClientSession,
    films_enriched: pd.DataFrame,
    films_df: pd.DataFrame,
    director_counts: Counter,
    logger: Any,
) -> Dict[str, Any]:
    """Build director film maps, fetch TMDB profile paths, return top_directors.

    Returns dict with keys: top_directors, total_directors, most_watched_director,
    and director_profile_map (internal cache).
    """
    result: Dict[str, Any] = {}

    # Build director→films map
    rating_by_film = _build_rating_lookup(films_df)
    director_films_map: Dict[str, List[Dict[str, Any]]] = {}
    for _, row in films_enriched.iterrows():
        d = row.get("director")
        if pd.notna(d):
            year_val = row.get("year", "")
            year_str = _clean_year_str(year_val)
            director_films_map.setdefault(str(d), []).append({
                "title": str(row.get("title", "")),
                "year": year_str,
                "poster_path": row.get("poster_path") if isinstance(row.get("poster_path"), str) else "",
                "user_rating": rating_by_film.get((str(row.get("title", "")), year_str)),
            })

    director_profile_map: Dict[str, Optional[str]] = {}
    for name, _count in director_counts.most_common(20):
        profile_path = None
        search_source: Optional[str] = None
        try:
            person_data = await search_person_with_fallback(session, name, role="director")
            if person_data and person_data.get("results"):
                pp = person_data["results"][0].get("profile_path")
                if isinstance(pp, str) and pp:
                    profile_path = pp
                    search_source = "tmdb_search"

            if not profile_path:
                films = director_films_map.get(name, [])
                if films:
                    profile_path = await find_person_by_film_credit(session, name, films)
                    if profile_path:
                        search_source = "film_credit"
        except Exception as exc:
            logger.warning("[profile-debug] director '%s' lookup failed: %s", name, exc)
        director_profile_map[name] = profile_path
        if not profile_path:
            logger.info("[profile-debug] director '%s' NO IMAGE (source=%s)", name, search_source or "none")

    result["top_directors"] = [
        {
            "name": n,
            "count": c,
            "profile_path": director_profile_map.get(n),
            "films": director_films_map.get(n, []),
        }
        for n, c in director_counts.most_common(20)
    ]
    result["total_directors"] = len(director_counts)
    if director_counts:
        n, c = director_counts.most_common(1)[0]
        result["most_watched_director"] = {
            "name": n,
            "count": c,
            "profile_path": director_profile_map.get(n),
        }
    else:
        result["most_watched_director"] = None

    result["_director_profile_map"] = director_profile_map
    result["_director_films_map"] = director_films_map
    result["_rating_by_film"] = rating_by_film

    return result


async def compute_actor_profiles(
    session: aiohttp.ClientSession,
    films_enriched: pd.DataFrame,
    films_df: pd.DataFrame,
    cast_counts: Counter,
    logger: Any,
) -> Dict[str, Any]:
    """Fetch TMDB profile paths for top actors.

    Returns dict with keys: top_actors (complete list) and _actor_films_map.
    """
    rating_by_film = _build_rating_lookup(films_df)

    actor_films_map: Dict[str, List[Dict[str, Any]]] = {}
    for _, row in films_enriched.iterrows():
        cast_list = row.get("cast")
        if isinstance(cast_list, list):
            year_val = row.get("year", "")
            year_str = _clean_year_str(year_val)
            film_info = {
                "title": str(row.get("title", "")),
                "year": year_str,
                "poster_path": row.get("poster_path") if isinstance(row.get("poster_path"), str) else "",
                "user_rating": rating_by_film.get((str(row.get("title", "")), year_str)),
            }
            for actor in cast_list:
                actor_films_map.setdefault(actor, []).append(film_info)

    top_actors_with_profiles: List[Dict[str, Any]] = []
    for name, count in cast_counts.most_common(4):
        profile_path: Optional[str] = None
        search_source: Optional[str] = None
        try:
            person_data = await search_person_with_fallback(session, name, role="actor")
            if person_data and person_data.get("results"):
                pp = person_data["results"][0].get("profile_path")
                if isinstance(pp, str) and pp:
                    profile_path = pp
                    search_source = "tmdb_search"

            if not profile_path:
                films = actor_films_map.get(name, [])
                if films:
                    profile_path = await find_person_by_film_credit(session, name, films)
                    if profile_path:
                        search_source = "film_credit"
        except Exception as exc:
            logger.warning("[profile-debug] actor '%s' lookup failed: %s", name, exc)
        top_actors_with_profiles.append({
            "name": name,
            "count": count,
            "profile_path": profile_path,
            "films": actor_films_map.get(name, []),
        })
        if not profile_path:
            logger.info("[profile-debug] actor '%s' NO IMAGE (source=%s)", name, search_source or "none")

    remaining_actors = [
        {"name": n, "count": c, "films": actor_films_map.get(n, [])}
        for n, c in cast_counts.most_common(20)[4:]
    ]

    return {
        "top_actors": top_actors_with_profiles + remaining_actors,
        "_actor_films_map": actor_films_map,
        "_actor_profile_map": {a["name"]: a.get("profile_path") for a in top_actors_with_profiles},
    }


def compute_directors_with_ratings(
    director_counts: Counter,
    analysis_df: pd.DataFrame,
) -> List[Dict[str, Any]]:
    """Compute sorted list of directors with at least min_rated ratings."""
    return _rated_entity_rows("director", director_counts, analysis_df, min_rated=3)


def compute_actors_with_ratings(
    cast_counts: Counter,
    analysis_df: pd.DataFrame,
    actor_profile_map: Dict[str, Optional[str]],
) -> List[Dict[str, Any]]:
    """Compute sorted list of actors with at least 3 ratings."""
    actor_rated: Dict[str, List[float]] = {}
    if "cast" in analysis_df.columns and "rating" in analysis_df.columns:
        for _, row in analysis_df.iterrows():
            rating = _clean_rating(row.get("rating"))
            cast = row.get("cast")
            if rating is None or not isinstance(cast, list):
                continue
            for actor in cast:
                actor_rated.setdefault(actor, []).append(rating)

    result = []
    for actor, ratings in actor_rated.items():
        if len(ratings) >= 3:
            result.append({
                "name": actor,
                "count": int(cast_counts.get(actor, 0)),
                "avg_rating": round(float(sum(ratings) / len(ratings)), 2),
                "rated_count": len(ratings),
                "profile_path": actor_profile_map.get(actor),
            })

    return sorted(result, key=lambda row: (row["avg_rating"], row["rated_count"]), reverse=True)


async def resolve_profile_paths(
    session: aiohttp.ClientSession,
    entities: List[Dict[str, Any]],
    role: str,
    films_map: Dict[str, List[Dict[str, Any]]],
    cache: Dict[str, Optional[str]],
    logger: Any,
    limit: int = 4,
) -> None:
    """Backfill profile_path for the first N entities using TMDB search + film credit fallback.
    Mutates entities in-place.
    """
    for row in entities[:limit]:
        name = row.get("name")
        if not name:
            continue
        if name in cache:
            row["profile_path"] = cache[name]
            continue
        pp: Optional[str] = None
        try:
            data = await search_person_with_fallback(session, name, role=role)
            if data and data.get("results"):
                cand = data["results"][0].get("profile_path")
                if isinstance(cand, str) and cand:
                    pp = cand
            if not pp:
                films = films_map.get(name, [])
                if films:
                    pp = await find_person_by_film_credit(session, name, films)
        except Exception as exc:
            logger.warning("[profile-debug] rated %s '%s' lookup failed: %s", role, name, exc)
        cache[name] = pp
        row["profile_path"] = pp


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_rating_lookup(films_df: pd.DataFrame) -> Dict[tuple, Optional[float]]:
    """Build {(title, year_str): rating} lookup dict."""
    lookup: Dict[tuple, Optional[float]] = {}
    if "rating" not in films_df.columns:
        return lookup
    for _, r in films_df.iterrows():
        y = r.get("year", "")
        ys = ""
        if pd.notna(y):
            try:
                ys = str(int(y))
            except (ValueError, TypeError):
                ys = str(y)
        rv = r.get("rating")
        lookup[(str(r.get("title", "")), ys)] = float(rv) if pd.notna(rv) else None
    return lookup


def _clean_year_str(value: Any) -> str:
    if pd.isna(value):
        return ""
    try:
        return str(int(value))
    except (ValueError, TypeError):
        return ""


def _clean_year(value: Any) -> Optional[int]:
    try:
        if pd.isna(value):
            return None
        return int(value)
    except Exception:
        return None


def _clean_rating(value: Any) -> Optional[float]:
    try:
        if pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def _rated_entity_rows(
    entity_column: str,
    count_source: Counter,
    analysis_df: pd.DataFrame,
    min_rated: int = 3,
) -> List[Dict[str, Any]]:
    """Build sorted list of entity (director/actor) by avg rating >= min_rated reviews."""
    rows: List[Dict[str, Any]] = []
    if entity_column not in analysis_df.columns or "rating" not in analysis_df.columns:
        return rows
    for name, count in count_source.items():
        rated = analysis_df[
            (analysis_df[entity_column] == name) & analysis_df["rating"].notna()
        ]["rating"]
        if len(rated) >= min_rated:
            rows.append({
                "name": name,
                "count": int(count),
                "avg_rating": round(float(rated.mean()), 2),
                "rated_count": int(len(rated)),
            })
    return sorted(rows, key=lambda row: (row["avg_rating"], row["rated_count"]), reverse=True)
