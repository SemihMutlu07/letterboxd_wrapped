"""
Review text analysis for Letterboxd Wrapped.

Parses reviews.csv from Letterboxd export and computes text-based metrics:
word frequency, bigram frequency, review length by rating, language mix,
volume over time, and other linguistic stats.

Phase 1 — CSV path only (HTML scrape path comes in Phase 2).
"""

from __future__ import annotations

import re
import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

# ---------------------------------------------------------------------------
# Turkish + English stopwords (common function words to exclude from frequency)
# ---------------------------------------------------------------------------
_TURKISH_STOPWORDS: set[str] = {
    "acaba", "altı", "altında", "ama", "ancak", "anda", "arada", "artık",
    "asıl", "aslında", "az", "bana", "bazen", "bazı", "ben", "bence",
    "beni", "benim", "beri", "beş", "bile", "bin", "bir", "birçok",
    "biri", "birinde", "birisi", "biz", "bize", "bizi", "bizim", "boş",
    "bu", "buna", "bunda", "bundan", "bunlar", "bunları", "bunların",
    "bunu", "bunun", "da", "daha", "dahi", "de", "defa", "değil",
    "diğer", "diye", "dolayı", "dört", "dörtte", "ediyor", "eğer",
    "elbette", "en", "etmek", "etti", "ettiği", "eyle", "falan", "fazla",
    "filan", "gene", "gibi", "göre", "güzel", "hala", "halde", "hande",
    "hangi", "hangisi", "hani", "harici", "hatta", "hatır", "hem",
    "henüz", "hep", "hepsi", "her", "herhangi", "herkes", "herkesin",
    "hiç", "hiçbir", "hiçbiri", "için", "içinde", "iken", "iki",
    "ila", "ile", "ilgili", "ilk", "illa", "insan", "ise", "işte",
    "itibaren", "itibariyle", "iyi", "iyice", "kadar", "karşı",
    "kat", "kendi", "kendine", "kendini", "kendisi", "kez", "kim",
    "kimse", "ki", "lakin", "madem", "mi", "mı", "mu", "mü",
    "nasıl", "ne", "neden", "nedenle", "nerde", "nerede", "nereye",
    "niye", "niçin", "o", "olan", "olarak", "oldu", "olduğu",
    "olduğunu", "oldukça", "olmak", "olması", "olmayan", "olmaz",
    "olsa", "olsun", "olur", "oluyor", "ona", "onlar", "onlara",
    "onları", "onların", "onu", "onun", "orada", "otuz", "oysa",
    "pek", "rağmen", "sade", "sadece", "sanki", "sana", "sen",
    "senden", "seni", "senin", "siz", "sizden", "sizi", "sizin",
    "şey", "şeyden", "şeye", "şeyi", "şeyler", "şu", "şuna",
    "şunda", "şundan", "şunlar", "şunu", "tabi", "tabii", "tam",
    "tamam", "tüm", "üzere", "var", "ve", "veya", "vefat", "veyahut",
    "ya", "yani", "yapacak", "yapılan", "yapmak", "yaptı", "yaptığı",
    "yaptığını", "yaptıkları", "yedi", "yer", "yine", "yok", "yoksa",
    "yoluyla", "yüz", "zaten", "çok", "çünkü", "önce", "öte",
    "öyle", "ürzere", "şöyle", "şimdi", "şu",
}

_ENGLISH_STOPWORDS: set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am",
    "an", "and", "any", "are", "arent", "as", "at", "be", "because",
    "been", "before", "being", "below", "between", "both", "but",
    "by", "cant", "cannot", "could", "couldnt", "did", "didnt", "do",
    "does", "doesnt", "doing", "dont", "down", "during", "each",
    "few", "for", "from", "further", "had", "hadnt", "has", "hasnt",
    "have", "havent", "having", "he", "hed", "hell", "hes", "her",
    "here", "heres", "hers", "herself", "him", "himself", "his",
    "how", "hows", "i", "id", "ill", "im", "ive", "if", "in",
    "into", "is", "isnt", "it", "its", "itself", "lets", "me",
    "more", "most", "mustnt", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shant",
    "she", "shed", "shell", "shes", "should", "shouldnt", "so",
    "some", "such", "than", "that", "thats", "the", "their",
    "theirs", "them", "themselves", "then", "there", "theres",
    "these", "they", "theyd", "theyll", "theyre", "theyve",
    "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "wasnt", "we", "wed", "well", "were",
    "weve", "were", "werent", "what", "whats", "when", "whens",
    "where", "wheres", "which", "while", "who", "whos", "whom",
    "why", "whys", "with", "wont", "would", "wouldnt", "you",
    "youd", "youll", "youre", "youve", "your", "yours", "yourself",
    "yourselves",
}

