"""
Shared Letterboxd scrape → analysis pipeline.

This is the single code path that turns a public username into Wrapped stats by
scraping Letterboxd HTML and running the same analysis used for CSV uploads. It
is intentionally transport-agnostic so two callers can reuse it identically:

  - the synchronous /api/scrape-profile route (local dev / no desktop worker), and
  - the outbound desktop scrape worker (production heavy-scrape executor).

The route maps the exceptions below to HTTP status codes; the worker maps them
to a failed job state. Keep HTTP concerns out of this module.
"""
from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from app.services.analysis import process_comprehensive_letterboxd_data
from app.services.scraper import (
    ScraperAPIError,  # noqa: F401 — re-exported for callers that catch it
    diary_to_csv_dicts,
    merge_scraped_films,
    scrape_profile_sources,
)

logger = logging.getLogger("letterboxd_wrapped.scrape_pipeline")


class ScrapeAnalysisEmpty(Exception):
    """Raised when scraping produced no usable films.

    `scraper_ok` distinguishes "the scraper worked but the profile is genuinely
    empty/private" (False) from "the scraper saw a film count but the parse came
    back empty — likely a scraper bug" (True).
    """

    def __init__(self, username: str, *, scraper_ok: bool):
        self.username = username
        self.scraper_ok = scraper_ok
        super().__init__(
            f"Scrape of @{username} returned no usable films (scraper_ok={scraper_ok})."
        )


async def scrape_and_analyze(session, username: str, *, max_pages: int = 60) -> dict:
    """Scrape a public profile and run the full analysis pipeline.

    Returns the stats dict (with scraped_* provenance fields) on success.
    Raises:
        ScraperAPIError    — ScraperAPI itself failed (quota / key / upstream 5xx)
        ValueError         — Letterboxd 404 / 403 / rate-limit / block
        ScrapeAnalysisEmpty — no usable films
        Exception          — any other unexpected failure
    """
    sources = await scrape_profile_sources(username, max_pages=max_pages, include_reviews=True)

    logger.info(
        "scrape_and_analyze: %s diary=%d grid=%d reviews=%d films=%d scraped_reviews=%d",
        username, len(sources.diary), len(sources.grid),
        sources.review_count, sources.film_count, len(sources.reviews),
    )

    films = merge_scraped_films(sources.diary, sources.grid)
    csv_dicts = diary_to_csv_dicts(films)
    if not films or not csv_dicts["watched"]:
        scraper_ok = sources.film_count > 0 and (len(sources.diary) > 0 or len(sources.grid) > 0)
        raise ScrapeAnalysisEmpty(username, scraper_ok=scraper_ok)

    request_dir: Optional[Path] = None
    try:
        import pandas as pd

        request_dir = Path("uploads") / str(uuid.uuid4())
        request_dir.mkdir(parents=True, exist_ok=True)

        watched_path = request_dir / "watched.csv"
        pd.DataFrame(csv_dicts["watched"]).to_csv(watched_path, index=False)
        csv_files = {"watched.csv": str(watched_path)}

        if csv_dicts["ratings"]:
            ratings_path = request_dir / "ratings.csv"
            pd.DataFrame(csv_dicts["ratings"]).to_csv(ratings_path, index=False)
            csv_files["ratings.csv"] = str(ratings_path)

        if csv_dicts.get("diary"):
            diary_path = request_dir / "diary.csv"
            pd.DataFrame(csv_dicts["diary"]).to_csv(diary_path, index=False)
            csv_files["diary.csv"] = str(diary_path)

        # Synthesize reviews.csv from scraped HTML so the existing
        # compute_review_metrics path is reused for both upload and scrape flows.
        if sources.reviews:
            reviews_path = request_dir / "reviews.csv"
            review_rows = [
                {
                    "Date": r.get("date", ""),
                    "Name": r.get("title", ""),
                    "Year": r.get("year", ""),
                    "Rating": r.get("rating"),
                    "Rewatch": "",
                    "Review": r.get("review_text", ""),
                    "Tags": "",
                    "Watched Date": "",
                    "Likes": r.get("like_count") if r.get("like_count") is not None else "",
                    "Slug": r.get("slug", ""),
                }
                for r in sources.reviews
            ]
            pd.DataFrame(review_rows).to_csv(reviews_path, index=False)
            csv_files["reviews.csv"] = str(reviews_path)

        stats = await process_comprehensive_letterboxd_data(session, csv_files)
        stats["scraped_username"] = username
        stats["scraped_film_count"] = len(films)
        stats["scraped_diary_count"] = len(sources.diary)
        stats["scraped_grid_only_count"] = len(films) - len(sources.diary)
        stats["scraped_review_count"] = sources.review_count
        stats["scraped_film_count_estimated"] = sources.film_count
        stats["scraped_reviews_with_text"] = sum(1 for r in sources.reviews if r.get("review_text"))
        return stats
    finally:
        if request_dir is not None:
            shutil.rmtree(request_dir, ignore_errors=True)
