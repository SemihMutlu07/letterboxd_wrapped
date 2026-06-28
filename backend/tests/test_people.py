"""Unit tests for the people module (sync functions only).

Async profile lookups (compute_director_profiles, compute_actor_profiles,
resolve_profile_paths) are tested separately in test_people_async.py.
"""

from __future__ import annotations

from collections import Counter

import pandas as pd
import pytest

from app.services.people import (
    compute_actor_counts,
    compute_all_cast_counts,
    compute_actors_with_ratings,
    compute_decade_stats,
    compute_director_counts,
    compute_director_deep_analysis,
    compute_directors_with_ratings,
    compute_favorite_genre_combo,
    compute_genre_stats,
    compute_movie_crush,
    compute_my_star,
    compute_popularity_info,
    compute_signature_duo,
)


class TestComputeGenreStats:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "genres": [
                ["Action", "Thriller"],
                ["Action", "Comedy"],
                ["Drama"],
            ],
        })
        result = compute_genre_stats(films_enriched)
        assert result["favorite_genre"]["name"] == "Action"
        assert result["favorite_genre"]["count"] == 2
        assert len(result["top_genres"]) == 4  # Action(2), Thriller(1), Comedy(1), Drama(1)

    def test_empty(self):
        assert compute_genre_stats(pd.DataFrame()) == {}

    def test_no_genres_column(self):
        films_enriched = pd.DataFrame({"title": ["A"]})
        assert compute_genre_stats(films_enriched) == {}


class TestComputeDecadeStats:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "decade": ["2020s", "2020s", "2010s", "2000s"],
        })
        result = compute_decade_stats(films_enriched)
        assert result["favorite_decade"]["name"] == "2020s"
        assert result["favorite_decade"]["count"] == 2
        # Sorted order: 2000s, 2010s, 2020s
        assert result["decades"][0]["decade"] == "2000s"

    def test_empty(self):
        result = compute_decade_stats(pd.DataFrame())
        assert result.get("favorite_decade") is None

    def test_no_decade_column(self):
        films_enriched = pd.DataFrame({"title": ["A"]})
        assert compute_decade_stats(films_enriched) == {}


class TestComputeDirectorCounts:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "director": ["Nolan", "Nolan", "Fincher", "Villeneuve"],
        })
        counts = compute_director_counts(films_enriched)
        assert counts["Nolan"] == 2
        assert counts["Fincher"] == 1

    def test_with_nulls(self):
        films_enriched = pd.DataFrame({
            "director": ["Nolan", None, "Fincher"],
        })
        counts = compute_director_counts(films_enriched)
        assert counts["Nolan"] == 1
        assert None not in counts  # dropna

    def test_empty(self):
        assert compute_director_counts(pd.DataFrame()) == Counter()


class TestComputeActorCounts:
    def test_first_cast_only(self):
        films_enriched = pd.DataFrame({
            "cast": [
                ["Actor A", "Actor B"],
                ["Actor A", "Actor C"],
                ["Actor D"],
            ],
        })
        counts = compute_actor_counts(films_enriched)
        assert counts["Actor A"] == 2
        assert "Actor B" not in counts  # not first in any film

    def test_empty(self):
        assert compute_actor_counts(pd.DataFrame()) == Counter()


class TestComputeAllCastCounts:
    def test_all_cast(self):
        films_enriched = pd.DataFrame({
            "cast": [
                ["A", "B"],
                ["A", "C"],
                ["D"],
            ],
        })
        counts = compute_all_cast_counts(films_enriched)
        assert counts["A"] == 2
        assert counts["B"] == 1
        assert counts["C"] == 1
        assert counts["D"] == 1

    def test_empty(self):
        assert compute_all_cast_counts(pd.DataFrame()) == Counter()


class TestComputeMyStar:
    def test_basic(self):
        counts = Counter({"A": 5, "B": 3, "C": 1})
        result = compute_my_star(counts)
        assert result == {"name": "A", "count": 5}

    def test_empty(self):
        assert compute_my_star(Counter()) is None


class TestComputeMovieCrush:
    def test_basic(self):
        actors = [
            {"name": "A", "profile_path": "/a.jpg", "count": 5},
            {"name": "B", "profile_path": None, "count": 3},
        ]
        result = compute_movie_crush(actors)
        assert result == {"name": "A", "profile_path": "/a.jpg", "count": 5}

    def test_empty(self):
        assert compute_movie_crush([]) is None


