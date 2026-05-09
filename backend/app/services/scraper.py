"""
Letterboxd public profile scraper.

Scrapes diary pages to extract film titles, years, ratings, and watch dates.
Converts to CSV-compatible dicts that feed into the existing analysis pipeline.

Uses requests (synchronous) because Letterboxd's bot protection requires
proper cookie/session handling that aiohttp doesn't replicate well.
"""

import re
import asyncio
import logging
from typing import Optional
from functools import partial
import time

import cloudscraper
from bs4 import BeautifulSoup

logger = logging.getLogger("letterboxd_wrapped.scraper")

BASE_URL = "https://letterboxd.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://letterboxd.com/",
}
PAGE_DELAY = 0.5  # seconds between requests
MAX_PAGES = 60    # safety cap (~3000 films)


def _is_cloudflare_block(body: str) -> bool:
    """Check if the response body is a Cloudflare challenge page."""
    return "Just a moment" in body[:500] and "challenges.cloudflare.com" in body[:1000]


def _parse_rating(rating_span) -> Optional[float]:
    """Extract star rating from a <span class="rating rated-N"> element."""
    if not rating_span:
        return None
    classes = rating_span.get("class", [])
    for c in classes:
        m = re.match(r"rated-(\d+)", c)
        if m:
            return int(m.group(1)) / 2  # half-stars → stars
    return None


def _parse_diary_rows(soup: BeautifulSoup) -> list[dict]:
    """Parse diary table rows into film dicts."""
    films = []
    for row in soup.select("tr.diary-entry-row"):
        title_td = row.select_one(".col-production")
        year_td = row.select_one(".col-releaseyear")
        rating_td = row.select_one(".col-rating")
        month_td = row.select_one(".col-monthdate")
        day_td = row.select_one(".col-daydate")

        title = ""
        if title_td:
            link = title_td.find("a")
            title = link.get_text(strip=True) if link else title_td.get_text(strip=True)

        year = year_td.get_text(strip=True) if year_td else ""
        rating = _parse_rating(rating_td.select_one(".rating") if rating_td else None)

        watch_date = ""
        if month_td and day_td:
            month_link = month_td.find("a")
            day_link = day_td.find("a")
            if month_link and day_link:
                href = day_link.get("href", "")
                date_match = re.search(r"/for/(\d{4})/(\d{2})/(\d{2})/", href)
                if date_match:
                    watch_date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"

        if title:
            films.append({
                "title": title,
                "year": year,
                "rating": rating,
                "watch_date": watch_date,
            })
    return films




def _sync_check_profile(username: str) -> bool:
    """Synchronous profile check — logs every outcome for debugging."""
    url = f"{BASE_URL}/{username}/"
    try:
        scraper = cloudscraper.create_scraper()
        scraper.headers.update(HEADERS)
        r = scraper.get(url, timeout=15)
        if r.status_code == 200:
            if _is_cloudflare_block(r.text):
                logger.warning("Profile check BLOCKED: %s → Cloudflare challenge", username)
                return False
            logger.info("Profile check OK: %s → 200", username)
            return True
        elif r.status_code == 404:
            logger.warning("Profile check FAILED: %s → 404 (user not found)", username)
        elif r.status_code == 403:
            logger.warning("Profile check FAILED: %s → 403 (blocked by Letterboxd)", username)
        else:
            logger.warning("Profile check FAILED: %s → %d (unexpected status)", username, r.status_code)
        # Log first 500 chars of body for diagnosis
        logger.debug("Response preview for %s: %s", username, r.text[:500])
        return False
    except Exception as exc:
        logger.warning("Profile check FAILED: %s → %s: %s", username, type(exc).__name__, exc)
        return False


def _parse_grid_items(soup: BeautifulSoup) -> list[dict]:
    """Parse film grid items (li.griditem) into film dicts.

    Grid has title + year (in data-item-name) + rating, but no watch_date.
    """
    films = []
    for li in soup.select("li.griditem"):
        poster = li.select_one('div[data-component-class="LazyPoster"]')
        if not poster:
            continue

        item_name = poster.get("data-item-name", "")
        slug = poster.get("data-item-slug", "")

        m = re.match(r"^(.+) \((\d{4})\)$", item_name)
        if m:
            title, year = m.group(1), m.group(2)
        else:
            title, year = item_name, ""

        rating = _parse_rating(li.select_one("span.rating"))

        if title:
            films.append({
                "title": title,
                "year": year,
                "rating": rating,
                "watch_date": "",
                "slug": slug,
            })
    return films


