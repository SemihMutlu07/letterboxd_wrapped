"""
Letterboxd public RSS source.

Letterboxd publishes a per-user diary feed at ``/{username}/rss/`` that is
proxy-free from datacenter IPs (unlike the HTML profile pages, which sit behind
Cloudflare) and embeds ``<tmdb:movieId>`` for each film. That makes RSS the
cheap, already-TMDB-linked data source for the fast preview flow.

This module only fetches and parses the feed into normalized item dicts. TMDB
enrichment and stat aggregation live in ``rss_preview.py``; the HTML scraper in
``scraper.py`` remains the bounded fallback / fuller-history path.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from xml.etree import ElementTree as ET

import aiohttp

logger = logging.getLogger("letterboxd_wrapped.rss")

BASE_URL = "https://letterboxd.com"
USERNAME_RE = re.compile(r"^[a-z0-9_]+$")
RSS_TIMEOUT = 12  # seconds — RSS is a single direct fetch, no proxy

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
}

_IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE)


class RssError(Exception):
    """Structured RSS failure carrying a machine code + user-facing message.

    error_code is one of: invalid_username, rss_not_found, rss_parse_failed,
    rss_network_error.
    """

    def __init__(self, error_code: str, message: str):
        self.error_code = error_code
        self.message = message
        super().__init__(message)


def rss_url(username: str) -> str:
    return f"{BASE_URL}/{username}/rss/"


def _local_name(tag: str) -> str:
    """Strip the ``{namespace}`` prefix ElementTree prepends to tags."""
    return tag.rsplit("}", 1)[-1]


def _find_child_text(item: ET.Element, local: str) -> Optional[str]:
    """Find a child element by local name, ignoring its XML namespace.

    Letterboxd's namespaced elements (letterboxd:*, tmdb:*) can vary by scheme
    (http vs https), so matching on local name is more robust than a fixed map.
    """
    for child in item:
        if _local_name(child.tag) == local:
            text = child.text
            return text.strip() if text else ""
    return None


def _to_int(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None


def _to_float(value: Optional[str]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return None


def _rating_from_title(title: str) -> Optional[float]:
    """Fallback rating parse from the title suffix like '★★★★½'."""
    if not title or "★" not in title:
        return None
    full = title.count("★")
    half = 0.5 if "½" in title else 0.0
    total = full + half
    return total if total > 0 else None


def _poster_from_description(description: Optional[str]) -> str:
    if not description:
        return ""
    match = _IMG_SRC_RE.search(description)
    return match.group(1) if match else ""


def parse_rss_items(xml_text: str) -> list[dict]:
    """Parse a Letterboxd RSS feed into normalized film-activity dicts.

    Only items that look like film entries (carry a film title or tmdb_id) are
    returned — list/announcement items are skipped. Raises RssError with code
    ``rss_parse_failed`` when the XML is malformed.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise RssError("rss_parse_failed", f"Could not parse the Letterboxd RSS feed: {exc}")

    items: list[dict] = []
    for item in root.iter():
        if _local_name(item.tag) != "item":
            continue

        film_title = _find_child_text(item, "filmTitle")
        tmdb_id = _to_int(_find_child_text(item, "movieId"))
        raw_title = _find_child_text(item, "title") or ""

        # Skip non-film items (lists, etc.) — they lack both a film title and a tmdb id.
        if not film_title and tmdb_id is None:
            continue

        member_rating = _to_float(_find_child_text(item, "memberRating"))
        rating = member_rating if member_rating is not None else _rating_from_title(raw_title)

        rewatch_raw = (_find_child_text(item, "rewatch") or "").strip().lower()
        description = _find_child_text(item, "description")

        items.append({
            "title": film_title or raw_title,
            "raw_title": raw_title,
            "link": _find_child_text(item, "link") or "",
            "tmdb_id": tmdb_id,
            "year": _to_int(_find_child_text(item, "filmYear")),
            "rating": rating,
            "rewatch": rewatch_raw == "yes",
            "watched_date": _find_child_text(item, "watchedDate") or "",
            "pub_date": _find_child_text(item, "pubDate") or "",
            "poster_url": _poster_from_description(description),
            "is_review": bool(description and "</p>" in description and _poster_from_description(description) != description),
        })

    return items


async def fetch_rss_text(session: aiohttp.ClientSession, username: str) -> str:
    """Fetch the raw RSS XML for a username. Raises RssError on network/404."""
    url = rss_url(username)
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=RSS_TIMEOUT)) as resp:
            if resp.status == 404:
                raise RssError("rss_not_found", f"No public Letterboxd RSS feed for @{username}. The profile may be private or not exist.")
            if resp.status != 200:
                logger.warning("RSS fetch for %s returned status %s", username, resp.status)
                raise RssError("rss_network_error", f"Letterboxd returned status {resp.status} for @{username}'s RSS feed.")
            return await resp.text()
    except RssError:
        raise
    except aiohttp.ClientError as exc:
        logger.warning("RSS network error for %s: %s", username, exc)
        raise RssError("rss_network_error", "Could not reach Letterboxd to read the RSS feed. Please try again in a moment.")
    except Exception as exc:  # asyncio.TimeoutError and any unexpected transport error
        logger.warning("RSS fetch failed for %s: %s", username, exc)
        raise RssError("rss_network_error", "Reading the Letterboxd RSS feed timed out. Please try again in a moment.")


async def fetch_rss_items(session: aiohttp.ClientSession, username: str) -> list[dict]:
    """Validate username, fetch, and parse the RSS feed into normalized items."""
    if not username or not USERNAME_RE.match(username):
        raise RssError("invalid_username", "Please enter a valid Letterboxd username.")
    xml_text = await fetch_rss_text(session, username)
    return parse_rss_items(xml_text)
