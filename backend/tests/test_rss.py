"""RSS source + preview unit tests."""
import pytest

from app.services import rss_preview
from app.services import tmdb_client
from app.services.rss_source import RssError, parse_rss_items


SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:letterboxd="https://letterboxd.com"
     xmlns:tmdb="https://themoviedb.org" version="2.0">
<channel>
  <title>semihmutsuz's Letterboxd diary</title>
  <item>
    <title>Dune: Part Two, 2024 - &#9733;&#9733;&#9733;&#9733;&#189;</title>
    <link>https://letterboxd.com/semihmutsuz/film/dune-part-two/</link>
    <guid isPermaLink="false">letterboxd-watch-1</guid>
    <pubDate>Sun, 10 Mar 2024 00:00:00 +1300</pubDate>
    <letterboxd:watchedDate>2024-03-10</letterboxd:watchedDate>
    <letterboxd:rewatch>No</letterboxd:rewatch>
    <letterboxd:filmTitle>Dune: Part Two</letterboxd:filmTitle>
    <letterboxd:filmYear>2024</letterboxd:filmYear>
    <letterboxd:memberRating>4.5</letterboxd:memberRating>
    <tmdb:movieId>693134</tmdb:movieId>
    <description><![CDATA[<p><img src="https://a.ltrbxd.com/poster.jpg"/></p><p>Great film.</p>]]></description>
    <dc:creator>semihmutsuz</dc:creator>
  </item>
  <item>
    <title>My favourite films</title>
    <link>https://letterboxd.com/semihmutsuz/list/favourites/</link>
    <guid isPermaLink="false">letterboxd-list-1</guid>
    <pubDate>Sat, 09 Mar 2024 00:00:00 +1300</pubDate>
    <description><![CDATA[<p>A list with no film.</p>]]></description>
  </item>
</channel>
</rss>
"""


def test_parse_rss_items_extracts_namespaced_tmdb_id():
    items = parse_rss_items(SAMPLE_RSS)

    # The list item (no film title / tmdb id) is skipped.
    assert len(items) == 1
    film = items[0]
    assert film["tmdb_id"] == 693134
    assert isinstance(film["tmdb_id"], int)
    assert film["title"] == "Dune: Part Two"
    assert film["year"] == 2024
    assert film["rating"] == 4.5
    assert film["watched_date"] == "2024-03-10"
    assert film["rewatch"] is False
    assert film["poster_url"] == "https://a.ltrbxd.com/poster.jpg"


def test_parse_rss_items_rating_falls_back_to_title_stars():
    no_member_rating = SAMPLE_RSS.replace("<letterboxd:memberRating>4.5</letterboxd:memberRating>", "")
    items = parse_rss_items(no_member_rating)
    # "★★★★½" in the title → 4.5
    assert items[0]["rating"] == 4.5


def test_parse_rss_items_malformed_raises_structured_error():
    with pytest.raises(RssError) as exc_info:
        parse_rss_items("<rss><channel><item>broken")
    assert exc_info.value.error_code == "rss_parse_failed"


@pytest.mark.asyncio
async def test_build_preview_uses_tmdb_id_and_skips_resolve(monkeypatch):
    """RSS enrichment must go straight to detail fetch by id, never resolve_tmdb_id."""
    called_ids: list[int] = []

    async def fake_detail(session, tmdb_id):
        called_ids.append(int(tmdb_id))
        return {
            "tmdb_id": tmdb_id,
            "title": "Dune: Part Two",
            "genres": ["Science Fiction", "Adventure"],
            "countries": ["United States"],
            "language": "en",
            "director": "Denis Villeneuve",
            "decade": "2020s",
            "cast": ["Timothée Chalamet"],
            "runtime": 166,
            "poster_path": "/poster.jpg",
        }

    def boom_resolve(*args, **kwargs):
        raise AssertionError("resolve_tmdb_id must not be called when tmdb_id is known")

    monkeypatch.setattr(rss_preview, "fetch_comprehensive_film_details", fake_detail)
    monkeypatch.setattr(tmdb_client, "resolve_tmdb_id", boom_resolve)

    items = [
        {"title": "Dune: Part Two", "tmdb_id": 693134, "year": 2024, "rating": 4.5, "watched_date": "2024-03-10"},
    ]
    stats = await rss_preview.build_preview_stats(object(), items)

    assert called_ids == [693134]
    assert stats["source"] == "rss"
    assert stats["data_quality"]["mode"] == "preview"
    assert stats["data_quality"]["exactness"] == "sampled"
    assert stats["data_quality"]["sample_size"] == 1
    assert stats["data_quality"]["tmdb_id_coverage"] == 100.0
    assert stats["favorite_genre"]["name"] == "Science Fiction"
    assert stats["most_watched_director"]["name"] == "Denis Villeneuve"
    assert stats["average_rating"] == 4.5
