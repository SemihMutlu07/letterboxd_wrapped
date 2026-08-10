import pandas as pd

from app.services.review_analysis import compute_review_metrics


def test_longest_review_uses_readable_word_count_not_likes_or_url_length():
    reviews = pd.DataFrame(
        [
            {
                "Name": "Most Liked",
                "Year": 2025,
                "Likes": 99,
                "Review": f"kısa yorum https://example.com/{'x' * 500}",
            },
            {
                "Name": "Zulu",
                "Year": 2025,
                "Likes": 0,
                "Review": "İstanbul’da geçen bu film kalbimde uzun süre yaşayacak",
            },
            {
                "Name": "Alpha",
                "Year": 2024,
                "Likes": 0,
                "Review": "İstanbul’da geçen bu film kalbimde uzun süre yaşayacak",
            },
            {
                "Name": "Beta URL Tie",
                "Year": 2024,
                "Likes": 0,
                "Review": f"İstanbul’da geçen bu film kalbimde uzun süre yaşayacak HTTPS://EXAMPLE.COM/{'y' * 500}",
            },
            {
                "Name": "Combining",
                "Year": 2023,
                "Likes": 0,
                "Review": "nai\u0308ve <a href=\"https://example.com/path\">harika</a>",
            },
        ]
    )

    metrics = compute_review_metrics(reviews)

    assert metrics["longest_review"] == {
        "title": "Alpha",
        "year": "2024",
        "length": 8,
        "unit": "words",
    }
    by_title = {review["title"]: review for review in metrics["reviews"]}
    assert by_title["Most Liked"]["word_count"] == 2
    assert len(metrics["reviews"]) == len(reviews)
    assert by_title["Alpha"]["word_count"] == 8
    assert by_title["Beta URL Tie"]["word_count"] == 8
    assert by_title["Combining"]["word_count"] == 2
    assert by_title["Most Liked"]["char_length"] == len(reviews.iloc[0]["Review"])


def test_review_metrics_handle_duplicate_dataframe_indices():
    reviews = pd.DataFrame(
        [
            {"Name": "Long", "Year": 2025, "Review": "üç kelimelik yorum"},
            {"Name": "Brief", "Year": 2024, "Review": "kısa"},
        ],
        index=[7, 7],
    )

    metrics = compute_review_metrics(reviews)

    assert metrics["longest_review"]["title"] == "Long"
    assert metrics["shortest_review"]["title"] == "Brief"
