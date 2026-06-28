"""
Geography analysis for Letterboxd Wrapped.

Extracted from the analysis.py god function. Computes country, language,
and keyword analytics.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Country flags for fun visual display
# ---------------------------------------------------------------------------
_COUNTRY_FLAGS: Dict[str, str] = {
    "United States": "\U0001f1fa\U0001f1f8",
    "France": "\U0001f1eb\U0001f1f7",
    "United Kingdom": "\U0001f1ec\U0001f1e7",
    "Japan": "\U0001f1ef\U0001f1f5",
    "Italy": "\U0001f1ee\U0001f1f9",
    "Germany": "\U0001f1e9\U0001f1ea",
    "South Korea": "\U0001f1f0\U0001f1f7",
    "Spain": "\U0001f1ea\U0001f1f8",
    "Canada": "\U0001f1e8\U0001f1e6",
    "India": "\U0001f1ee\U0001f1f3",
    "China": "\U0001f1e8\U0001f1f3",
    "Australia": "\U0001f1e6\U0001f1fa",
    "Russia": "\U0001f1f7\U0001f1fa",
    "Brazil": "\U0001f1e7\U0001f1f7",
    "Mexico": "\U0001f1f2\U0001f1fd",
}


def compute_keyword_analytics(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute keyword analytics from enriched film data."""
    result: Dict[str, Any] = {}

    if films_enriched.empty or "keywords_full" not in films_enriched.columns:
        return result

    all_keywords: List[str] = []
    for keywords_list in films_enriched["keywords_full"].dropna():
        if isinstance(keywords_list, list):
            all_keywords.extend(
                kw.get("name", "") for kw in keywords_list if isinstance(kw, dict)
            )

    if all_keywords:
        keyword_counts = Counter(all_keywords)
        result["keywords_analytics"] = {
            "total_unique_keywords": len(keyword_counts),
            "top_keywords": [
                {"keyword": k, "count": v}
                for k, v in keyword_counts.most_common(20)
            ],
            "keyword_diversity": (
                len(keyword_counts) / len(all_keywords) if all_keywords else 0
            ),
        }

    return result


def compute_country_analytics(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute detailed country analytics."""
    result: Dict[str, Any] = {}

    if films_enriched.empty or "production_countries" not in films_enriched.columns:
        return result

    all_countries: List[str] = []
    for countries_list in films_enriched["production_countries"].dropna():
        if isinstance(countries_list, list):
            all_countries.extend(
                c.get("name", "") for c in countries_list if isinstance(c, dict)
            )

    if all_countries:
        country_counts_adv = Counter(all_countries)
        result["countries_analytics"] = {
            "total_countries_explored": len(country_counts_adv),
            "top_countries_detailed": [
                {
                    "country": country,
                    "count": count,
                    "percentage": (count / len(all_countries)) * 100,
                }
                for country, count in country_counts_adv.most_common(10)
            ],
            "geographic_diversity": (
                len(country_counts_adv) / len(all_countries) if all_countries else 0
            ),
            "international_percentage": (
                float(
                    (1 - country_counts_adv.get("United States", 0) / len(all_countries))
                    * 100
                )
                if all_countries
                else 0
            ),
        }

    return result


def compute_country_language_stats(films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Compute top_countries, total_countries, and top_languages."""
    result: Dict[str, Any] = {}

    if films_enriched.empty or "countries" not in films_enriched.columns:
        return result

    country_counts: Counter = Counter()
    for countries in films_enriched["countries"].dropna():
        if isinstance(countries, list):
            country_counts.update(countries)

    result["top_countries"] = [
        {"name": n, "count": c} for n, c in country_counts.most_common(15)
    ]
    result["total_countries"] = len(country_counts)

    language_counts: Counter = Counter()
    for lang in films_enriched["language"].dropna():
        language_counts[lang] += 1

    result["top_languages"] = [
        {"language": lang, "count": cnt}
        for lang, cnt in language_counts.most_common(10)
    ]

    return result


def compute_country_iso_data(analysis_df: pd.DataFrame) -> Dict[str, Any]:
    """Compute ISO country data and country-with-ratings list."""
    result: Dict[str, Any] = {}

    country_iso_counts: Counter = Counter()
    country_iso_names: Dict[str, str] = {}
    country_iso_ratings: Dict[str, List[float]] = {}
    country_name_ratings: Dict[str, List[float]] = {}

    if "production_countries" not in analysis_df.columns:
        return result

    has_rating = "rating" in analysis_df.columns

    for _, row in analysis_df.iterrows():
        rating = float(row["rating"]) if has_rating and pd.notna(row.get("rating")) else None
        production_countries = row.get("production_countries")
        if not isinstance(production_countries, list):
            continue
        for country in production_countries:
            if not isinstance(country, dict):
                continue
            iso2 = country.get("iso_3166_1")
            name = country.get("name")
            if name:
                country_name_ratings.setdefault(name, [])
                if rating is not None:
                    country_name_ratings[name].append(rating)
            if not iso2 or not name:
                continue
            country_iso_counts[iso2] += 1
            country_iso_names[iso2] = name
            if rating is not None:
                country_iso_ratings.setdefault(iso2, []).append(rating)

    result["countries_iso_data"] = []
    for iso2, count in country_iso_counts.most_common():
        ratings = country_iso_ratings.get(iso2, [])
        item: Dict[str, Any] = {
            "iso2": iso2,
            "name": country_iso_names.get(iso2, iso2),
            "count": int(count),
        }
        if len(ratings) >= 5:
            item["avg_rating"] = round(float(sum(ratings) / len(ratings)), 2)
            item["rated_count"] = len(ratings)
        result["countries_iso_data"].append(item)

    result["countries_with_ratings"] = sorted(
        [
            {
                "name": name,
                "count": 0,  # backfilled below
                "avg_rating": round(float(sum(ratings) / len(ratings)), 2),
                "rated_count": len(ratings),
            }
            for name, ratings in country_name_ratings.items()
            if len(ratings) >= 5
        ],
        key=lambda row: (row["avg_rating"], row["rated_count"]),
        reverse=True,
    )

    return result


def compute_world_tour(countries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build a 'world tour' list with flag emoji for the top 5 countries."""
    return [
        {
            "country": c["name"],
            "flag": _COUNTRY_FLAGS.get(c["name"], "\U0001f3ac"),
            "count": c["count"],
        }
        for c in countries[:5]
    ]