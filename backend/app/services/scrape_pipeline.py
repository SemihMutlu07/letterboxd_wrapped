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
from time import monotonic
import uuid
from pathlib import Path
from typing import Any, Callable, Optional

from app.services.analysis import process_comprehensive_letterboxd_data
from app.services.review_analysis import enrich_scraped_reviews
from app.services.scraper import (
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


TraceCallback = Callable[[str, str, Optional[dict[str, Any]]], None]


async def scrape_and_analyze(
    session,
    username: str,
    *,
    max_pages: int = 60,
    trace_callback: Optional[TraceCallback] = None,
) -> dict:
    """Scrape a public profile and run the full analysis pipeline.

    Returns the stats dict (with scraped_* provenance fields) on success.
    Raises:
        ValueError         — Letterboxd 404 / 403 / rate-limit / block
        ScrapeAnalysisEmpty — no usable films
        Exception          — any other unexpected failure
    """
    if trace_callback:
        trace_callback("scrape_started", "Scrape started", {"username": username, "max_pages": max_pages})
    scrape_started = monotonic()
    sources = await scrape_profile_sources(
        username,
        max_pages=max_pages,
        include_reviews=True,
        trace_callback=trace_callback,
    )
    scrape_seconds = round(monotonic() - scrape_started, 1)
    if trace_callback:
        trace_callback(
            "scrape_done",
            "Scrape completed",
            {
                "scrape_seconds": scrape_seconds,
                "diary": len(sources.diary),
                "grid": len(sources.grid),
                "reviews": len(sources.reviews),
                "film_count": sources.film_count,
                "review_count": sources.review_count,
            },
        )

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

        if trace_callback:
            trace_callback("analysis_started", "Analysis started", {"films": len(films)})
        analysis_started = monotonic()
        stats = await process_comprehensive_letterboxd_data(session, csv_files)
        analysis_seconds = round(monotonic() - analysis_started, 1)
        if trace_callback:
            trace_callback("analysis_done", "Analysis completed", {"analysis_seconds": analysis_seconds})
        stats["scraped_username"] = username
        stats["scraped_film_count"] = len(films)
        stats["scraped_diary_count"] = len(sources.diary)
        stats["scraped_grid_only_count"] = len(films) - len(sources.diary)
        stats["scraped_review_count"] = sources.review_count
        stats["scraped_film_count_estimated"] = sources.film_count
        stats["scraped_reviews_with_text"] = sum(1 for r in sources.reviews if r.get("review_text"))
        stats["profile_avatar_url"] = sources.profile_avatar_url

        # Merge scraped liker identities + poster paths into the review payload.
        # The reviews.csv round-trip above is lossy (drops likers/review_path),
        # so re-attach from the rich scraped objects, matched by title+year.
        if sources.reviews and isinstance(stats.get("review_analysis"), dict):
            enrich_scraped_reviews(
                stats["review_analysis"], sources.reviews, stats.get("all_films", [])
            )

        # Enrich profile favorite films with poster_path via title match against enriched data
        if sources.favorite_films:
            poster_by_title = {
                f["title"].lower(): f.get("poster_path", "")
                for f in stats.get("all_films", [])
                if f.get("title")
            }
            stats["favorite_films"] = [
                {
                    "title": f["title"],
                    "year": f.get("year"),
                    "poster_path": poster_by_title.get(f["title"].lower(), ""),
                }
                for f in sources.favorite_films
            ]
        else:
            stats["favorite_films"] = []

        return stats
    finally:
        if request_dir is not None:
            shutil.rmtree(request_dir, ignore_errors=True)
