"""Unit tests for the viewing_habits module (extracted from analysis.py)."""

from __future__ import annotations

import pandas as pd
import pytest

from app.services.viewing_habits import compute_date_analytics, compute_rewatch_champions


class TestComputeRewatchChampions:
    def test_empty_diary_returns_zero_and_empty_list(self):
        result = compute_rewatch_champions(pd.DataFrame(), pd.DataFrame())
        assert result == {"diary_film_count": 0, "rewatch_champions": []}

    def test_single_watch_films_excluded_from_champions(self):
        diary_df = pd.DataFrame({"Name": ["A", "B"], "Year": [2020, 2021]})
        result = compute_rewatch_champions(diary_df, pd.DataFrame())
        assert result["diary_film_count"] == 2
        assert result["rewatch_champions"] == []

    def test_rewatched_film_included_with_watch_count(self):
        diary_df = pd.DataFrame({
            "Name": ["A", "A", "A", "B"],
            "Year": [2020, 2020, 2020, 2021],
        })
        result = compute_rewatch_champions(diary_df, pd.DataFrame())
        assert result["diary_film_count"] == 2  # 2 distinct (Name, Year) groups
        assert len(result["rewatch_champions"]) == 1
        champ = result["rewatch_champions"][0]
        assert champ["title"] == "A"
        assert champ["year"] == 2020
        assert champ["watch_count"] == 3

    def test_top_5_cap_and_descending_order(self):
        rows = []
        for i, count in enumerate([2, 5, 3, 4, 6, 2, 7]):  # 7 distinct rewatched films
            for _ in range(count):
                rows.append({"Name": f"Film{i}", "Year": 2020})
        diary_df = pd.DataFrame(rows)
        result = compute_rewatch_champions(diary_df, pd.DataFrame())
        assert len(result["rewatch_champions"]) == 5  # capped at 5
        counts = [c["watch_count"] for c in result["rewatch_champions"]]
        assert counts == sorted(counts, reverse=True)
        assert counts[0] == 7  # highest first

    def test_poster_looked_up_from_films_enriched_matching_title_and_year(self):
        diary_df = pd.DataFrame({"Name": ["A", "A"], "Year": [2020, 2020]})
        films_enriched = pd.DataFrame({
            "title": ["A", "A"],
            "year": [2020, 1999],
            "poster_path": ["/poster-2020.jpg", "/poster-1999.jpg"],
        })
        result = compute_rewatch_champions(diary_df, films_enriched)
        assert result["rewatch_champions"][0]["poster_path"] == "/poster-2020.jpg"

    def test_no_year_column_still_groups_by_name(self):
        diary_df = pd.DataFrame({"Name": ["A", "A"]})
        result = compute_rewatch_champions(diary_df, pd.DataFrame())
        assert result["diary_film_count"] == 1
        assert result["rewatch_champions"][0]["title"] == "A"
        assert result["rewatch_champions"][0]["year"] is None


class TestComputeDateAnalytics:
    def test_no_diary_no_watched_returns_empty_dict(self):
        assert compute_date_analytics(pd.DataFrame(), pd.DataFrame()) == {}

    def test_diary_with_5plus_valid_dates_is_used(self):
        diary_df = pd.DataFrame({
            "Watched Date": ["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15", "2026-03-01"],
        })
        result = compute_date_analytics(diary_df, pd.DataFrame())
        assert "monthly_viewing_habits" in result
        assert "day_of_week_pattern" in result
        assert "data_timeline" in result
        # side effect: diary_df must be mutated in place with parsed_date
        assert "parsed_date" in diary_df.columns

    def test_diary_with_fewer_than_5_dates_falls_back_to_watched(self):
        diary_df = pd.DataFrame({"Watched Date": ["2026-01-01", "2026-01-02"]})
        watched_df = pd.DataFrame({
            "Date": [f"2026-01-{d:02d}" for d in range(1, 8)],
        })
        result = compute_date_analytics(diary_df, watched_df)
        assert result != {}
        assert "parsed_date" in watched_df.columns

    def test_weekday_weekend_split(self):
        # 2026-01-05 is a Monday (weekday); 2026-01-10 is a Saturday (weekend)
        diary_df = pd.DataFrame({
            "Watched Date": ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-10"],
        })
        result = compute_date_analytics(diary_df, pd.DataFrame())
        assert result["day_of_week_pattern"]["weekday"] == 4
        assert result["day_of_week_pattern"]["weekend"] == 1

    def test_total_days_zero_clamped_to_one(self):
        diary_df = pd.DataFrame({"Watched Date": ["2026-01-01"] * 5})
        result = compute_date_analytics(diary_df, pd.DataFrame())
        assert result["data_timeline"]["total_days"] == 1
        assert "cinematic moment" in result["data_timeline"]["period_description"]

    def test_total_days_under_30_clamped_to_at_least_7(self):
        diary_df = pd.DataFrame({
            "Watched Date": ["2026-01-01", "2026-01-01", "2026-01-02", "2026-01-02", "2026-01-03"],
        })
        result = compute_date_analytics(diary_df, pd.DataFrame())
        assert result["data_timeline"]["total_days"] == 7

    def test_period_description_tiers(self):
        # <=365 days
        diary_df = pd.DataFrame({
            "Watched Date": ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-06-01"],
        })
        result = compute_date_analytics(diary_df, pd.DataFrame())
        assert "days of cinematic history" in result["data_timeline"]["period_description"]

        # <=730 days (517 days between earliest/latest)
        diary_df2 = pd.DataFrame({
            "Watched Date": ["2024-01-01", "2024-06-01", "2024-12-01", "2025-03-01", "2025-06-01"],
        })
        result2 = compute_date_analytics(diary_df2, pd.DataFrame())
        assert "your film journey" in result2["data_timeline"]["period_description"]

        # > 730 days (multi-year)
        diary_df3 = pd.DataFrame({
            "Watched Date": ["2018-01-01", "2020-01-01", "2022-01-01", "2024-01-01", "2026-01-01"],
        })
        result3 = compute_date_analytics(diary_df3, pd.DataFrame())
        assert "years of your cinematic legacy" in result3["data_timeline"]["period_description"]
