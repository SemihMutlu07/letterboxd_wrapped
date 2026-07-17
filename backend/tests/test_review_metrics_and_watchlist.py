"""Tests for watchlist enrichment and recommendation schema."""

import pytest

from app.services.recommender import (
    compare_watchlist_sets,
    intersect_watchlists_minus_watched,
    public_film,
    recommendation_from_film,
)


@pytest.fixture
def raw_scrape_film():
    return {
        "title": "Inception",
        "year": "2010",
        "slug": "inception",
        "poster_url": "https://letterboxd.com/ajax-poster/.../image-150/",
    }


@pytest.fixture
def enriched_film():
    return {
        "title": "Inception",
        "year": "2010",
        "slug": "inception",
        "poster_url": "https://letterboxd.com/ajax-poster/.../image-150/",
        "poster_path": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        "popularity": 75.5,
        "vote_average": 8.4,
        "vote_count": 34_000,
        "genres": ["Action", "Science Fiction"],
        "director": "Christopher Nolan",
        "overview": "Cobb, a skilled thief...",
    }


def test_public_film_prefers_poster_path_over_poster_url(raw_scrape_film, enriched_film):
    public = public_film(enriched_film)
    assert public["poster_path"] == "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"
    # poster_url is retained only as a last-resort fallback for legacy consumers
    assert public["poster_url"] == raw_scrape_film["poster_url"]
    assert public["popularity"] == 75.5
    assert public["genres"] == ["Action", "Science Fiction"]


def test_compare_watchlist_sets_poster_fields(raw_scrape_film):
    first_watchlist = [raw_scrape_film]
    second_watchlist = [raw_scrape_film]
    result = compare_watchlist_sets(first_watchlist, second_watchlist)
    common = result["common"][0]
    # Raw scrape data has a broken poster_url and no poster_path before enrichment
    assert common["poster_url"] == raw_scrape_film["poster_url"]
    assert common["poster_path"] == ""


def test_compare_watchlist_sets_buckets_capped():
    films = [{"title": f"Film {i}", "year": "2020", "slug": f"film-{i}"} for i in range(200)]
    result = compare_watchlist_sets(films, films)
    assert len(result["common"]) == 50
    assert result["truncated"]["common"] is True


def test_recommendation_from_film_includes_director_overview(enriched_film):
    rec = recommendation_from_film(enriched_film, "Shared watchlist gem.")
    assert rec.title == "Inception"
    assert rec.director == "Christopher Nolan"
    assert rec.overview == "Cobb, a skilled thief..."
    assert rec.poster_path == "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"


def test_recommendation_from_film_handles_missing_director():
    film = {"title": "Mystery", "year": "2020", "slug": "mystery"}
    rec = recommendation_from_film(film, "Random pick.")
    assert rec.director is None
    assert rec.overview is None


# ---- find film: intersect_watchlists_minus_watched ----------------------------

def _film(title, year="2020"):
    return {"title": title, "year": year, "slug": title.lower().replace(" ", "-")}


def test_intersect_three_users_keeps_only_films_on_every_watchlist():
    result = intersect_watchlists_minus_watched(
        [
            [_film("Heat"), _film("Aftersun"), _film("Inception")],
            [_film("Heat"), _film("Aftersun")],
            [_film("Heat"), _film("Inception")],
        ],
        [[], [], []],
    )
    assert [f["title"] for f in result["films"]] == ["Heat"]
    assert result["counts"] == {
        "per_user": [3, 2, 2],
        "intersection": 1,
        "watched_removed": 0,
        "candidates": 1,
    }


def test_intersect_removes_film_watched_by_only_one_user():
    result = intersect_watchlists_minus_watched(
        [
            [_film("Heat"), _film("Aftersun")],
            [_film("Heat"), _film("Aftersun")],
        ],
        [[], [_film("Heat")]],
    )
    assert [f["title"] for f in result["films"]] == ["Aftersun"]
    assert result["counts"]["intersection"] == 2
    assert result["counts"]["watched_removed"] == 1
    assert result["counts"]["candidates"] == 1


def test_intersect_keys_are_case_and_whitespace_insensitive():
    result = intersect_watchlists_minus_watched(
        [
            [{"title": "Heat ", "year": "1995", "slug": "heat"}],
            [{"title": "heat", "year": " 1995", "slug": "heat"}],
        ],
        [[{"title": "HEAT", "year": "1995 ", "slug": "heat"}]],
    )
    assert result["films"] == []
    assert result["counts"]["intersection"] == 1
    assert result["counts"]["watched_removed"] == 1


def test_intersect_empty_watchlist_yields_no_films_but_counts():
    result = intersect_watchlists_minus_watched(
        [[_film("Heat")], [], [_film("Heat")]],
        [[], [], []],
    )
    assert result["films"] == []
    assert result["counts"]["per_user"] == [1, 0, 1]
    assert result["counts"]["intersection"] == 0
