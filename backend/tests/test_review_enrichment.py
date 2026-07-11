from app.services.review_analysis import enrich_scraped_reviews


def _base_analysis():
    return {
        "reviews": [
            {"title": "Stalker", "year": 1979, "text": "Two words", "likes": 3, "rating": 5.0},
            {"title": "Unknown Film", "year": 2001, "text": "orphan", "likes": 0, "rating": 4.0},
        ],
        "top_liked_reviews": [
            {"title": "Stalker", "year": "1979", "slug": "stalker", "like_count": 3,
             "rating": 5.0, "text_preview": "Two words"},
        ],
    }


def _scraped():
    return [{
        "title": "Stalker", "year": 1979, "slug": "stalker",
        "review_path": "/u/film/stalker/2/", "review_text": "Two words",
        "like_count": 3, "likers": [{"username": "fan", "display_name": "Fan", "avatar_url": None}],
        "likers_complete": True,
    }]


def _all_films():
    return [{"title": "Stalker", "year": 1979, "poster_path": "/stalker.jpg"}]


def test_enriches_matched_review_with_likers_poster_and_lengths():
    analysis = _base_analysis()
    enrich_scraped_reviews(analysis, _scraped(), _all_films())
    r = analysis["reviews"][0]
    assert r["poster_path"] == "/stalker.jpg"
    assert r["review_path"] == "/u/film/stalker/2/"
    assert [l["username"] for l in r["likers"]] == ["fan"]
    assert r["likers_complete"] is True
    assert r["char_length"] == len("Two words")
    assert r["word_count"] == 2


def test_unmatched_review_gets_empty_complete_likers_and_no_poster():
    analysis = _base_analysis()
    enrich_scraped_reviews(analysis, _scraped(), _all_films())
    orphan = analysis["reviews"][1]
    assert orphan["poster_path"] == ""
    assert orphan["likers"] == []
    assert orphan["likers_complete"] is True  # nothing to crawl
    assert orphan["word_count"] == 1


def test_top_liked_reviews_also_enriched():
    analysis = _base_analysis()
    enrich_scraped_reviews(analysis, _scraped(), _all_films())
    top = analysis["top_liked_reviews"][0]
    assert top["poster_path"] == "/stalker.jpg"
    assert [l["username"] for l in top["likers"]] == ["fan"]
    assert top["likers_complete"] is True
