"""Tests for watchlist enrichment and recommendation schema."""

import pytest

from app.services.recommender import compare_watchlist_sets, public_film, recommendation_from_film


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
