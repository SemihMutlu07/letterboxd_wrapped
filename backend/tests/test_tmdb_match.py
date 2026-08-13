"""TMDB search result picking — no network.

Generic English titles (Inside, Destiny) collide; Letterboxd slugs
(yeralti, kader) disambiguate the original-language film.
"""

from __future__ import annotations

from unittest.mock import patch

from app.services.tmdb_client import (
    letterboxd_film_slug,
    pick_tmdb_search_result,
    resolve_tmdb_id,
    slug_search_query,
)


def test_letterboxd_film_slug_from_uri_and_raw():
    assert letterboxd_film_slug("https://letterboxd.com/film/yeralti/") == "yeralti"
    assert letterboxd_film_slug("https://letterboxd.com/film/kader/") == "kader"
    assert letterboxd_film_slug("yeralti") == "yeralti"
    assert letterboxd_film_slug("/film/inside/") == "inside"
    assert letterboxd_film_slug("") == ""
    assert letterboxd_film_slug(None) == ""


def test_slug_search_query_strips_year_suffix():
    assert slug_search_query("yeralti") == "yeralti"
    assert slug_search_query("kader-2006") == "kader"
    assert slug_search_query("inside-2012") == "inside"


def test_inside_2012_prefers_yeralti_when_slug_is_present():
    results = [
        {
            "id": 111,
            "title": "Inside",
            "original_title": "Inside",
            "release_date": "2012-08-01",
        },
        {
            "id": 127241,
            "title": "Inside",
            "original_title": "Yeraltı",
            "release_date": "2012-03-16",
        },
    ]
    picked = pick_tmdb_search_result(results, "Inside", 2012, slug="yeralti")
    assert picked is not None
    assert picked["id"] == 127241


def test_inside_without_slug_keeps_exact_title_year_match():
    results = [
        {
            "id": 111,
            "title": "Inside",
            "original_title": "Inside",
            "release_date": "2012-08-01",
        },
        {
            "id": 999,
            "title": "Inside Job",
            "original_title": "Inside Job",
            "release_date": "2010-01-01",
        },
    ]
    picked = pick_tmdb_search_result(results, "Inside", 2012, slug="")
    assert picked is not None
    assert picked["id"] == 111


def test_destiny_2006_prefers_kader_original_title():
    results = [
        {
            "id": 1,
            "title": "Destiny",
            "original_title": "Destiny",
            "release_date": "1997-01-01",
        },
        {
            "id": 41244,
            "title": "Destiny",
            "original_title": "Kader",
            "release_date": "2006-11-17",
        },
    ]
    picked = pick_tmdb_search_result(results, "Destiny", 2006, slug="kader")
    assert picked is not None
    assert picked["id"] == 41244


def test_slug_beats_more_popular_same_year_english_title():
    results = [
        {
            "id": 1,
            "title": "Inside",
            "original_title": "Inside",
            "release_date": "2012-08-01",
            "popularity": 99.0,
        },
        {
            "id": 127241,
            "title": "Inside",
            "original_title": "Yeraltı",
            "release_date": "2012-03-16",
            "popularity": 1.2,
        },
    ]
    picked = pick_tmdb_search_result(results, "Inside", 2012, slug="yeralti")
    assert picked is not None
    assert picked["id"] == 127241


def test_norm_title_folds_turkish_dotless_i():
    results = [
        {
            "id": 101995,
            "title": "Inside",
            "original_title": "Yeraltı",
            "release_date": "2012-04-13",
        }
    ]
    picked = pick_tmdb_search_result(results, "Inside", 2012, slug="yeralti")
    assert picked is not None
    assert picked["id"] == 101995


def test_empty_results_return_none():
    assert pick_tmdb_search_result([], "Inside", 2012, slug="yeralti") is None


async def test_resolve_tmdb_id_searches_original_language_slug():
    async def fake_get(_session, _endpoint, params=None, cache=True):
        query = (params or {}).get("query")
        if query == "Inside":
            return {
                "results": [
                    {
                        "id": 1,
                        "title": "Inside",
                        "original_title": "Inside",
                        "release_date": "2012-08-01",
                        "popularity": 99.0,
                    }
                ]
            }
        if query == "yeralti":
            return {
                "results": [
                    {
                        "id": 127241,
                        "title": "Inside",
                        "original_title": "Yeraltı",
                        "release_date": "2012-03-16",
                        "popularity": 1.2,
                    }
                ]
            }
        return {"results": []}

    with patch("app.services.tmdb_client.tmdb_get", fake_get):
        tmdb_id = await resolve_tmdb_id(None, "Inside", 2012, slug="yeralti")
    assert tmdb_id == 127241
