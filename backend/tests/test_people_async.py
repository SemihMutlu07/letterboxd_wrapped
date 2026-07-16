"""Async unit tests for the people module (profile lookups).

Uses mocked TMDB client responses to avoid actual network calls.
"""

from __future__ import annotations

from collections import Counter
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest

from app.services.people import (
    compute_actor_profiles,
    compute_director_profiles,
    compute_genre_stats,
    resolve_profile_paths,
)


@pytest.fixture
def mock_session():
    """Return a mocked aiohttp.ClientSession."""
    return AsyncMock()


@pytest.fixture
def logger():
    """Return a minimal logger stub."""
    import logging
    return logging.getLogger("test")


@pytest.fixture
def films_enriched():
    """Standard enriched film DataFrame for profile tests."""
    return pd.DataFrame({
        "title": ["Inception", "Memento", "Fight Club", "Se7en"],
        "year": [2010, 2000, 1999, 1995],
        "director": ["Christopher Nolan", "Christopher Nolan", "David Fincher", "David Fincher"],
        "cast": [
            ["Leonardo DiCaprio", "Elliot Page"],
            ["Guy Pearce", "Carrie-Anne Moss"],
            ["Brad Pitt", "Edward Norton"],
            ["Brad Pitt", "Morgan Freeman"],
        ],
        "poster_path": ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg"],
        "genres": [["Action", "Sci-Fi"], ["Thriller"], ["Drama"], ["Crime", "Thriller"]],
    })


@pytest.fixture
def films_df():
    """Standard films_df with ratings."""
    return pd.DataFrame({
        "title": ["Inception", "Memento", "Fight Club", "Se7en"],
        "year": [2010, 2000, 1999, 1995],
        "rating": [4.5, 4.0, 4.8, 4.2],
    })


class TestComputeDirectorProfiles:
    @patch("app.services.people.search_person_with_fallback")
    async def test_basic_profiles(
        self, mock_search, mock_session, films_enriched, films_df, logger
    ):
        """Director profiles with TMDB search results."""
        # Mock search_person_with_fallback to return profile paths
        async def search_side_effect(session, name, role="director"):
            profiles = {
                "Christopher Nolan": {"results": [{"profile_path": "/nolan.jpg"}]},
                "David Fincher": {"results": [{"profile_path": "/fincher.jpg"}]},
            }
            return profiles.get(name, {"results": []})

        mock_search.side_effect = search_side_effect

        director_counts = compute_director_counts_wrapper(films_enriched)
        result = await compute_director_profiles(
            mock_session, films_enriched, films_df, director_counts, logger
        )

        assert "top_directors" in result
        assert result["total_directors"] == 2
        assert result["most_watched_director"] is not None
        # Both directors appear 2x each — alphabetical tiebreak
        director_names = [d["name"] for d in result["top_directors"]]
        assert "Christopher Nolan" in director_names
        assert "David Fincher" in director_names

        # Check profiles were resolved
        nolan = next(d for d in result["top_directors"] if d["name"] == "Christopher Nolan")
        assert nolan["profile_path"] == "/nolan.jpg"

        fincher = next(d for d in result["top_directors"] if d["name"] == "David Fincher")
        assert fincher["profile_path"] == "/fincher.jpg"

        # Films map populated
        assert len(nolan["films"]) == 2
        assert len(fincher["films"]) == 2

    @patch("app.services.people.search_person_with_fallback")
    async def test_no_search_results(
        self, mock_search, mock_session, films_enriched, films_df, logger
    ):
        """When TMDB search returns nothing, falls through."""
        mock_search.return_value = None

        director_counts = compute_director_counts_wrapper(films_enriched)
        result = await compute_director_profiles(
            mock_session, films_enriched, films_df, director_counts, logger
        )

        assert result["top_directors"][0]["profile_path"] is None

    @patch("app.services.people.search_person_with_fallback")
    async def test_empty_films_enriched(
        self, mock_search, mock_session, logger
    ):
        """Empty enriched data produces empty results."""
        empty_df = pd.DataFrame()
        result = await compute_director_profiles(
            mock_session, empty_df, pd.DataFrame(), Counter(), logger
        )
        assert result["top_directors"] == []
        assert result["total_directors"] == 0
        assert result["most_watched_director"] is None


