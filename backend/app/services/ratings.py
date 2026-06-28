"""
Rating analysis for Letterboxd Wrapped.

Extracted from the analysis.py god function. Computes all rating-related
metrics: distributions, personalities, guilty pleasures, and outliers.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Optional

import pandas as pd


def compute_rating_stats(films_df: pd.DataFrame) -> Dict[str, Any]:
    """Compute basic rating stats: avg, median, distribution, mode.

    Always sets default keys so frontend never encounters missing-key errors.
    """
    stats: Dict[str, Any] = {}
    stats["average_rating"] = None
    stats["median_rating"] = None
    stats["rating_distribution"] = {}
    stats["total_rated_films"] = 0
    stats["most_common_rating"] = None

    if "rating" in films_df.columns and films_df["rating"].notna().any():
        ratings = films_df["rating"].dropna()
        stats["average_rating"] = round(float(ratings.mean()), 2)
        stats["median_rating"] = round(float(ratings.median()), 1)
        stats["rating_distribution"] = ratings.value_counts().sort_index().to_dict()
        stats["total_rated_films"] = int(len(ratings))
        stats["most_common_rating"] = float(ratings.mode().iloc[0]) if not ratings.mode().empty else None

    return stats


def compute_rating_personality(films_df: pd.DataFrame) -> Optional[str]:
    """Return a labelled rating-personality string (or None)."""
    if "rating" not in films_df.columns:
        return None
    ratings = films_df["rating"].dropna()
    if ratings.empty:
        return None
    avg_rating = float(ratings.mean())
    std_dev = float(ratings.std())
    if avg_rating > 4.0:
        return "The Generous Critic"
    elif avg_rating < 3.0:
        return "The Picky Gourmet"
    elif std_dev > 1.2:
        return "The All-or-Nothing Judge"
    else:
        return "The Balanced Reviewer"


def compute_fun_rating_stats(
    films_enriched: pd.DataFrame,
    films_df: pd.DataFrame,
) -> Dict[str, Any]:
    """Compute fun stats related to ratings: guilty pleasure, rating outlier.

    Returns a dict that should be merged into stats['fun_statistics'].
    """
    result: Dict[str, Any] = {}

    if films_enriched.empty:
        return result

    if "vote_average" in films_enriched.columns and "rating" in films_df.columns:
        enriched_with_ratings = pd.merge(
            films_enriched,
            films_df[["title", "year", "rating"]],
            on=["title", "year"],
            how="left",
        )

        # Guilty pleasure: low TMDB rating but you gave it 4+
        guilty_candidates = enriched_with_ratings[
            (enriched_with_ratings["vote_average"] < 6.0)
            & (enriched_with_ratings["rating"] >= 4.0)
        ]
        if not guilty_candidates.empty:
            guilty_pleasure = guilty_candidates.loc[guilty_candidates["vote_average"].idxmin()]
            result["guilty_pleasure"] = {
                "title": guilty_pleasure["title"],
                "tmdb_rating": round(float(guilty_pleasure["vote_average"]), 1),
                "your_rating": float(guilty_pleasure["rating"]),
            }

        # Rating outlier — the film where your rating diverges most from TMDB community
        outlier_candidates = enriched_with_ratings.dropna(subset=["vote_average", "rating"])
        if not outlier_candidates.empty:
            deltas = (outlier_candidates["rating"] * 2.0) - outlier_candidates["vote_average"]
            idx = deltas.abs().idxmax()
            pick = outlier_candidates.loc[idx]
            poster_path = pick.get("poster_path")
            try:
                year_clean: Optional[int] = None if pd.isna(pick.get("year")) else int(pick["year"])
            except (ValueError, TypeError):
                year_clean = None
            result["rating_outlier_film"] = {
                "title": str(pick.get("title") or ""),
                "year": year_clean,
                "poster_path": poster_path if isinstance(poster_path, str) else "",
                "user_rating": float(pick["rating"]),
                "avg_rating": round(float(pick["vote_average"]), 1),
                "delta": round(float(deltas.loc[idx]), 1),
            }

    return result


def compute_budget_revenue_analytics(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute budget, revenue, and popularity analytics."""
    result: Dict[str, Any] = {}

    if films_enriched.empty:
        return result

    valid_budgets = films_enriched[films_enriched["budget"] > 0]["budget"]
    valid_revenues = films_enriched[films_enriched["revenue"] > 0]["revenue"]

    if not valid_budgets.empty:
        result["budget_analytics"] = {
            "average_budget": float(valid_budgets.mean()),
            "median_budget": float(valid_budgets.median()),
            "total_budget_watched": float(valid_budgets.sum()),
            "highest_budget": float(valid_budgets.max()),
            "budget_range_preference": (
                "high" if valid_budgets.median() > 50_000_000
                else "medium" if valid_budgets.median() > 10_000_000
                else "low"
            ),
        }

    if not valid_revenues.empty:
        result["revenue_analytics"] = {
            "average_revenue": float(valid_revenues.mean()),
            "median_revenue": float(valid_revenues.median()),
            "total_revenue_watched": float(valid_revenues.sum()),
            "highest_revenue": float(valid_revenues.max()),
        }

    valid_popularity = films_enriched[films_enriched["popularity"] > 0]["popularity"]
    if not valid_popularity.empty:
        result["popularity_analytics"] = {
            "average_popularity": float(valid_popularity.mean()),
            "median_popularity": float(valid_popularity.median()),
            "popularity_variance": float(valid_popularity.std()) if len(valid_popularity) > 1 else 0,
            "mainstream_percentage": float((valid_popularity > 20).mean() * 100),
            "niche_percentage": float((valid_popularity < 5).mean() * 100),
        }

    return result


def compute_highest_budget_film(films_enriched: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """Return the film with the highest budget."""
    if films_enriched.empty or "budget" not in films_enriched.columns:
        return None
    max_budget_film = films_enriched.loc[films_enriched["budget"].idxmax()]
    if pd.notna(max_budget_film["budget"]) and max_budget_film["budget"] > 0:
        return {
            "title": max_budget_film["title"],
            "budget": int(max_budget_film["budget"]),
        }
    return None


def compute_highest_grossing_film(films_enriched: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """Return the film with the highest revenue."""
    if films_enriched.empty or "revenue" not in films_enriched.columns:
        return None
    max_revenue_film = films_enriched.loc[films_enriched["revenue"].idxmax()]
    if pd.notna(max_revenue_film["revenue"]) and max_revenue_film["revenue"] > 0:
        return {
            "title": max_revenue_film["title"],
            "revenue": int(max_revenue_film["revenue"]),
        }
    return None