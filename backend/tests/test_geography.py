"""Unit tests for the geography module."""

from __future__ import annotations

import pandas as pd

from app.services.geography import (
    compute_country_analytics,
    compute_country_iso_data,
    compute_country_language_stats,
    compute_keyword_analytics,
    compute_world_tour,
)


class TestComputeKeywordAnalytics:
    def test_basic_keywords(self):
        films_enriched = pd.DataFrame({
            "keywords_full": [
                [{"name": "action"}, {"name": "thriller"}],
                [{"name": "action"}, {"name": "crime"}],
                [{"name": "drama"}],
            ],
        })
        result = compute_keyword_analytics(films_enriched)
        assert "keywords_analytics" in result
        assert result["keywords_analytics"]["total_unique_keywords"] == 4
        # action is top with count 2
        assert result["keywords_analytics"]["top_keywords"][0]["keyword"] == "action"
        assert result["keywords_analytics"]["top_keywords"][0]["count"] == 2

    def test_no_keywords_column(self):
        films_enriched = pd.DataFrame({"title": ["A"]})
        result = compute_keyword_analytics(films_enriched)
        assert result == {}

    def test_empty_df(self):
        assert compute_keyword_analytics(pd.DataFrame()) == {}

    def test_mixed_nulls(self):
        films_enriched = pd.DataFrame({
            "keywords_full": [
                None,
                [{"name": "sci-fi"}],
                None,
            ],
        })
        result = compute_keyword_analytics(films_enriched)
        assert result["keywords_analytics"]["total_unique_keywords"] == 1


class TestComputeCountryAnalytics:
    def test_basic_countries(self):
        films_enriched = pd.DataFrame({
            "production_countries": [
                [{"name": "United States"}, {"name": "France"}],
                [{"name": "United States"}],
                [{"name": "Japan"}],
            ],
        })
        result = compute_country_analytics(films_enriched)
        assert "countries_analytics" in result
        ca = result["countries_analytics"]
        assert ca["total_countries_explored"] == 3
        assert ca["top_countries_detailed"][0]["country"] == "United States"
        assert ca["international_percentage"] > 0

    def test_no_data(self):
        assert compute_country_analytics(pd.DataFrame()) == {}

    def test_no_production_countries_column(self):
        films_enriched = pd.DataFrame({"title": ["A"]})
        assert compute_country_analytics(films_enriched) == {}


class TestComputeCountryLanguageStats:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "countries": [["USA"], ["Japan", "USA"], ["France"]],
            "language": ["English", "Japanese", "French"],
        })
        result = compute_country_language_stats(films_enriched)
        assert result["total_countries"] == 3
        assert result["top_countries"][0] == {"name": "USA", "count": 2}
        assert result["top_languages"][0]["language"] == "English"

    def test_empty(self):
        assert compute_country_language_stats(pd.DataFrame()) == {}


class TestComputeCountryIsoData:
    def test_basic(self):
        analysis_df = pd.DataFrame({
            "title": ["A", "B", "C"],
            "year": [2020, 2021, 2022],
            "production_countries": [
                [{"iso_3166_1": "US", "name": "United States"}],
                [{"iso_3166_1": "US", "name": "United States"},
                 {"iso_3166_1": "JP", "name": "Japan"}],
                [{"iso_3166_1": "FR", "name": "France"}],
            ],
            "rating": [4.0, 3.5, 5.0],
        })
        result = compute_country_iso_data(analysis_df)
        assert "countries_iso_data" in result
        # US count=2, JP count=1, FR count=1
        iso_data = result["countries_iso_data"]
        assert len(iso_data) == 3
        assert iso_data[0]["iso2"] == "US"
        assert iso_data[0]["count"] == 2

    def test_no_production_countries(self):
        analysis_df = pd.DataFrame({"title": ["A"]})
        result = compute_country_iso_data(analysis_df)
        assert result == {}

    def test_with_ratings_threshold(self):
        # Only countries with >=5 ratings get avg_rating
        analysis_df = pd.DataFrame({
            "title": [f"F{i}" for i in range(10)],
            "year": range(2015, 2025),
            "production_countries": [[{"iso_3166_1": "US", "name": "United States"}] for _ in range(10)],
            "rating": [float(i) for i in range(10)],
        })
        result = compute_country_iso_data(analysis_df)
        iso_data = result["countries_iso_data"]
        assert iso_data[0]["iso2"] == "US"
        assert iso_data[0]["count"] == 10
        assert "avg_rating" in iso_data[0]  # >=5 ratings

    def test_below_rating_threshold(self):
        analysis_df = pd.DataFrame({
            "title": ["A", "B", "C"],
            "year": [2020, 2021, 2022],
            "production_countries": [[{"iso_3166_1": "DE", "name": "Germany"}] for _ in range(3)],
            "rating": [4.0, 3.5, 5.0],
        })
        result = compute_country_iso_data(analysis_df)
        iso_data = result["countries_iso_data"]
        assert "avg_rating" not in iso_data[0]  # only 3 ratings, need 5


class TestComputeWorldTour:
    def test_basic(self):
        countries = [
            {"name": "United States", "count": 50},
            {"name": "France", "count": 20},
            {"name": "Japan", "count": 15},
        ]
        result = compute_world_tour(countries)
        assert len(result) == 3
        assert result[0]["flag"] == "\U0001f1fa\U0001f1f8"  # US flag
        assert result[1]["flag"] == "\U0001f1eb\U0001f1f7"  # FR flag

    def test_unknown_country(self):
        countries = [{"name": "Atlantis", "count": 1}]
        result = compute_world_tour(countries)
        assert result[0]["flag"] == "\U0001f3ac"  # film emoji fallback

    def test_empty(self):
        assert compute_world_tour([]) == []