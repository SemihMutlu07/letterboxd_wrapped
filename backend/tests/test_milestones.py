"""Unit tests for the milestones module (Nth-watched-film share card data)."""

from __future__ import annotations

import pandas as pd

from app.services.milestones import compute_milestones


def _diary(n: int) -> pd.DataFrame:
    """n dated diary rows, watched one day apart, titled Film0..Film{n-1}."""
    dates = pd.date_range("2020-01-01", periods=n, freq="D")
    df = pd.DataFrame({
        "Name": [f"Film{i}" for i in range(n)],
        "Year": [2020] * n,
        "Watched Date": dates.strftime("%Y-%m-%d"),
    })
    df["parsed_date"] = pd.to_datetime(df["Watched Date"])
    return df


class TestComputeMilestones:
    def test_empty_diary_returns_empty_list(self):
        assert compute_milestones(pd.DataFrame(), pd.DataFrame()) == {"milestones": []}

    def test_no_parsed_date_column_returns_empty_list(self):
        diary_df = pd.DataFrame({"Name": ["A"], "Year": [2020]})
        assert compute_milestones(diary_df, pd.DataFrame()) == {"milestones": []}

    def test_fewer_than_100_films_returns_empty_list(self):
        result = compute_milestones(_diary(50), pd.DataFrame())
        assert result["milestones"] == []

    def test_exactly_100_films_reaches_first_threshold(self):
        result = compute_milestones(_diary(100), pd.DataFrame())
        assert [m["ordinal"] for m in result["milestones"]] == [100]
        assert result["milestones"][0]["title"] == "Film99"

    def test_250_films_only_reaches_100(self):
        result = compute_milestones(_diary(250), pd.DataFrame())
        assert [m["ordinal"] for m in result["milestones"]] == [100]

    def test_1000_films_reaches_all_thresholds(self):
        result = compute_milestones(_diary(1000), pd.DataFrame())
        assert [m["ordinal"] for m in result["milestones"]] == [100, 300, 500, 750]
        assert result["milestones"][3]["title"] == "Film749"

    def test_tied_watch_dates_broken_by_original_row_order(self):
        diary_df = _diary(100)
        # Make rows 98 and 99 (0-indexed) share the same parsed_date as row 99.
        diary_df.loc[98, "parsed_date"] = diary_df.loc[99, "parsed_date"]
        result = compute_milestones(diary_df, pd.DataFrame())
        # Stable sort keeps original row order for ties -> row 99 (Film99) stays last.
        assert result["milestones"][0]["title"] == "Film99"

    def test_poster_looked_up_from_films_enriched(self):
        films_enriched = pd.DataFrame({
            "title": ["Film99"],
            "year": [2020],
            "poster_path": ["/poster99.jpg"],
        })
        result = compute_milestones(_diary(100), films_enriched)
        assert result["milestones"][0]["poster_path"] == "/poster99.jpg"

    def test_no_poster_match_gives_empty_string_not_crash(self):
        result = compute_milestones(_diary(100), pd.DataFrame({"title": [], "year": [], "poster_path": []}))
        assert result["milestones"][0]["poster_path"] == ""
