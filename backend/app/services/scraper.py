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
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from functools import partial
import time

import cloudscraper
from bs4 import BeautifulSoup

logger = logging.getLogger("letterboxd_wrapped.scraper")


def _fetch(session: "cloudscraper.CloudScraper", url: str, timeout: int = 10):
    """Fetch a Letterboxd URL directly via the warmed cloudscraper session.

    All scrapes run from a residential IP (the desktop worker, or local dev) —
    the ScraperAPI proxy path was removed entirely on 2026-07-02. Responses
    (200/404/403/etc.) are returned unchanged for the caller to interpret.
    """
    return session.get(url, timeout=timeout)


@dataclass(frozen=True)
class ProfileScrapeSources:
    """Result of scraping a public Letterboxd profile in one warmed session.

    Returned as a named object instead of a tuple so callers cannot accidentally
    splat the wrong number of arguments into downstream helpers like
    `merge_scraped_films(diary, grid)`.
    """
    diary: list[dict]
    grid: list[dict]
    review_count: int = 0
    film_count: int = 0
    reviews: list[dict] = field(default_factory=list)
    favorite_films: list[dict] = field(default_factory=list)  # up to 4 pinned profile favorites


TraceCallback = Callable[[str, str, Optional[dict[str, Any]]], None]


def _trace(
    trace_callback: Optional[TraceCallback],
    stage: str,
    message: str,
    metrics: Optional[dict[str, Any]] = None,
) -> None:
    if trace_callback:
        trace_callback(stage, message, metrics)

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
PAGE_DELAY = float(os.getenv("LETTERBOXD_PAGE_DELAY", "0.25"))
MAX_PAGES = 60    # safety cap (~3000 films)
LIKES_FALLBACK_MAX = int(os.getenv("LETTERBOXD_LIKES_FALLBACK_MAX", "25"))


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
        day_td = row.select_one(".col-daydate")

        title = ""
        if title_td:
            link = title_td.find("a")
            title = link.get_text(strip=True) if link else title_td.get_text(strip=True)

        year = year_td.get_text(strip=True) if year_td else ""
        rating = _parse_rating(rating_td.select_one(".rating") if rating_td else None)

        watch_date = ""
        # The day cell's href carries the full /for/YYYY/MM/DD/ date. Letterboxd
        # only renders the month <a> on the first row of each month, so requiring
        # it would drop the date from every later row in the month.
        day_link = day_td.find("a") if day_td else None
        if day_link:
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
        r = _fetch(scraper, url, timeout=15)
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


def _normalize_poster_url(url: str) -> str:
    """Ensure a poster URL is absolute and browser-safe."""
    if not url:
        return url
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://letterboxd.com" + url
    return url