def _new_session() -> cloudscraper.CloudScraper:
    s = cloudscraper.create_scraper()
    s.headers.update(HEADERS)
    return s


def _warm_session(session: cloudscraper.CloudScraper) -> None:
    try:
        session.get(BASE_URL, timeout=10)  # warmup for cookies; failures non-fatal
    except Exception:
        pass
    time.sleep(0.3)


def _sync_scrape_films_grid(
    username: str,
    max_pages: int,
    session: Optional[cloudscraper.CloudScraper] = None,
) -> list[dict]:
    """Synchronous full-watched grid scraper.

    Hits /{user}/films/page/N/ which lists every film the user has marked
    watched (superset of diary entries — covers films with no logged date).
    """
    owns_session = session is None
    logger.info("Starting grid scrape for %s (max_pages=%d)", username, max_pages)
    s = session or _new_session()
    if owns_session:
        _warm_session(s)

    all_films: list[dict] = []

    try:
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/{username}/films/page/{page}/"
            logger.debug("Grid page %d: GET %s", page, url)
            r = s.get(url, timeout=10)

            if r.status_code == 404:
                logger.warning("Grid page %d: 404 for %s", page, username)
                if page == 1:
                    raise ValueError(f"User '{username}' not found")
                break
            if r.status_code != 200:
                logger.warning("Grid page %d: unexpected status %d for %s", page, r.status_code, username)
                break
            if _is_cloudflare_block(r.text):
                logger.warning("Grid page %d: Cloudflare block for %s", page, username)
                break

            soup = BeautifulSoup(r.text, "html.parser")
            films = _parse_grid_items(soup)

            if not films:
                break

            all_films.extend(films)
            time.sleep(PAGE_DELAY)
    finally:
        if owns_session:
            s.close()

    logger.info("Grid scrape complete for %s: %d films", username, len(all_films))
    return all_films


def _sync_scrape_watchlist(
    username: str,
    max_pages: int,
    session: Optional[cloudscraper.CloudScraper] = None,
) -> list[dict]:
    """Synchronous public watchlist scraper.

    Hits /{user}/watchlist/page/N/ and parses the same Letterboxd grid items
    used by watched-films pages.
    """
    owns_session = session is None
    logger.info("Starting watchlist scrape for %s (max_pages=%d)", username, max_pages)
    s = session or _new_session()
    if owns_session:
        _warm_session(s)

    all_films: list[dict] = []

    try:
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/{username}/watchlist/page/{page}/"
            logger.debug("Watchlist page %d: GET %s", page, url)
            r = s.get(url, timeout=10)

            if r.status_code == 404:
                logger.warning("Watchlist page %d: 404 for %s", page, username)
                if page == 1:
                    raise ValueError(f"User '{username}' not found")
                break
            if r.status_code != 200:
                logger.warning("Watchlist page %d: unexpected status %d for %s", page, r.status_code, username)
                break

            soup = BeautifulSoup(r.text, "html.parser")
            films = _parse_grid_items(soup)

            if not films:
                break

            all_films.extend(films)
            time.sleep(PAGE_DELAY)
    finally:
        if owns_session:
            s.close()

    logger.info("Watchlist scrape complete for %s: %d films", username, len(all_films))
    return all_films


