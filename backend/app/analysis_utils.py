# backend/app/analysis_utils.py
import numpy as np
import pandas as pd
from typing import Union, Any


def _to_scalar(x: Any) -> Union[int, float, str, None]:
    """
    Convert numpy scalar or 0-D array to Python scalar.
    For Series/Index, use mean() to reduce to scalar.
    Pass through native Python scalars.
    """
    if x is None or pd.isna(x):
        return None
    
    # Handle pandas Series/Index
    if isinstance(x, (pd.Series, pd.Index)):
        if len(x) == 0:
            return None
        return _to_scalar(x.mean())
    
    # Handle numpy arrays
    if isinstance(x, np.ndarray):
        if x.size == 0:
            return None
        if x.ndim == 0:  # 0-D array (scalar)
            return x.item()
        elif x.ndim == 1 and x.size == 1:  # 1-D array with single element
            return x.item()
        else:
            # For multi-element arrays, return mean
            return np.nanmean(x).item()
    
    # Handle numpy scalars
    if isinstance(x, (np.integer, np.floating)):
        return x.item()
    
    # Handle native Python types
    if isinstance(x, (int, float, str, bool)):
        return x
    
    # For other types, try to convert to float
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def safe_quantile(data: Union[np.ndarray, pd.Series], q: float, **kwargs) -> Union[float, None]:
    """Safely compute quantile and return Python scalar."""
    try:
        result = np.nanquantile(data, q, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_percentile(data: Union[np.ndarray, pd.Series], p: float, **kwargs) -> Union[float, None]:
    """Safely compute percentile and return Python scalar."""
    try:
        result = np.nanpercentile(data, p, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_mean(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute mean and return Python scalar."""
    try:
        result = np.nanmean(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_median(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute median and return Python scalar."""
    try:
        result = np.nanmedian(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_std(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute standard deviation and return Python scalar."""
    try:
        result = np.nanstd(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_sum(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute sum and return Python scalar."""
    try:
        result = np.nansum(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_max(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute maximum and return Python scalar."""
    try:
        result = np.nanmax(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


def safe_min(data: Union[np.ndarray, pd.Series], **kwargs) -> Union[float, None]:
    """Safely compute minimum and return Python scalar."""
    try:
        result = np.nanmin(data, **kwargs)
        return _to_scalar(result)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Cinema Scale v2 — entropy-based diversity scoring
# ---------------------------------------------------------------------------
import math
from collections import Counter
from datetime import datetime
from typing import Dict, List


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