class TestComputeActorProfiles:
    @patch("app.services.people.search_person_with_fallback")
    async def test_basic_profiles(
        self, mock_search, mock_session, films_enriched, films_df, logger
    ):
        """Actor profiles with TMDB search results."""
        async def search_side_effect(session, name, role="actor"):
            profiles = {
                "Brad Pitt": {"results": [{"profile_path": "/brad.jpg"}]},
                "Leonardo DiCaprio": {"results": [{"profile_path": "/leo.jpg"}]},
            }
            return profiles.get(name, {"results": []})

        mock_search.side_effect = search_side_effect

        cast_counts = Counter()
        for cast_list in films_enriched["cast"]:
            if isinstance(cast_list, list):
                cast_counts.update(cast_list)

        result = await compute_actor_profiles(
            mock_session, films_enriched, films_df, cast_counts, logger
        )

        assert "top_actors" in result
        assert len(result["top_actors"]) >= 4  # at least the top 4 + remaining

        # Brad Pitt appears in 2 films — should be top
        top_names = [a["name"] for a in result["top_actors"][:4]]
        assert "Brad Pitt" in top_names

    @patch("app.services.people.search_person_with_fallback")
    async def test_empty(
        self, mock_search, mock_session, logger
    ):
        result = await compute_actor_profiles(
            mock_session, pd.DataFrame(), pd.DataFrame(), Counter(), logger
        )
        assert result["top_actors"] == []


class TestResolveProfilePaths:
    @patch("app.services.people.search_person_with_fallback")
    async def test_backfill(self, mock_search, mock_session, logger):
        """Backfill profile_path for entities that don't have one yet."""
        async def search_side(session, name, role="director"):
            return {"results": [{"profile_path": f"/{name.lower()}.jpg"}]}

        mock_search.side_effect = search_side

        entities = [
            {"name": "Nolan", "count": 5, "avg_rating": 4.0},
            {"name": "Fincher", "count": 3, "avg_rating": 3.5},
        ]
        cache: dict = {}
        films_map: dict = {}

        await resolve_profile_paths(mock_session, entities, "director", films_map, cache, logger, limit=4)

        assert entities[0]["profile_path"] == "/nolan.jpg"
        assert entities[1]["profile_path"] == "/fincher.jpg"
        assert cache["Nolan"] == "/nolan.jpg"
        assert cache["Fincher"] == "/fincher.jpg"

    @patch("app.services.people.search_person_with_fallback")
    async def test_cache_hit_is_copied_to_entity(self, mock_search, mock_session, logger):
        entities = [{"name": "Nolan", "count": 5}]

        await resolve_profile_paths(
            mock_session, entities, "director", {}, {"Nolan": "/cached.jpg"}, logger
        )

        assert entities[0]["profile_path"] == "/cached.jpg"
        mock_search.assert_not_awaited()

    @patch("app.services.people.search_person_with_fallback")
    async def test_default_limit_enriches_fifth_person(self, mock_search, mock_session, logger):
        mock_search.side_effect = lambda _session, name, role="director": {
            "results": [{"profile_path": f"/{name}.jpg"}]
        }
        entities = [{"name": f"Person-{index}"} for index in range(1, 7)]

        await resolve_profile_paths(mock_session, entities, "director", {}, {}, logger)

        assert entities[4]["profile_path"] == "/Person-5.jpg"
        assert "profile_path" not in entities[5]


# Helper to compute director_counts without importing compute_director_counts
def compute_director_counts_wrapper(films_enriched):
    return Counter(films_enriched["director"].dropna())
