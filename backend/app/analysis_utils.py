# backend/app/analysis_utils.py
# Cinema Scale v2 — entropy-based diversity scoring
import math
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd


def _shannon_entropy(counts: List[int]) -> float:
    """Shannon entropy in bits for a list of counts. Returns 0 for empty/single."""
    total = sum(counts)
    if total == 0:
        return 0.0
    probs = [c / total for c in counts if c > 0]
    return -sum(p * math.log2(p) for p in probs)


def _normalized_entropy(counts: List[int]) -> float:
    """Entropy normalized to [0, 1]. Returns 0 when ≤1 category."""
    n_categories = sum(1 for c in counts if c > 0)
    if n_categories <= 1:
        return 0.0
    max_entropy = math.log2(n_categories)
    if max_entropy == 0:
        return 0.0
    return _shannon_entropy(counts) / max_entropy


def _top_share(counts: List[int], top_n: int = 1) -> float:
    """Fraction of total held by the top_n categories."""
    total = sum(counts)
    if total == 0:
        return 0.0
    sorted_counts = sorted(counts, reverse=True)
    return sum(sorted_counts[:top_n]) / total


def compute_cinema_scale_inputs(
    films_enriched: pd.DataFrame,
    genre_counts: Counter,
    director_counts: Counter,
) -> Dict[str, Any]:
    """Build the keyword-argument dict for compute_cinema_scale() from an
    enriched film DataFrame: median release year + country/decade/language
    Counters. genre_counts/director_counts are computed earlier in the
    pipeline (they need films_df + TMDB profile data) and are passed through
    unchanged so callers can do a single `compute_cinema_scale(**inputs)`."""
    median_release_year = None
    if "release_date" in films_enriched.columns:
        release_years = (
            films_enriched["release_date"]
            .dropna()
            .apply(lambda d: int(str(d)[:4]) if d and len(str(d)) >= 4 else None)
            .dropna()
        )
        if not release_years.empty:
            median_release_year = int(release_years.median())

    country_counts = Counter(
        c for countries in films_enriched["countries"].dropna()
        if isinstance(countries, list) for c in countries
    ) if "countries" in films_enriched.columns else Counter()

    decade_counts = Counter(films_enriched["decade"].dropna()) if "decade" in films_enriched.columns else Counter()
    language_counts = Counter(films_enriched["language"].dropna()) if "language" in films_enriched.columns else Counter()

    return {
        "country_counts": country_counts,
        "decade_counts": decade_counts,
        "language_counts": language_counts,
        "genre_counts": genre_counts,
        "director_counts": director_counts,
        "total_films": len(films_enriched),
        "median_release_year": median_release_year,
    }


def compute_cinema_scale(
    country_counts: Counter,
    decade_counts: Counter,
    language_counts: Counter,
    genre_counts: Counter,
    director_counts: Counter,
    total_films: int,
    median_release_year: int | None,
    current_year: int | None = None,
) -> Dict[str, Any]:
    """
    Compute a 0-100 cinema diversity score (model_version cine_v2).

    Axes and max points:
        geography  25   — country entropy + dominance penalty
        temporal   20   — decade entropy (12) + median-age bonus (8)
        languages  15   — language entropy + dominance penalty
        volume     15   — log10(total_films) scaled
        genres     15   — genre-tag entropy
        directors  10   — inverse top-3 concentration

    Returns dict ready to be stored as stats['sinefil_meter'].
    """
    if current_year is None:
        current_year = datetime.now().year

    # --- Geography (0-25) ---
    geo_vals = list(country_counts.values())
    geo_norm = _normalized_entropy(geo_vals)
    geo_dom = 0.6 if _top_share(geo_vals) > 0.80 else 1.0
    geo_score = min(25, round(geo_norm * geo_dom * 25))

    # --- Temporal depth (0-20) ---
    dec_vals = list(decade_counts.values())
    dec_norm = _normalized_entropy(dec_vals)
    dec_entropy_pts = min(12, round(dec_norm * 12))

    years_back = 0
    if median_release_year is not None and median_release_year > 0:
        years_back = max(0, current_year - median_release_year)
    age_pts = min(8, round((years_back / 40) * 8))
    temporal_score = min(20, dec_entropy_pts + age_pts)

    # --- Languages (0-15) ---
    lang_vals = list(language_counts.values())
    lang_norm = _normalized_entropy(lang_vals)
    lang_dom = 0.5 if _top_share(lang_vals) > 0.85 else 1.0
    lang_score = min(15, round(lang_norm * lang_dom * 15))

    # --- Volume maturity (0-15) ---
    vol_score = min(15, round(math.log10(max(1, total_films)) * 6))

    # --- Genre breadth (0-15) ---
    genre_vals = list(genre_counts.values())
    genre_norm = _normalized_entropy(genre_vals)
    genre_score = min(15, round(genre_norm * 15))

    # --- Director exploration (0-10) ---
    dir_vals = list(director_counts.values())
    top3 = _top_share(dir_vals, top_n=3)
    dir_score = min(10, round((1 - top3) * 12))

    # --- Composite ---
    total_score = max(0, min(100,
        geo_score + temporal_score + lang_score + vol_score + genre_score + dir_score
    ))

    # --- Label ---
    if total_score >= 90:
        label = "Film Connoisseur"
        desc = "Exceptional diversity across geography, eras, and languages."
    elif total_score >= 80:
        label = "Arthouse Enthusiast"
        desc = "You actively seek international and historically rich cinema."
    elif total_score >= 70:
        label = "Independent Cinephile"
        desc = "Strong appreciation for diverse genres, directors, and origins."
    elif total_score >= 60:
        label = "Eclectic Viewer"
        desc = "A healthy mix of mainstream hits and off-the-beaten-path picks."
    elif total_score >= 50:
        label = "Curious Moviegoer"
        desc = "You venture beyond the mainstream more often than most."
    elif total_score >= 40:
        label = "Casual Viewer"
        desc = "Mostly popular fare with some variety sprinkled in."
    elif total_score >= 30:
        label = "Mainstream Fan"
        desc = "You stick to well-known, widely accessible films."
    else:
        label = "Blockbuster Lover"
        desc = "You love big-budget hits and popular entertainment."

    return {
        'score': total_score,
        'type': label,
        'description': desc,
        'breakdown': {
            'geography': geo_score,
            'temporal': temporal_score,
            'languages': lang_score,
            'volume': vol_score,
            'genres': genre_score,
            'directors': dir_score,
        },
        'model_version': 'cine_v2',
    }
