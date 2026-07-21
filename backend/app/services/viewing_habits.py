"""
Viewing-habit analytics for Letterboxd Wrapped.

Extracted from the analysis.py orchestrator (formerly inline Sections 4 and
7): rewatch-champion detection and date/timeline analytics. Both are pure
functions over already-loaded DataFrames — no TMDB/network/task_manager
dependency — which is what makes them worth pulling out and unit-testing
directly instead of only exercising them through the full pipeline.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import pandas as pd


def compute_rewatch_champions(diary_df: pd.DataFrame, films_enriched: pd.DataFrame) -> Dict[str, Any]:
    """Diary-derived rewatch stats: total distinct diary films + the top-5
    most-rewatched (>=2 watches), each with a poster looked up from
    films_enriched when available."""
    diary_film_count = 0
    rewatch_champions: list[dict] = []

    if not diary_df.empty and "Name" in diary_df.columns:
        diary_year_col = "Year" if "Year" in diary_df.columns else None
        group_cols = ["Name", diary_year_col] if diary_year_col else ["Name"]
        watches_per_film = diary_df.groupby(group_cols, dropna=False).size().reset_index(name="watch_count")
        diary_film_count = int(len(watches_per_film))
        top_rewatched = watches_per_film[watches_per_film["watch_count"] >= 2].sort_values(
            "watch_count", ascending=False
        ).head(5)
        for _, row in top_rewatched.iterrows():
            title = str(row.get("Name") or "")
            year_val = row.get(diary_year_col) if diary_year_col else None
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
            rewatch_champions.append({
                "title": title,
                "year": year_int,
                "poster_path": poster,
                "watch_count": int(row["watch_count"]),
            })

    return {"diary_film_count": diary_film_count, "rewatch_champions": rewatch_champions}


def compute_date_analytics(diary_df: pd.DataFrame, watched_df: pd.DataFrame) -> Dict[str, Any]:
    """Monthly/weekday viewing habits + a human "period description" timeline.

    Prefers diary dates (needs >=5 valid entries to be meaningful), falling
    back to watched.csv dates otherwise. Returns {} if neither source yields
    usable dates — callers should stats.update(...) the result so missing
    keys behave exactly like the original inline code (no keys ever unset).

    Side effect (preserved intentionally): mutates diary_df/watched_df in
    place by adding a "parsed_date" column, matching pandas pass-by-reference
    semantics of the original inline code — compute_story_analytics() later
    branches on `"parsed_date" in diary_df.columns`, so callers must pass the
    same diary_df object through to that call afterward.
    """
    if not diary_df.empty:
        date_column = None
        for col in ["Watched Date", "Date", "Watch Date", "Watched", "Date Watched", "WatchedDate"]:
            if col in diary_df.columns:
                date_column = col
                break

        if date_column:
            diary_df["parsed_date"] = pd.to_datetime(diary_df[date_column], errors="coerce")
            valid_dates = diary_df.dropna(subset=["parsed_date"])
        else:
            valid_dates = pd.DataFrame()
    else:
        date_column = None
        valid_dates = pd.DataFrame()

    date_data = None

    if date_column and not valid_dates.empty and len(valid_dates) >= 5:
        date_data = valid_dates

    if date_data is None and not watched_df.empty:
        watched_date_col = None
        for col in ["Date", "Watched Date", "Watch Date"]:
            if col in watched_df.columns:
                watched_date_col = col
                break

        if watched_date_col:
            watched_df["parsed_date"] = pd.to_datetime(watched_df[watched_date_col], errors="coerce")
            watched_valid = watched_df.dropna(subset=["parsed_date"])
            if not watched_valid.empty:
                date_data = watched_valid

    if date_data is None:
        return {}

    date_data["year_month"] = date_data["parsed_date"].dt.strftime("%Y-%m")
    monthly_counts = date_data["year_month"].value_counts().sort_index()
    monthly_viewing_habits = [
        {"month": ym, "count": int(cnt)} for ym, cnt in monthly_counts.items()
    ]

    date_data["day_of_week"] = date_data["parsed_date"].dt.dayofweek
    day_of_week_pattern = {
        "weekday": len(date_data[date_data["day_of_week"] < 5]),
        "weekend": len(date_data[date_data["day_of_week"] >= 5]),
    }

    earliest_date = date_data["parsed_date"].min()
    latest_date = date_data["parsed_date"].max()
    total_days = (latest_date - earliest_date).days

    if total_days == 0:
        total_days = 1
    elif total_days < 30:
        total_days = max(total_days, 7)

    if total_days == 1:
        period_description = f"Analyzing your cinematic moment on {earliest_date.strftime('%B %d, %Y')}"
    elif total_days <= 365:
        period_description = f"Analyzing your last {total_days} days of cinematic history"
    elif total_days <= 730:
        period_description = f"Exploring {total_days} days of your film journey"
    else:
        years = total_days // 365
        period_description = f"Journeying through {years} years of your cinematic legacy"

    return {
        "monthly_viewing_habits": monthly_viewing_habits,
        "day_of_week_pattern": day_of_week_pattern,
        "data_timeline": {
            "earliest_date": earliest_date.isoformat(),
            "latest_date": latest_date.isoformat(),
            "total_days": total_days,
            "period_description": period_description,
        },
    }
