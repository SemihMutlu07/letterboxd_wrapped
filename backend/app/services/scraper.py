"""
Letterboxd public profile scraper.

Scrapes diary pages to extract film titles, years, ratings, and watch dates.
Converts to CSV-compatible dicts that feed into the existing analysis pipeline.

Uses requests (synchronous) because Letterboxd's bot protection requires
proper cookie/session handling that aiohttp doesn't replicate well.
"""

import re
import asyncio
from typing import Optional
from functools import partial

import requests
from bs4 import BeautifulSoup

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
    """Synchronous profile check."""
    try:
        r = requests.get(f"{BASE_URL}/{username}/", headers=HEADERS, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
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


def _sync_scrape_films_grid(username: str, max_pages: int) -> list[dict]:
    """Synchronous full-watched grid scraper.

    Hits /{user}/films/page/N/ which lists every film the user has marked
    watched (superset of diary entries — covers films with no logged date).
    """
    import time

    s = requests.Session()
    s.headers.update(HEADERS)

    try:
        s.get(BASE_URL, timeout=10)  # warmup for cookies; failures non-fatal
    except requests.RequestException:
        pass
    time.sleep(0.3)

    all_films: list[dict] = []

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/{username}/films/page/{page}/"
        r = s.get(url, timeout=10)

        if r.status_code == 404:
            if page == 1:
                raise ValueError(f"User '{username}' not found")
            break
        if r.status_code != 200:
            break

        soup = BeautifulSoup(r.text, "html.parser")
        films = _parse_grid_items(soup)

        if not films:
            break

        all_films.extend(films)
        time.sleep(PAGE_DELAY)

    return all_films


def _sync_scrape_diary(username: str, max_pages: int) -> list[dict]:
    """Synchronous diary scraper with session cookies."""
    import time

    s = requests.Session()
    s.headers.update(HEADERS)

    # Warm up session with homepage cookies
    try:
        s.get(BASE_URL, timeout=10)  # warmup for cookies; failures non-fatal
    except requests.RequestException:
        pass
    time.sleep(0.3)

    all_films: list[dict] = []

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/{username}/films/diary/page/{page}/"
        r = s.get(url, timeout=10)

        if r.status_code == 404:
            if page == 1:
                raise ValueError(f"User '{username}' not found")
            break
        if r.status_code != 200:
            break

        soup = BeautifulSoup(r.text, "html.parser")
        films = _parse_diary_rows(soup)

        if not films:
            break

        all_films.extend(films)
        time.sleep(PAGE_DELAY)

    return all_films


async def check_profile_exists(username: str) -> bool:
    """Check if a Letterboxd profile exists (async wrapper)."""
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
