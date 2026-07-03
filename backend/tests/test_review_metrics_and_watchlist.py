"""Targeted tests for the additive review-likes path and watchlist 50-cap."""

import pandas as pd

from app.services.recommender import compare_watchlist_sets, public_film, BUCKET_CAP
from app.services.review_analysis import compute_review_metrics


def test_compute_review_metrics_emits_top_liked_when_likes_column_present():
    df = pd.DataFrame([
        {
            "Date": "2024-01-01",
            "Name": "Memories of Underdevelopment",
            "Year": "1968",
            "Rating": 4.5,
            "Rewatch": "",
            "Review": "Sergio's gaze is sharper than any thesis.",
            "Tags": "",
            "Watched Date": "",
            "Likes": 18,
            "Slug": "memories-of-underdevelopment",
        },
        {
            "Date": "2024-02-04",
            "Name": "Aftersun",
            "Year": "2022",
            "Rating": 4.0,
            "Rewatch": "",
            "Review": "Quiet, devastating.",
            "Tags": "",
            "Watched Date": "",
            "Likes": 4,
            "Slug": "aftersun",
        },
    ])

    metrics = compute_review_metrics(df)

    assert metrics["total_review_likes"] == 22
    top = metrics["top_liked_reviews"]
    assert top[0]["title"] == "Memories of Underdevelopment"
    assert top[0]["like_count"] == 18
    assert top[0]["slug"] == "memories-of-underdevelopment"
    assert top[1]["title"] == "Aftersun"
    assert top[1]["like_count"] == 4


def test_compute_review_metrics_works_without_likes_column():
    df = pd.DataFrame([
        {
            "Date": "2024-01-01",
            "Name": "Just A Film",
            "Year": "2024",
            "Rating": 3.5,
            "Rewatch": "",
            "Review": "It exists.",
            "Tags": "",
            "Watched Date": "",
        }
    ])

    metrics = compute_review_metrics(df)

    assert metrics["top_liked_reviews"] == []
    assert metrics["total_review_likes"] is None
    assert metrics["reviews_with_text"] == 1


def test_compare_watchlist_sets_caps_buckets_and_reports_truncation():
    first = [
        {"title": f"Film {i}", "year": "2000", "slug": f"film-{i}"} for i in range(120)
    ]
    # Second has the first 80 in common, then 60 unique
    second = (
        [{"title": f"Film {i}", "year": "2000", "slug": f"film-{i}"} for i in range(80)]
        + [{"title": f"Other {i}", "year": "2001", "slug": f"other-{i}"} for i in range(60)]
    )

    result = compare_watchlist_sets(first, second)

    # raw counts unchanged
    assert result["counts"]["common"] == 80
    assert result["counts"]["first_only"] == 40
    assert result["counts"]["second_only"] == 60

    # returned arrays capped
    assert len(result["common"]) == BUCKET_CAP
    assert len(result["first_only"]) == 40  # below cap → not truncated
    assert len(result["second_only"]) == BUCKET_CAP

    assert result["returned_counts"] == {
        "common": BUCKET_CAP,
        "first_only": 40,
        "second_only": BUCKET_CAP,
    }
    assert result["truncated"] == {
        "common": True,
        "first_only": False,
        "second_only": True,
    }


def test_compare_watchlist_sets_preserves_poster_url():
    first = [{"title": "Aftersun", "year": "2022", "slug": "aftersun", "poster_url": "https://img/aftersun.jpg"}]
    second = [{"title": "Aftersun", "year": "2022", "slug": "aftersun"}]

    result = compare_watchlist_sets(first, second)

    assert result["common"][0]["poster_url"] == "https://img/aftersun.jpg"


def test_public_film_carries_tmdb_poster_path():
    """After TMDB enrichment a film has poster_path; public_film must pass it
    through so the frontend can render a real poster instead of the scraper's
    broken /image-150/ AJAX-endpoint URL."""
    enriched = {
        "title": "Aftersun",
        "year": "2022",
        "slug": "aftersun",
        "poster_url": "https://letterboxd.com/film/aftersun/image-150/",
        "poster_path": "/1p5aI299YBnqrEEfBpimMWzmVQZ.jpg",
    }

    result = public_film(enriched)

    assert result["poster_path"] == "/1p5aI299YBnqrEEfBpimMWzmVQZ.jpg"
