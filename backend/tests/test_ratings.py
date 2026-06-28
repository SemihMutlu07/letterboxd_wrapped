"""Unit tests for the ratings module."""

from __future__ import annotations

import pandas as pd
import pytest

from app.services.ratings import (
    compute_budget_revenue_analytics,
    compute_fun_rating_stats,
    compute_highest_budget_film,
    compute_highest_grossing_film,
    compute_rating_personality,
    compute_rating_stats,
)


class TestComputeRatingStats:
    def test_basic_rating_stats(self):
        films_df = pd.DataFrame({
            "title": ["A", "B", "C"],
            "year": [2020, 2021, 2022],
            "rating": [4.0, 3.0, 5.0],
        })
        result = compute_rating_stats(films_df)
        assert result["average_rating"] == 4.0
        assert result["median_rating"] == 4.0
        assert result["total_rated_films"] == 3
        assert result["most_common_rating"] in (4.0, 3.0, 5.0)  # any works

    def test_no_ratings_column(self):
        films_df = pd.DataFrame({"title": ["A"], "year": [2020]})
        result = compute_rating_stats(films_df)
        assert result["average_rating"] is None
        assert result["total_rated_films"] == 0

    def test_empty_ratings(self):
        films_df = pd.DataFrame({
            "title": ["A", "B"],
            "year": [2020, 2021],
            "rating": [None, None],
        })
        result = compute_rating_stats(films_df)
        assert result["average_rating"] is None
        assert result["total_rated_films"] == 0

    def test_rating_distribution(self):
        films_df = pd.DataFrame({
            "title": list("ABCDE"),
            "year": range(2020, 2025),
            "rating": [4.0, 4.0, 3.0, 5.0, 5.0],
        })
        result = compute_rating_stats(films_df)
        assert result["rating_distribution"] == {3.0: 1, 4.0: 2, 5.0: 2}


class TestComputeRatingPersonality:
    def test_generous_critic(self):
        films_df = pd.DataFrame({
            "rating": [4.5, 4.2, 4.8, 4.0, 4.3],
        })
        assert compute_rating_personality(films_df) == "The Generous Critic"

    def test_picky_gourmet(self):
        films_df = pd.DataFrame({
            "rating": [2.5, 3.0, 2.0, 2.8, 2.2],
        })
        assert compute_rating_personality(films_df) == "The Picky Gourmet"

    def test_balanced_reviewer(self):
        films_df = pd.DataFrame({
            "rating": [3.5, 3.0, 4.0, 3.5, 3.2],
        })
        assert compute_rating_personality(films_df) == "The Balanced Reviewer"

    def test_no_ratings(self):
        films_df = pd.DataFrame({"title": ["A"]})
        assert compute_rating_personality(films_df) is None


class TestComputeBudgetRevenueAnalytics:
    def test_budget_analytics(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B", "C"],
            "budget": [10_000_000, 100_000_000, 500_000],
            "revenue": [20_000_000, 200_000_000, 1_000_000],
            "popularity": [5.0, 50.0, 2.0],
        })
        result = compute_budget_revenue_analytics(films_enriched)
        assert "budget_analytics" in result
        assert result["budget_analytics"]["average_budget"] == pytest.approx(36_833_333.33, rel=1e-2)
        assert result["revenue_analytics"]["average_revenue"] == pytest.approx(73_666_666.67, rel=1e-2)
        assert result["budget_analytics"]["budget_range_preference"] == "low"

    def test_all_budgets_zero(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B"],
            "budget": [0, 0],
            "revenue": [0, 0],
            "popularity": [0, 0],
        })
        result = compute_budget_revenue_analytics(films_enriched)
        assert result == {}

    def test_empty_dataframe(self):
        films_enriched = pd.DataFrame()
        assert compute_budget_revenue_analytics(films_enriched) == {}


class TestComputeFunRatingStats:
    def test_guilty_pleasure_and_outlier(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B", "C"],
            "year": [2020, 2021, 2022],
            "vote_average": [8.0, 5.5, 6.5],
            "poster_path": ["/a.jpg", None, "/c.jpg"],
        })
        films_df = pd.DataFrame({
            "title": ["A", "B", "C"],
            "year": [2020, 2021, 2022],
            "rating": [4.5, 4.0, 2.0],
        })
        result = compute_fun_rating_stats(films_enriched, films_df)
        # Film B: vote_average=5.5 < 6.0, rating=4.0 >= 4.0 — guilty pleasure
        assert "guilty_pleasure" in result
        assert result["guilty_pleasure"]["title"] == "B"
        # Rating outlier: (rating*2) - vote_average
        # A: |9 - 8| = 1, B: |8 - 5.5| = 2.5, C: |4 - 6.5| = 2.5
        # B is first idxmin
        assert "rating_outlier_film" in result

    def test_no_vote_average(self):
        films_enriched = pd.DataFrame({"title": ["A"], "year": [2020]})
        films_df = pd.DataFrame({"title": ["A"], "year": [2020], "rating": [4.0]})
        result = compute_fun_rating_stats(films_enriched, films_df)
        assert result == {}

    def test_empty_films_enriched(self):
        assert compute_fun_rating_stats(pd.DataFrame(), pd.DataFrame()) == {}


class TestComputeHighestBudgetFilm:
    def test_normal(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B"],
            "budget": [1000, 500_000_000],
        })
        result = compute_highest_budget_film(films_enriched)
        assert result["title"] == "B"
        assert result["budget"] == 500_000_000

    def test_all_zero_budget(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B"],
            "budget": [0, 0],
        })
        assert compute_highest_budget_film(films_enriched) is None

    def test_empty(self):
        assert compute_highest_budget_film(pd.DataFrame()) is None


class TestComputeHighestGrossingFilm:
    def test_normal(self):
        films_enriched = pd.DataFrame({
            "title": ["A", "B"],
            "revenue": [1000, 2_000_000_000],
        })
        result = compute_highest_grossing_film(films_enriched)
        assert result["title"] == "B"
        assert result["revenue"] == 2_000_000_000

    def test_empty(self):
        assert compute_highest_grossing_film(pd.DataFrame()) is None