STOPWORDS = _TURKISH_STOPWORDS | _ENGLISH_STOPWORDS

# Turkish-specific Unicode characters for language-origin detection
_TURKISH_CHARS = set("ığüşöçİĞÜŞÖÇ")

# Regex to strip HTML tags
_HTML_TAG_RE = re.compile(r"<[^>]+>")
# Regex to strip URLs
_URL_RE = re.compile(r"https?://\S+|www\.\S+")
# Regex to split into words (keep Turkish chars + apostrophes for possessives)
_WORD_RE = re.compile(r"[a-zA-ZğüşıöçĞÜŞİÖÇ']+(?:'[a-zA-ZğüşıöçĞÜŞİÖÇ]+)?")


def _strip_html(text: str) -> str:
    """Remove HTML tags from review text."""
    return _HTML_TAG_RE.sub("", text)


def _strip_urls(text: str) -> str:
    """Remove URLs from review text."""
    return _URL_RE.sub("", text)


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase words, filtering stopwords and short tokens."""
    cleaned = _strip_html(_strip_urls(text))
    words = _WORD_RE.findall(cleaned)
    return [
        w.lower() for w in words
        if len(w) > 2 and w.lower() not in STOPWORDS
    ]


def _compute_bigrams(tokens: list[str]) -> list[tuple[str, str]]:
    """Generate bigrams from a token list."""
    return [(tokens[i], tokens[i + 1]) for i in range(len(tokens) - 1)]


def _guess_language(text: str) -> str:
    """
    Simple language-origin heuristic based on Turkish-specific characters.

    Returns 'tr', 'en', or 'mixed'.
    """
    cleaned = _strip_html(_strip_urls(text))
    turkish_char_count = sum(1 for c in cleaned if c in _TURKISH_CHARS)
    total_alpha = sum(1 for c in cleaned if c.isalpha())
    if total_alpha == 0:
        return "en"  # default
    ratio = turkish_char_count / total_alpha
    if ratio > 0.03:
        return "tr"
    return "en"


def compute_review_metrics(reviews_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Compute text analysis metrics from a Letterboxd reviews.csv DataFrame.

    Expected columns: Date, Name, Year, Rating, Rewatch, Review, Tags, Watched Date.
    Only 'Review' (text), 'Rating', 'Date', 'Rewatch', 'Name', 'Year' are used.

    Returns a dict suitable for inclusion in the stats response.
    """
    if reviews_df.empty:
        return {"total_reviews": 0, "reviews_with_text": 0}

    # --- Normalize columns ---
    df = reviews_df.copy()
    df.columns = df.columns.str.strip()

    # Rename to match internal convention
    rename_map = {}
    if "Name" in df.columns:
        rename_map["Name"] = "title"
    if "Year" in df.columns:
        rename_map["Year"] = "year"
    if "Review" in df.columns:
        rename_map["Review"] = "review"
    if "Rating" in df.columns:
        rename_map["Rating"] = "rating"
    if "Date" in df.columns:
        rename_map["Date"] = "date"
    if "Rewatch" in df.columns:
        rename_map["Rewatch"] = "rewatch"

    df = df.rename(columns=rename_map)

    # Convert year to string (pandas reads 4-digit years as float)
    if "year" in df.columns:
        df["year"] = df["year"].fillna("").astype(str).str.replace(r"\.0$", "", regex=True)

    # Ensure review column exists
    if "review" not in df.columns:
        return {"total_reviews": len(df), "reviews_with_text": 0}

    # Drop rows with no review text
    df["review"] = df["review"].fillna("").astype(str).str.strip()
    with_text = df[df["review"] != ""].copy()
    total_reviews = len(df)
    reviews_with_text = len(with_text)

    if reviews_with_text == 0:
        return {
            "total_reviews": total_reviews,
            "reviews_with_text": 0,
            "review_rate": 0.0,
        }

    # --- Tokenize all review text ---
    with_text["tokens"] = with_text["review"].apply(_tokenize)
    with_text["char_length"] = with_text["review"].apply(len)
    with_text["word_count"] = with_text["tokens"].apply(len)
    with_text["language"] = with_text["review"].apply(_guess_language)

    # --- Word frequency ---
    all_tokens: list[str] = []
    for tokens in with_text["tokens"]:
        all_tokens.extend(tokens)

    word_counts = Counter(all_tokens)
    top_words = [{"word": w, "count": c} for w, c in word_counts.most_common(50)]

    # --- Bigram frequency ---
    all_bigrams: list[tuple[str, str]] = []
    for tokens in with_text["tokens"]:
        all_bigrams.extend(_compute_bigrams(tokens))

    bigram_counter: Counter[str] = Counter()
    for w1, w2 in all_bigrams:
        if w1 in STOPWORDS or w2 in STOPWORDS:
            continue
        bigram_counter[f"{w1} {w2}"] += 1

    top_bigrams = [
        {"phrase": p, "count": c}
        for p, c in bigram_counter.most_common(20)
    ]

    # --- Review length by rating ---
    length_by_rating: list[dict] = []
    if "rating" in with_text.columns:
        rating_groups = with_text[with_text["rating"].notna()].groupby("rating")
        for rating_val, group in sorted(rating_groups):
            length_by_rating.append({
                "rating": float(rating_val),
                "avg_chars": round(float(group["char_length"].mean()), 1),
                "avg_words": round(float(group["word_count"].mean()), 1),
                "count": int(len(group)),
            })

    # --- Language mix ---
    lang_counts = with_text["language"].value_counts()
    total_lang = int(lang_counts.sum())
    language_mix = {}
    for lang in ["tr", "en", "mixed"]:
        count = int(lang_counts.get(lang, 0))
        if total_lang > 0:
            language_mix[lang] = {
                "count": count,
                "percentage": round((count / total_lang) * 100, 1),
            }
        else:
            language_mix[lang] = {"count": 0, "percentage": 0.0}

    # --- Review volume over time ---
    volume_by_year: list[dict] = []
    if "date" in with_text.columns:
        with_text["date"] = pd.to_datetime(with_text["date"], errors="coerce")
        yearly = with_text.dropna(subset=["date"])
        if not yearly.empty:
            yearly["year_str"] = yearly["date"].dt.year.astype(str)
            yearly_counts = yearly["year_str"].value_counts().sort_index()
            volume_by_year = [
                {"year": y, "count": int(c)}
                for y, c in yearly_counts.items()
            ]

    # --- Average length over time ---
    length_over_time: list[dict] = []
    if "date" in with_text.columns and not yearly.empty:
        # Group by year-month for granularity (only if >=3 reviews in a month)
        yearly["month_str"] = yearly["date"].dt.strftime("%Y-%m")
        monthly_groups = yearly.groupby("month_str")
        for month_str, group in sorted(monthly_groups):
            n = len(group)
            if n >= 3:
                length_over_time.append({
                    "month": month_str,
                    "avg_chars": round(float(group["char_length"].mean()), 1),
                    "avg_words": round(float(group["word_count"].mean()), 1),
                    "count": n,
                })

    # --- Longest / shortest ---
    longest_idx = with_text["char_length"].idxmax()
    shortest_idx = with_text[with_text["char_length"] > 0]["char_length"].idxmin()

    longest_review = None
    shortest_review = None
    if pd.notna(longest_idx):
        row = with_text.loc[longest_idx]
        longest_review = {
            "title": str(row.get("title", "")),
            "year": str(row.get("year", "")),
            "length": int(row["char_length"]),
        }
    if pd.notna(shortest_idx):
        row = with_text.loc[shortest_idx]
        shortest_review = {
            "title": str(row.get("title", "")),
            "year": str(row.get("year", "")),
            "length": int(row["char_length"]),
        }

    # --- Rewatch reviews ---
    rewatch_count = 0
    if "rewatch" in with_text.columns:
        rewatch_count = int(with_text["rewatch"].fillna("").astype(str).str.lower()
                            .eq("yes").sum())

    # --- Top 3 most-reviewed films ---
    title_year_counts: Counter[str] = Counter()
    for _, row in with_text.iterrows():
        key = f"{row.get('title', '?')} ({row.get('year', '?')})"
        title_year_counts[key] += 1

    most_reviewed = [
        {"film": f, "count": c}
        for f, c in title_year_counts.most_common(3)
    ]

    # --- Summary stats ---
    total_words = int(with_text["word_count"].sum())
    avg_chars = round(float(with_text["char_length"].mean()), 1)
    avg_words = round(float(with_text["word_count"].mean()), 1)

    # Estimate vocab richness: unique tokens / total tokens
    vocab_richness = round(len(word_counts) / total_words, 4) if total_words > 0 else 0.0

    return {
        "total_reviews": total_reviews,
        "reviews_with_text": reviews_with_text,
        "review_rate": round((reviews_with_text / total_reviews) * 100, 1) if total_reviews > 0 else 0.0,
        "total_words_written": total_words,
        "avg_review_length_chars": avg_chars,
        "avg_review_length_words": avg_words,
        "unique_words_used": len(word_counts),
        "vocab_richness": vocab_richness,
        "longest_review": longest_review,
        "shortest_review": shortest_review,
        "rewatch_reviews": rewatch_count,
        "word_frequency": top_words,
        "bigram_frequency": top_bigrams,
        "avg_length_by_rating": length_by_rating,
        "language_mix": language_mix,
        "review_volume_by_year": volume_by_year,
        "avg_length_over_time": length_over_time,
        "most_reviewed_films": most_reviewed,
    }
