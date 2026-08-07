"""
Milestone-film analytics for Letterboxd Wrapped share cards.

Computes which film was the user's Nth chronologically-watched film, for a
fixed set of round-number thresholds. Depends on diary_df already having a
"parsed_date" column — set by compute_date_analytics(), which must run first
and mutate the same diary_df object passed in here (see viewing_habits.py).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import pandas as pd

MILESTONE_THRESHOLDS = (100, 300, 500, 750)


def compute_milestones(diary_df: pd.DataFrame, films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Chronological Nth-watched-film milestones for N in MILESTONE_THRESHOLDS.

    Only includes thresholds the user has actually reached (e.g. a user with
    250 dated diary entries gets only the 100th-film milestone). Ties on the
    same watch date are broken by original diary row order via a stable sort,
    so results are deterministic across runs.
    """
    if diary_df.empty or "parsed_date" not in diary_df.columns or "Name" not in diary_df.columns:
        return {"milestones": []}

    valid = diary_df.dropna(subset=["parsed_date"])
    if valid.empty:
        return {"milestones": []}

    ordered = valid.sort_values("parsed_date", kind="mergesort").reset_index(drop=True)

    milestones: list[dict] = []
    for n in MILESTONE_THRESHOLDS:
        if n > len(ordered):
            break
        row = ordered.iloc[n - 1]
        title = str(row.get("Name") or "")
        year_val = row.get("Year") if "Year" in ordered.columns else None
        try:
            year_int: Optional[int] = None if year_val is None or pd.isna(year_val) else int(year_val)
        except Exception:
            year_int = None

        poster = ""
        if not films_enriched.empty and "title" in films_enriched.columns:
            match = films_enriched[films_enriched["title"] == title]
            if year_int is not None and "year" in films_enriched.columns:
                match = match[match["year"] == year_int]
            if not match.empty:
                pp = match.iloc[0].get("poster_path")
                if isinstance(pp, str):
                    poster = pp

        milestones.append({
            "ordinal": n,
            "title": title,
            "year": year_int,
            "poster_path": poster,
            "watched_date": row["parsed_date"].isoformat(),
        })

    return {"milestones": milestones}
