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
from calendar import monthrange
from datetime import date, datetime, timezone
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

VALID_ANALYSIS_PERIODS = {"month", "year", "lifetime"}


class ScrapeAnalysisEmpty(Exception):
    """Raised when scraping produced no usable films.

    `scraper_ok` distinguishes "the scraper worked but the profile is genuinely
    empty/private" (False) from "the scraper saw a film count but the parse came
    back empty — likely a scraper bug" (True).
    """

    def __init__(self, username: str, *, scraper_ok: bool, period_empty: bool = False):
        self.username = username
        self.scraper_ok = scraper_ok
        self.period_empty = period_empty
        super().__init__(
            f"Scrape of @{username} returned no usable films "
            f"(scraper_ok={scraper_ok}, period_empty={period_empty})."
        )


TraceCallback = Callable[[str, str, Optional[dict[str, Any]]], None]


def normalize_analysis_period(value: Any) -> str:
    """Validate the public analysis-period contract, defaulting to one year."""
    if value is None:
        return "year"
    period = str(value).strip().lower()
    if period not in VALID_ANALYSIS_PERIODS:
        raise ValueError("analysis_period must be one of: month, year, lifetime")
    return period


def analysis_period_bounds(
    period: str,
    *,
    today: date | None = None,
) -> tuple[date | None, date]:
    """Return inclusive calendar bounds for an analysis period."""
    period = normalize_analysis_period(period)
    end_date = today or datetime.now(timezone.utc).date()
    if period == "lifetime":
        return None, end_date
    if period == "year":
        start_year = end_date.year - 1
        start_day = min(end_date.day, monthrange(start_year, end_date.month)[1])
        return end_date.replace(year=start_year, day=start_day), end_date

    start_year = end_date.year if end_date.month > 1 else end_date.year - 1
    start_month = end_date.month - 1 if end_date.month > 1 else 12
    start_day = min(end_date.day, monthrange(start_year, start_month)[1])
    return date(start_year, start_month, start_day), end_date


def _date_in_period(value: Any, start_date: date, end_date: date) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = date.fromisoformat(value[:10])
    except ValueError:
        return False
    return start_date <= parsed <= end_date


async def scrape_and_analyze(
    session,
    username: str,
    *,
    max_pages: int = 60,
    trace_callback: Optional[TraceCallback] = None,
    analysis_period: str = "year",
) -> dict:
    """Scrape a public profile and run the full analysis pipeline.

    Returns the stats dict (with scraped_* provenance fields) on success.
    Raises:
        ValueError         — Letterboxd 404 / 403 / rate-limit / block
        ScrapeAnalysisEmpty — no usable films
        Exception          — any other unexpected failure
    """
    period = normalize_analysis_period(analysis_period)
    start_date, end_date = analysis_period_bounds(period)
    if trace_callback:
        trace_callback(
            "scrape_started",
            "Scrape started",
            {"username": username, "max_pages": max_pages, "analysis_period": period},
        )
    scrape_started = monotonic()
    sources = await scrape_profile_sources(
        username,
        max_pages=max_pages,
        include_reviews=True,
        trace_callback=trace_callback,
        diary_cutoff=start_date,
        include_grid=period == "lifetime",
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

    diary = sources.diary
    reviews = sources.reviews
    if start_date is not None:
        diary = [
            film
            for film in diary
            if _date_in_period(film.get("watch_date"), start_date, end_date)
        ]
        reviews = [
            review
            for review in reviews
            if _date_in_period(review.get("date"), start_date, end_date)
        ]

    films = merge_scraped_films(diary, sources.grid if period == "lifetime" else [])
    csv_dicts = diary_to_csv_dicts(films)
    if not films or not csv_dicts["watched"]:
        # Classify against the *unfiltered* scrape. Blaming the period whenever
        # one is set would report a blocked, private or broken scrape as "no
        # films in the selected period" — and since `year` is the default, that
        # would hide scraper breakage on the common path.
        scraped_anything = len(sources.diary) > 0 or len(sources.grid) > 0
        scraper_ok = sources.film_count > 0 and scraped_anything
        if start_date is not None and scraped_anything:
            raise ScrapeAnalysisEmpty(username, scraper_ok=True, period_empty=True)
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
        if reviews:
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
                for r in reviews
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
        stats["scraped_diary_count"] = len(diary)
        stats["scraped_grid_only_count"] = len(films) - len(diary)
        stats["scraped_review_count"] = sources.review_count
        stats["scraped_film_count_estimated"] = sources.film_count
        stats["scraped_reviews_with_text"] = sum(1 for r in reviews if r.get("review_text"))
        stats["profile_avatar_url"] = sources.profile_avatar_url
        stats["analysis_period"] = {
            "key": period,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat(),
        }

        # Merge scraped liker identities + poster paths into the review payload.
        # The reviews.csv round-trip above is lossy (drops likers/review_path),
        # so re-attach from the rich scraped objects, matched by title+year.
        if reviews and isinstance(stats.get("review_analysis"), dict):
            enrich_scraped_reviews(
                stats["review_analysis"], reviews, stats.get("all_films", [])
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