class TestComputeDirectorDeepAnalysis:
    def test_critical_relationship(self):
        films_enriched = pd.DataFrame({
            "title": ["F1", "F2", "F3"],
            "year": [2020, 2021, 2022],
            "director": ["Nolan", "Nolan", "Nolan"],
        })
        films_df = pd.DataFrame({
            "title": ["F1", "F2", "F3"],
            "year": [2020, 2021, 2022],
            "rating": [3.0, 3.5, 3.0],
        })
        mwd = {"name": "Nolan", "count": 3}
        result = compute_director_deep_analysis(films_enriched, films_df, mwd)
        assert result["director_name"] == "Nolan"
        assert result["average_rating_given"] == pytest.approx(3.17, rel=1e-2)
        assert result["relationship"] == "critical"

    def test_generous_relationship(self):
        films_enriched = pd.DataFrame({
            "title": ["F1"],
            "year": [2020],
            "director": ["Nolan"],
        })
        films_df = pd.DataFrame({
            "title": ["F1"],
            "year": [2020],
            "rating": [4.5],
        })
        mwd = {"name": "Nolan", "count": 1}
        result = compute_director_deep_analysis(films_enriched, films_df, mwd)
        assert result["relationship"] == "generous"

    def test_no_most_watched(self):
        assert compute_director_deep_analysis(pd.DataFrame(), pd.DataFrame(), None) is None


class TestComputeSignatureDuo:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "title": ["F1", "F2", "F3"],
            "director": ["Nolan", "Nolan", "Fincher"],
            "cast": [
                ["Actor A", "Actor B"],
                ["Actor A", "Actor C"],
                ["Actor X"],
            ],
        })
        result = compute_signature_duo(films_enriched)
        assert result["director"] == "Nolan"
        assert result["actor"] == "Actor A"
        assert result["count"] == 2
        assert "comfort zone" in result["story"]

    def test_no_cast_column(self):
        films_enriched = pd.DataFrame({"title": ["A"], "director": ["N"]})
        assert compute_signature_duo(films_enriched) is None

    def test_empty(self):
        assert compute_signature_duo(pd.DataFrame()) is None


class TestComputePopularityInfo:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "popularity": [5.0, 50.0, 2.0, 30.0, 100.0],
        })
        result = compute_popularity_info(films_enriched)
        # average=37.4, mainstream_pct=60% (50,30,100), niche_pct=20% (2)
        assert result["average"] == pytest.approx(37.4, rel=1e-2)
        assert result["mainstream_pct"] == pytest.approx(60.0, rel=1e-2)
        assert result["niche_pct"] == pytest.approx(20.0, rel=1e-2)

    def test_no_popularity_column(self):
        films_enriched = pd.DataFrame({"title": ["A"]})
        assert compute_popularity_info(films_enriched) is None

    def test_empty(self):
        assert compute_popularity_info(pd.DataFrame()) is None


class TestComputeFavoriteGenreCombo:
    def test_basic(self):
        films_enriched = pd.DataFrame({
            "genres": [
                ["Action", "Thriller"],
                ["Action", "Thriller"],
                ["Comedy", "Drama"],
            ],
        })
        result = compute_favorite_genre_combo(films_enriched)
        assert result["combination"] == "Action-Thriller"
        assert result["count"] == 2

    def test_no_two_genres(self):
        films_enriched = pd.DataFrame({
            "genres": [["Action"], ["Action"]],
        })
        assert compute_favorite_genre_combo(films_enriched) is None

    def test_empty(self):
        assert compute_favorite_genre_combo(pd.DataFrame()) is None


class TestComputeDirectorsWithRatings:
    def test_basic(self):
        director_counts = Counter({"Nolan": 3, "Fincher": 2})
        analysis_df = pd.DataFrame({
            "title": ["F1", "F2", "F3", "F4", "F5"],
            "year": [2020, 2021, 2022, 2023, 2024],
            "director": ["Nolan", "Nolan", "Nolan", "Fincher", "Fincher"],
            "rating": [4.0, 3.5, 4.5, 2.0, 3.0],
        })
        result = compute_directors_with_ratings(director_counts, analysis_df)
        # Nolan avg=4.0 (3 films, 3 ratings), Fincher avg=2.5 (2 films, 2 ratings — below min_rated=3)
        assert len(result) == 1
        assert result[0]["name"] == "Nolan"
        assert result[0]["avg_rating"] == pytest.approx(4.0, rel=1e-2)

    def test_below_min_rated(self):
        director_counts = Counter({"Nolan": 2})
        analysis_df = pd.DataFrame({
            "title": ["F1", "F2"],
            "year": [2020, 2021],
            "director": ["Nolan", "Nolan"],
            "rating": [4.0, 3.5],
        })
        result = compute_directors_with_ratings(director_counts, analysis_df)
        assert len(result) == 0  # only 2 ratings, need 3


class TestComputeActorsWithRatings:
    def test_basic(self):
        cast_counts = Counter({"A": 3, "B": 3})
        analysis_df = pd.DataFrame({
            "title": ["F1", "F2", "F3", "F4", "F5", "F6"],
            "year": range(2019, 2025),
            "cast": [
                ["A", "B"],
                ["A"],
                ["A"],
                ["B"],
                ["B"],
                [],
            ],
            "rating": [4.0, 3.0, 5.0, 2.0, 3.0, None],
        })
        profile_map = {"A": "/a.jpg", "B": None}
        result = compute_actors_with_ratings(cast_counts, analysis_df, profile_map)
        # A has 3 ratings (4,3,5) avg=4.0, B has 3 ratings (4,2,3) avg=3.0
        assert len(result) == 2
        assert result[0]["name"] == "A"
        assert result[0]["profile_path"] == "/a.jpg"