def _sync_scrape_diary(
    username: str,
    max_pages: int,
    session: Optional[cloudscraper.CloudScraper] = None,
) -> list[dict]:
    """Synchronous diary scraper with session cookies."""
    owns_session = session is None
    logger.info("Starting diary scrape for %s (max_pages=%d)", username, max_pages)
    s = session or _new_session()
    if owns_session:
        _warm_session(s)

    all_films: list[dict] = []

    try:
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/{username}/films/diary/page/{page}/"
            logger.debug("Diary page %d: GET %s", page, url)
            r = s.get(url, timeout=10)

            if r.status_code == 404:
                logger.warning("Diary page %d: 404 for %s", page, username)
                if page == 1:
                    raise ValueError(f"User '{username}' not found")
                break
            if r.status_code != 200:
                logger.warning("Diary page %d: unexpected status %d for %s", page, r.status_code, username)
                break
            if _is_cloudflare_block(r.text):
                logger.warning("Diary page %d: Cloudflare block for %s", page, username)
                break

            soup = BeautifulSoup(r.text, "html.parser")
            films = _parse_diary_rows(soup)

            if not films:
                break

            all_films.extend(films)
            time.sleep(PAGE_DELAY)
    finally:
        if owns_session:
            s.close()


    logger.info("Diary scrape complete for %s: %d films", username, len(all_films))
    return all_films


def _sync_scrape_profile_sources(username: str, max_pages: int) -> tuple[list[dict], list[dict]]:
    """Scrape diary and grid in one warmed requests session.

    Sharing cookies across both page families keeps the public-profile scan
    closer to a single browser visit and avoids losing diary dates after one
    source has already established Letterboxd session state.
    """
    logger.info("Starting combined profile scrape for %s", username)
    with _new_session() as session:
        _warm_session(session)
        diary = _sync_scrape_diary(username, max_pages, session=session)
        grid = _sync_scrape_films_grid(username, max_pages, session=session)
        logger.info("Combined scrape complete for %s: diary=%d grid=%d", username, len(diary), len(grid))
        return diary, grid


async def check_profile_exists(username: str) -> bool:
    """Check if a Letterboxd profile exists (async wrapper).

    Returns True if the profile URL returns 200.
    All failures (404, 403, timeout, etc.) are logged in detail
    by _sync_check_profile.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_sync_check_profile, username))


async def scrape_diary(username: str, max_pages: int = MAX_PAGES) -> list[dict]:
    """
    Scrape a user's diary pages and return list of film dicts.

    Each dict has: title, year, rating (float or None), watch_date (YYYY-MM-DD or "").
    Runs synchronous requests in a thread executor to avoid blocking the event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_sync_scrape_diary, username, max_pages)
    )


async def scrape_films_grid(username: str, max_pages: int = MAX_PAGES) -> list[dict]:
    """Scrape the full watched-films grid (superset of diary)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_sync_scrape_films_grid, username, max_pages)
    )


async def scrape_watchlist(username: str, max_pages: int = MAX_PAGES) -> list[dict]:
    """Scrape a user's public watchlist."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_sync_scrape_watchlist, username, max_pages)
    )


async def scrape_profile_sources(username: str, max_pages: int = MAX_PAGES) -> tuple[list[dict], list[dict]]:
    """Scrape diary and grid with a shared requests session."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_sync_scrape_profile_sources, username, max_pages)
    )


def merge_scraped_films(diary: list[dict], grid: list[dict]) -> list[dict]:
    """Merge diary + grid films, preferring diary entries (they have watch_date).

    Dedup by (lowercased title, year). Returns diary entries first, then any
    grid-only films (films marked watched but never logged with a date).
    """
    def key(f: dict) -> tuple[str, str]:
        return (f.get("title", "").strip().lower(), f.get("year", ""))

    seen = {key(f) for f in diary}
    extras = [f for f in grid if key(f) not in seen]
    return list(diary) + extras


def diary_to_csv_dicts(films: list[dict]) -> dict[str, list[dict]]:
    """
    Convert scraped diary films to CSV-compatible dicts matching Letterboxd export format.

    Returns dict with 'watched' and 'ratings' keys, each a list of row dicts.
    """
    seen = set()
    watched_rows = []
    ratings_rows = []

    for f in films:
        key = (f["title"], f["year"])
        if key in seen:
            continue
        seen.add(key)

        watched_rows.append({
            "Name": f["title"],
            "Year": f["year"],
        })

        if f["rating"] is not None:
            ratings_rows.append({
                "Name": f["title"],
                "Year": f["year"],
                "Rating": f["rating"],
            })

    return {"watched": watched_rows, "ratings": ratings_rows}
