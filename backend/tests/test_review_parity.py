from bs4 import BeautifulSoup

from app.services import scraper
from app.services.review_analysis import enrich_scraped_reviews
from app.services.run_log import _redact_third_party_likers


def test_enrichment_preserves_experiment_social_contract():
    analysis = {
        "reviews": [{"title": "Amélie", "year": 2001, "text": "Très bien", "likes": 2}],
        "top_liked_reviews": [{"title": "Amélie", "year": "2001", "like_count": 2}],
    }
    liker = {"username": "fan", "display_name": "Fan", "profile_url": "https://letterboxd.com/fan/", "avatar_url": None}
    scraped = [{
        "title": "Ame\u0301lie", "year": "2001", "review_path": "/u/film/amelie/",
        "review_text": "Très bien", "likers": [liker], "likers_complete": True,
    }]
    enrich_scraped_reviews(analysis, scraped, [{"title": "Amélie", "year": 2001, "poster_path": "/a.jpg"}])

    assert analysis["reviews"][0]["liked_by"] == [liker]
    assert analysis["reviews"][0]["likers"] == [liker]
    assert analysis["reviews"][0]["poster_path"] == "/a.jpg"
    assert analysis["top_recurring_likers"][0]["count"] == 1
    assert analysis["socially_active_reviews"][0]["likers_complete"] is True


def test_avatar_parser_keeps_identity_but_rejects_foreign_image():
    soup = BeautifulSoup(
        '<div class="person-summary"><a href="/fan/" class="name">Fan</a>'
        '<img src="https://evil.example/avatar.jpg"></div>',
        "html.parser",
    )
    liker = scraper._parse_liker_cards(soup)[0]
    assert liker["username"] == "fan"
    assert liker["avatar_url"] is None


def test_run_log_redacts_both_backend_and_experiment_liker_shapes():
    stats = {"review_analysis": {
        "reviews": [{"likers": [{"username": "a"}], "liked_by": [{"username": "a"}], "like_count": 1}],
        "socially_active_reviews": [{"liked_by": [{"username": "a"}], "like_count": 1}],
        "top_recurring_likers": [{"username": "a", "count": 1}],
        "total_unique_likers": 1,
    }}
    redacted = _redact_third_party_likers(stats)
    analysis = redacted["review_analysis"]
    assert "likers" not in analysis["reviews"][0]
    assert "liked_by" not in analysis["reviews"][0]
    assert "liked_by" not in analysis["socially_active_reviews"][0]
    assert "top_recurring_likers" not in analysis
    assert analysis["total_unique_likers"] == 1