def _parse_grid_items(soup: BeautifulSoup) -> list[dict]:
    """Parse film grid items from Letterboxd grid pages.

    Tries multiple DOM strategies because Letterboxd changes their HTML
    structure unpredictably. The returned list is deduped by (title, year).
    """
    films: list[dict] = []

    # Strategy 1: legacy selector (pre-mid 2025)
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

        poster_url = ""
        if poster.has_attr("data-poster-url"):
            poster_url = str(poster.get("data-poster-url") or "")
        if not poster_url:
            img = poster.find("img") or li.find("img")
            if img:
                poster_url = str(img.get("data-src") or img.get("src") or "")
        poster_url = _normalize_poster_url(poster_url)
        if title:
            films.append({
                "title": title,
                "year": year,
                "rating": rating,
                "watch_date": "",
                "slug": slug,
                "poster_url": poster_url,
            })

    if films:
        return films

    # Strategy 2: poster-container selector (mid-2025 onwards)
    for container in soup.select("li.poster-container, div.poster-container"):
        img = container.find("img")
        title = ""
        year = ""
        slug = ""
        poster_url = ""
        if img:
            alt = str(img.get("alt") or "").strip()
            m = re.match(r"^(.+)\s*\((\d{4})\)$", alt)
            if m:
                title, year = m.group(1).strip(), m.group(2)
            else:
                title = alt
            poster_url = str(img.get("src") or img.get("data-src") or "")
        poster_url = _normalize_poster_url(poster_url)

        if not slug:
            poster_div = container.select_one("[data-film-slug]")
            if poster_div:
                slug = str(poster_div.get("data-film-slug") or "")
        if not slug:
            link = container.find("a", href=re.compile(r"/film/"))
            if link:
                href = str(link.get("href") or "")
                m = re.search(r"/film/([^/]+)/", href)
                if m:
                    slug = m.group(1)

        if title:
            films.append({
                "title": title,
                "year": year,
                "rating": None,
                "watch_date": "",
                "slug": slug,
                "poster_url": poster_url,
            })

    if films:
        return films

    # Strategy 3: generic fallback (any img with film title pattern)
    seen: set[tuple[str, str]] = set()
    for img in soup.find_all("img"):
        alt = str(img.get("alt") or "").strip()
        m = re.match(r"^(.+)\s*\((\d{4})\)$", alt)
        if not m:
            continue
        title_raw, year = m.group(1).strip(), m.group(2)
        key = (title_raw.lower(), year)
        if key in seen:
            continue
        seen.add(key)

        slug = ""
        for parent in [img.parent, img.parent.parent if img.parent else None]:
            if parent is None:
                continue
            link = parent.find("a", href=re.compile(r"/film/")) if hasattr(parent, "find") else None
            if link:
                href = str(link.get("href") or "")
                m2 = re.search(r"/film/([^/]+)/", href)
                if m2:
                    slug = m2.group(1)
                    break
            data_slug = parent.get("data-film-slug") if hasattr(parent, "get") else None
            if data_slug:
                slug = str(data_slug)
                break

        poster_url = str(img.get("src") or img.get("data-src") or "")
        poster_url = _normalize_poster_url(poster_url)

        films.append({
            "title": title_raw,
            "year": year,
            "rating": None,
            "watch_date": "",
            "slug": slug,
            "poster_url": poster_url,
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
    trace_callback: Optional[TraceCallback] = None,
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
            r = _fetch(s, url, timeout=10)

            if r.status_code == 404:
                logger.warning("Grid page %d: 404 for %s", page, username)
                if page == 1:
                    raise ValueError(f"User '{username}' not found")
                break
            if r.status_code == 403:
                logger.error("Letterboxd returned 403 for %s page %d — bot detection blocked this IP", username, page)
                raise ValueError(
                    "Letterboxd is blocking automated access to this profile. "
                    "Please download your Letterboxd export and upload it for the best experience."
                )
            if r.status_code == 429:
                logger.warning("Letterboxd rate-limited request for %s page %d", username, page)
                raise ValueError(
                    "Letterboxd rate limit hit. Please wait a moment and try again, or use the export upload option."
                )
            if _is_cloudflare_block(r.text):
                logger.warning("Grid page %d: Cloudflare block for %s", page, username)
                break

            soup = BeautifulSoup(r.text, "html.parser")
            films = _parse_grid_items(soup)
            logger.info("Grid page %d parsed %d films for %s", page, len(films), username)
            _trace(
                trace_callback,
                "grid_page",
                f"Grid page {page} parsed",
                {"page": page, "films": len(films), "status_code": r.status_code},
            )
            if not films:
                has_griditem = bool(soup.select("li.griditem"))
                has_poster_container = bool(soup.select("li.poster-container, div.poster-container"))
                img_count = len(soup.find_all("img"))
                logger.warning(
                    "Grid page %d empty parse for %s: griditem=%s poster_container=%s img_count=%d html_len=%d",
                    page, username, has_griditem, has_poster_container, img_count, len(r.text),
                )
                break

            all_films.extend(films)
            time.sleep(PAGE_DELAY)
    finally:
        if owns_session:
            s.close()

    logger.info("Grid scrape complete for %s: %d films", username, len(all_films))
    _trace(trace_callback, "grid_done", "Grid scrape completed", {"films": len(all_films)})
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
            r = _fetch(s, url, timeout=10)

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
    trace_callback: Optional[TraceCallback] = None,
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
            r = _fetch(s, url, timeout=10)

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
            logger.info("Diary page %d parsed %d films for %s", page, len(films), username)
            _trace(
                trace_callback,
                "diary_page",
                f"Diary page {page} parsed",
                {"page": page, "films": len(films), "status_code": r.status_code},
            )

            if not films:
                break

            all_films.extend(films)
            time.sleep(PAGE_DELAY)
    finally:
        if owns_session:
            s.close()

    logger.info("Diary scrape complete for %s: %d films", username, len(all_films))
    _trace(trace_callback, "diary_done", "Diary scrape completed", {"films": len(all_films)})
    return all_films


def _rating_from_svg_label(label: str) -> Optional[float]:
    """Parse Letterboxd's SVG star label like '★★★★' or '★★½' into a float."""
    if not label:
        return None
    full = label.count("★")
    half = 0.5 if ("½" in label) else 0.0
    if full == 0 and half == 0:
        return None
    return full + half


def _parse_review_cards(soup: BeautifulSoup, username: str = "") -> list[dict]:
    """Parse Letterboxd review list HTML into review dicts.

    Targets the per-review <article class="production-viewing"> cards used on
    /{username}/reviews/films/page/N/. Like counts come from the
    LikeComponent's data-count attribute on the same card (best-effort — see
    `_sync_fetch_like_count` for the /likes/ page fallback when absent).

    Returns dicts shaped like:
        {title, year, slug, rating, review_text, date, like_count,
         review_url, likes_url, word_count, text_length, has_likes_page}
    """
    reviews: list[dict] = []
    for article in soup.select("article.production-viewing"):
        # Slug + canonical name from the LazyPoster data attributes
        poster = article.select_one('[data-component-class="LazyPoster"]')
        slug = ""
        if poster:
            slug = str(poster.get("data-item-slug") or "")

        # Title from the primaryname heading
        headline = article.select_one("h2.primaryname a") or article.select_one("h2 a")
        title = headline.get_text(strip=True) if headline else ""
        href = str(headline.get("href") or "") if headline else ""
        if not slug and href:
            m = re.search(r"/film/([^/]+)/?", href)
            if m:
                slug = m.group(1)

        # The headline href (e.g. "/{username}/film/{slug}/") is itself the
        # user's review permalink on Letterboxd — no separate review URL exists.
        review_url = f"{BASE_URL}{href}" if href else None
        likes_url = f"{BASE_URL}/{username}/film/{slug}/likes/" if (username and slug) else None

        # Year — comes from <span class="releasedate">
        year_el = article.select_one("span.releasedate")
        year = year_el.get_text(strip=True) if year_el else ""

        # Rating — SVG aria-label like "★★★★" or "★★½"
        rating: Optional[float] = None
        rating_svg = article.select_one("span.inline-rating svg, .inline-rating svg")
        if rating_svg and rating_svg.has_attr("aria-label"):
            rating = _rating_from_svg_label(str(rating_svg.get("aria-label") or ""))

        # Review body — collapsed-text wraps the visible paragraphs
        body = article.select_one(".js-review-body, .body-text")
        review_text = ""
        if body:
            review_text = body.get_text(separator=" ", strip=True)

        # Review date from <time class="timestamp" datetime="YYYY-MM-DD">
        time_el = article.select_one("time.timestamp")
        date = ""
        if time_el:
            if time_el.has_attr("datetime"):
                date = str(time_el.get("datetime") or "")
            else:
                date = time_el.get_text(strip=True)

        # Like count — LikeComponent on the review actions
        like_count: Optional[int] = None
        like_el = article.select_one('[data-component-class="LikeComponent"][data-count]')
        if like_el is not None:
            raw = str(like_el.get("data-count") or "").strip()
            try:
                like_count = int(raw) if raw else None
            except ValueError:
                like_count = None

        if title:
            reviews.append({
                "title": title,
                "year": year,
                "slug": slug,
                "rating": rating,
                "review_text": review_text,
                "date": date,
                "like_count": like_count,
                "review_url": review_url,
                "likes_url": likes_url,
                "word_count": len(review_text.split()) if review_text else 0,
                "text_length": len(review_text),
                "has_likes_page": bool(slug),
            })
    return reviews


def _sync_fetch_like_count(session: "cloudscraper.CloudScraper", username: str, slug: str) -> int:
    """Fetch the liker count from a review's /likes/ page. Best-effort fallback

    for when the inline LikeComponent data-count is absent. Any failure (404,
    network error, unparseable page) must resolve to 0 likes, never raise —
    a missing likes page means "nobody has liked this yet", not an error.
    """
    url = f"{BASE_URL}/{username}/film/{slug}/likes/"
    try:
        r = _fetch(session, url, timeout=10)
        if r.status_code != 200:
            return 0
        soup = BeautifulSoup(r.text, "html.parser")
        likers = soup.select("li.person-summary, ul.avatars li, li.griditem")
        return len(likers)
    except Exception:
        return 0


def _sync_scrape_reviews(
    username: str,
    max_pages: int,
    session: Optional[cloudscraper.CloudScraper] = None,
    trace_callback: Optional[TraceCallback] = None,
) -> list[dict]:
    """Single-pass scraper for /{username}/reviews/films/page/N/.

    Walks pages until an empty/404 response. Like counts come from data-count
    on each card first; reviews still missing a count get a best-effort
    /likes/ page fetch afterward, capped at LIKES_FALLBACK_MAX.
    """
    owns_session = session is None
    logger.info("Starting review scrape for %s (max_pages=%d)", username, max_pages)
    s = session or _new_session()
    if owns_session:
        _warm_session(s)

    all_reviews: list[dict] = []
    try:
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/{username}/reviews/films/page/{page}/"
            r = _fetch(s, url, timeout=10)
            if r.status_code == 404:
                logger.info("Review scrape: page %d 404 for %s (stop)", page, username)
                break
            if r.status_code != 200:
                logger.warning("Review scrape: page %d unexpected status %d for %s", page, r.status_code, username)
                break
            if _is_cloudflare_block(r.text):
                logger.warning("Review scrape: page %d Cloudflare block for %s", page, username)
                break

            soup = BeautifulSoup(r.text, "html.parser")
            reviews = _parse_review_cards(soup, username=username)
            _trace(
                trace_callback,
                "reviews_page",
                f"Reviews page {page} parsed",
                {"page": page, "reviews": len(reviews), "status_code": r.status_code},
            )
            if not reviews:
                break
            all_reviews.extend(reviews)
            time.sleep(PAGE_DELAY)

        fallback_count = 0
        for review in all_reviews:
            if review["like_count"] is not None or not review.get("slug"):
                continue
            if fallback_count >= LIKES_FALLBACK_MAX:
                break
            time.sleep(PAGE_DELAY)
            review["like_count"] = _sync_fetch_like_count(s, username, review["slug"])
            fallback_count += 1
    finally:
        if owns_session:
            s.close()

    logger.info("Review scrape complete for %s: %d reviews", username, len(all_reviews))
    _trace(trace_callback, "reviews_done", "Reviews scrape completed", {"reviews": len(all_reviews)})
    return all_reviews


def _sync_scrape_overview(
    username: str,
    session: Optional[cloudscraper.CloudScraper] = None,
    trace_callback: Optional[TraceCallback] = None,
) -> tuple[int, int, list[dict]]:
    """Fetch the profile overview; return (film_count, review_count, favorite_films).

    Best-effort: returns (0, 0, []) on any failure — counts are provenance/UX only
    and must never fail the scrape.
    """
    owns_session = session is None
    s = session or _new_session()
    if owns_session:
        _warm_session(s)
    film_count = 0
    review_count = 0
    favorite_films: list[dict] = []
    try:
        overview_resp = _fetch(s, f"{BASE_URL}/{username}/", timeout=10)
        if overview_resp.status_code == 200:
            soup = BeautifulSoup(overview_resp.text, "html.parser")
            films_link = soup.select_one('a[href$="/films/"]')
            if films_link:
                count_span = films_link.select_one(".value")
                if count_span:
                    try:
                        film_count = int(count_span.get_text(strip=True).replace(",", ""))
                    except ValueError:
                        pass
            reviews_link = soup.select_one('a[href$="/reviews/"]')
            if reviews_link:
                count_span = reviews_link.select_one(".value")
                if count_span:
                    try:
                        review_count = int(count_span.get_text(strip=True).replace(",", ""))
                    except ValueError:
                        pass
            # Parse up to 4 pinned favorite films from the profile page
            for item in soup.select("#favourites .poster-list li")[:4]:
                poster_div = item.select_one("[data-film-slug]")
                if not poster_div:
                    continue
                slug = str(poster_div.get("data-film-slug") or "")
                title = str(poster_div.get("data-film-name") or "")
                if not title:
                    img = item.select_one("img")
                    title = str(img.get("alt") or "") if img else ""
                year_raw = poster_div.get("data-film-release-year")
                year = int(year_raw) if year_raw and str(year_raw).isdigit() else None
                if slug:
                    favorite_films.append({"slug": slug, "title": title, "year": year})
            _trace(
                trace_callback,
                "overview",
                "Profile overview parsed",
                {"film_count": film_count, "review_count": review_count,
                 "favorite_films": len(favorite_films), "status_code": overview_resp.status_code},
            )
    except Exception:
        pass  # non-fatal — counts are best-effort
    finally:
        if owns_session:
            s.close()
    return film_count, review_count, favorite_films


def _sync_scrape_profile_sources(
    username: str,
    max_pages: int,
    include_reviews: bool = False,
    trace_callback: Optional[TraceCallback] = None,
) -> ProfileScrapeSources:
    """Scrape diary and grid in one warmed requests session.

    Sharing cookies across both page families keeps the public-profile scan
    closer to a single browser visit and avoids losing diary dates after one
    source has already established Letterboxd session state.

    Also loads the profile overview to extract the public film + review counts.
    When include_reviews=True, also scrapes review pages (title/text/likes/date).
    """
    logger.info("Starting combined profile scrape for %s (include_reviews=%s)", username, include_reviews)
    session = _new_session()
    _warm_session(session)
    try:
        film_count, review_count, favorite_films = _sync_scrape_overview(
            username, session=session, trace_callback=trace_callback
        )
        if trace_callback:
            diary = _sync_scrape_diary(username, max_pages, session=session, trace_callback=trace_callback)
            grid = _sync_scrape_films_grid(username, max_pages, session=session, trace_callback=trace_callback)
        else:
            diary = _sync_scrape_diary(username, max_pages, session=session)
            grid = _sync_scrape_films_grid(username, max_pages, session=session)
        reviews: list[dict] = []
        if include_reviews:
            try:
                if trace_callback:
                    reviews = _sync_scrape_reviews(username, max_pages, session=session, trace_callback=trace_callback)
                else:
                    reviews = _sync_scrape_reviews(username, max_pages, session=session)
            except Exception as exc:
                # Reviews are best-effort — never fail the whole scrape because of them
                logger.warning("Review scrape failed for %s: %s", username, exc)
        logger.info(
            "Combined scrape complete for %s: diary=%d grid=%d films=%d reviews=%d scraped_reviews=%d",
            username, len(diary), len(grid), film_count, review_count, len(reviews),
        )
        return ProfileScrapeSources(
            diary=diary,
            grid=grid,
            review_count=review_count,
            film_count=film_count,
            reviews=reviews,
            favorite_films=favorite_films,
        )
    finally:
        session.close()


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


async def scrape_reviews(username: str, max_pages: int = MAX_PAGES) -> list[dict]:
    """Async wrapper around _sync_scrape_reviews for use outside the combined scrape."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, partial(_sync_scrape_reviews, username, max_pages)
    )


async def scrape_profile_sources(
    username: str,
    max_pages: int = MAX_PAGES,
    include_reviews: bool = False,
    trace_callback: Optional[TraceCallback] = None,
) -> ProfileScrapeSources:
    """Scrape diary, grid, overview (and optionally reviews) concurrently.

    Each source runs in its own thread + session so the page families fetch in
    parallel instead of back-to-back. ponytail: concurrent residential requests
    raise Letterboxd's 429/block odds vs. the old single-session serial scan — an
    accepted speed tradeoff. Revert to `_sync_scrape_profile_sources` (serial,
    shared session) if blocks reappear.
    """
    loop = asyncio.get_event_loop()
    diary_fut = loop.run_in_executor(None, partial(_sync_scrape_diary, username, max_pages, None, trace_callback))
    grid_fut = loop.run_in_executor(None, partial(_sync_scrape_films_grid, username, max_pages, None, trace_callback))
    overview_fut = loop.run_in_executor(None, partial(_sync_scrape_overview, username, None, trace_callback))
    futures = [diary_fut, grid_fut, overview_fut]
    if include_reviews:
        futures.append(loop.run_in_executor(None, partial(_sync_scrape_reviews, username, max_pages, None, trace_callback)))

    results = await asyncio.gather(*futures, return_exceptions=True)
    diary_res, grid_res, overview_res = results[0], results[1], results[2]
    reviews_res = results[3] if include_reviews else []

    # Diary + grid are the required film sources. If BOTH failed, surface the
    # error so "user not found" / "blocked" / "rate limit" still reaches callers.
    diary_failed = isinstance(diary_res, BaseException)
    grid_failed = isinstance(grid_res, BaseException)
    if diary_failed and grid_failed:
        raise grid_res if isinstance(grid_res, ValueError) else diary_res
    if diary_failed:
        logger.warning("Diary scrape failed for %s (using grid only): %s", username, diary_res)
    if grid_failed:
        logger.warning("Grid scrape failed for %s (using diary only): %s", username, grid_res)
    diary = [] if diary_failed else diary_res
    grid = [] if grid_failed else grid_res

    film_count, review_count, favorite_films = (0, 0, [])
    if not isinstance(overview_res, BaseException):
        film_count, review_count, favorite_films = overview_res

    if isinstance(reviews_res, BaseException):
        logger.warning("Review scrape failed for %s: %s", username, reviews_res)
        reviews_res = []

    logger.info(
        "Parallel profile scrape complete for %s: diary=%d grid=%d films=%d reviews=%d scraped_reviews=%d",
        username, len(diary), len(grid), film_count, review_count, len(reviews_res),
    )
    return ProfileScrapeSources(
        diary=diary,
        grid=grid,
        review_count=review_count,
        film_count=film_count,
        reviews=reviews_res,
        favorite_films=favorite_films,
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

    Returns dict with 'watched', 'ratings', and 'diary' keys. 'diary' contains the
    rows that have a real Letterboxd watch_date — feeding it into the analysis pipeline
    lets pace/timeline use the user's actual Letterboxd-era window instead of the
    fallback 365-day assumption.
    """
    seen = set()
    watched_rows = []
    ratings_rows = []
    diary_rows = []

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

        # Only dated entries feed the diary timeline (pace/cadence). Undated
        # grid-only films still count as watched/rated above — they just have
        # no Letterboxd watch date to place on the timeline.
        watch_date = f.get("watch_date") or ""
        if watch_date:
            diary_rows.append({
                "Date": watch_date,
                "Name": f["title"],
                "Year": f["year"],
                "Rating": f["rating"] if f["rating"] is not None else "",
                "Watched Date": watch_date,
            })

    return {"watched": watched_rows, "ratings": ratings_rows, "diary": diary_rows}
