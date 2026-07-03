import asyncio

import pytest
from bs4 import BeautifulSoup

from app.services import scraper


class FakeSession:
    def __init__(self):
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.closed = True

    def close(self):
        self.closed = True

    def get(self, url, timeout):
        # Overview fetch in _sync_scrape_profile_sources hits this — empty body skips count parsing
        return FakeResponse(200, "")


def _run_scraper_executor_inline(monkeypatch):
    """Keep scraper async tests hermetic; they validate orchestration, not threads."""
    running_loop = asyncio.get_running_loop()

    class InlineExecutorLoop:
        def run_in_executor(self, executor, func):
            future = running_loop.create_future()
            try:
                future.set_result(func())
            except BaseException as exc:
                future.set_exception(exc)
            return future

    monkeypatch.setattr(scraper.asyncio, "get_event_loop", lambda: InlineExecutorLoop())


def test_scrape_profile_sources_reuses_one_session(monkeypatch):
    sessions: list[FakeSession] = []
    calls: list[tuple] = []

    def fake_new_session():
        session = FakeSession()
        sessions.append(session)
        return session

    def fake_warm_session(session):
        calls.append(("warm", id(session)))

    def fake_scrape_diary(username, max_pages, session=None):
        calls.append(("diary", id(session), username, max_pages))
        return [{"title": "Diary Film", "year": "2024", "rating": None, "watch_date": "2024-01-01"}]

    def fake_scrape_grid(username, max_pages, session=None):
        calls.append(("grid", id(session), username, max_pages))
        return [{"title": "Grid Film", "year": "2024", "rating": 4.0, "watch_date": ""}]

    monkeypatch.setattr(scraper, "_new_session", fake_new_session)
    monkeypatch.setattr(scraper, "_warm_session", fake_warm_session)
    monkeypatch.setattr(scraper, "_sync_scrape_diary", fake_scrape_diary)
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid", fake_scrape_grid)

    result = scraper._sync_scrape_profile_sources("semihmutsuz", 60)

    assert isinstance(result, scraper.ProfileScrapeSources)
    assert len(sessions) == 1
    assert sessions[0].closed is True
    assert result.diary[0]["title"] == "Diary Film"
    assert result.grid[0]["title"] == "Grid Film"
    assert result.review_count == 0  # no fake overview page
    assert result.film_count == 0
    assert result.reviews == []  # include_reviews defaults to False
    assert calls == [
        ("warm", id(sessions[0])),
        ("diary", id(sessions[0]), "semihmutsuz", 60),
        ("grid", id(sessions[0]), "semihmutsuz", 60),
    ]


class FakeResponse:
    def __init__(self, status_code, text=""):
        self.status_code = status_code
        self.text = text


class WatchlistSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.closed = False
        self.urls: list[str] = []

    def get(self, url, timeout):
        self.urls.append(url)
        return self.responses.pop(0)

    def close(self):
        self.closed = True


def test_scrape_watchlist_parses_grid_items_and_closes_owned_session(monkeypatch):
    html = """
    <ul>
      <li class="griditem">
        <div data-component-class="LazyPoster" data-item-name="Inception (2010)" data-item-slug="/film/inception/"></div>
      </li>
      <li class="griditem">
        <div data-component-class="LazyPoster" data-item-name="Aftersun (2022)" data-item-slug="/film/aftersun/"></div>
      </li>
    </ul>
    """
    session = WatchlistSession([
        FakeResponse(200, html),
        FakeResponse(200, ""),
    ])

    monkeypatch.setattr(scraper, "_new_session", lambda: session)
    monkeypatch.setattr(scraper, "_warm_session", lambda s: None)
    monkeypatch.setattr(scraper, "PAGE_DELAY", 0)

    films = scraper._sync_scrape_watchlist("semihmutsuz", 5)

    assert session.closed is True
    assert session.urls == [
        "https://letterboxd.com/semihmutsuz/watchlist/page/1/",
        "https://letterboxd.com/semihmutsuz/watchlist/page/2/",
    ]
    assert films == [
        {"title": "Inception", "year": "2010", "rating": None, "watch_date": "", "slug": "/film/inception/", "poster_url": ""},
        {"title": "Aftersun", "year": "2022", "rating": None, "watch_date": "", "slug": "/film/aftersun/", "poster_url": ""},
    ]


def test_parse_review_cards_extracts_fields_and_likes():
    html = """
    <article class="production-viewing">
      <div data-component-class="LazyPoster" data-item-slug="memories-of-underdevelopment"></div>
      <div class="body">
        <header><div class="topline">
          <h2 class="primaryname"><a href="/semihmutsuz/film/memories-of-underdevelopment/">Memories of Underdevelopment</a></h2>
          <span class="releasedate">1968</span>
        </div></header>
        <span class="inline-rating"><svg aria-label="★★★★"><title>★★★★</title></svg></span>
        <span class="date"><time class="timestamp" datetime="2024-03-04">04 Mar 2024</time></span>
        <div class="js-review-body body-text"><p>Sergio's gaze is sharper than any thesis on alienation.</p></div>
        <p data-component-class="LikeComponent" data-count="12"></p>
      </div>
    </article>
    <article class="production-viewing">
      <div data-component-class="LazyPoster" data-item-slug="aftersun"></div>
      <div class="body">
        <header><div class="topline">
          <h2 class="primaryname"><a href="/u/film/aftersun/">Aftersun</a></h2>
          <span class="releasedate">2022</span>
        </div></header>
        <div class="js-review-body body-text"><p>Quiet, devastating.</p></div>
      </div>
    </article>
    """
    soup = BeautifulSoup(html, "html.parser")
    reviews = scraper._parse_review_cards(soup)

    assert len(reviews) == 2
    first = reviews[0]
    assert first["title"] == "Memories of Underdevelopment"
    assert first["year"] == "1968"
    assert first["slug"] == "memories-of-underdevelopment"
    assert first["rating"] == 4.0  # ★★★★ → 4.0 stars
    assert first["review_text"].startswith("Sergio's gaze")
    assert first["date"] == "2024-03-04"
    assert first["like_count"] == 12

    second = reviews[1]
    assert second["title"] == "Aftersun"
    assert second["like_count"] is None  # no LikeComponent present


def test_rating_from_svg_label_handles_halves():
    assert scraper._rating_from_svg_label("★★★½") == 3.5
    assert scraper._rating_from_svg_label("★★★★") == 4.0
    assert scraper._rating_from_svg_label("½") == 0.5
    assert scraper._rating_from_svg_label("") is None


def test_sync_scrape_reviews_walks_pages_and_stops_on_empty(monkeypatch):
    page_html = """
    <article class="production-viewing">
      <div data-component-class="LazyPoster" data-item-slug="x"></div>
      <div class="body">
        <header><div class="topline">
          <h2 class="primaryname"><a href="/u/film/x/">X</a></h2>
          <span class="releasedate">2024</span>
        </div></header>
        <div class="js-review-body body-text"><p>ok</p></div>
        <p data-component-class="LikeComponent" data-count="3"></p>
      </div>
    </article>
    """
    session = WatchlistSession([
        FakeResponse(200, page_html),
        FakeResponse(200, "<main></main>"),  # empty page → loop should stop
    ])

    monkeypatch.setattr(scraper, "_new_session", lambda: session)
    monkeypatch.setattr(scraper, "_warm_session", lambda s: None)
    monkeypatch.setattr(scraper, "PAGE_DELAY", 0)

    reviews = scraper._sync_scrape_reviews("semihmutsuz", 5)

    assert session.closed is True
    assert session.urls == [
        "https://letterboxd.com/semihmutsuz/reviews/films/page/1/",
        "https://letterboxd.com/semihmutsuz/reviews/films/page/2/",
    ]
    assert len(reviews) == 1
    assert reviews[0]["title"] == "X"
    assert reviews[0]["like_count"] == 3


def test_sync_scrape_profile_sources_skips_reviews_by_default(monkeypatch):
    calls: list[str] = []

    monkeypatch.setattr(scraper, "_new_session", lambda: FakeSession())
    monkeypatch.setattr(scraper, "_warm_session", lambda s: None)
    monkeypatch.setattr(scraper, "_sync_scrape_diary", lambda u, m, session=None: [])
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid", lambda u, m, session=None: [])

    def fail_if_called(*args, **kwargs):
        calls.append("reviews")
        return []

    monkeypatch.setattr(scraper, "_sync_scrape_reviews", fail_if_called)

    result = scraper._sync_scrape_profile_sources("semihmutsuz", 5)
    assert calls == []
    assert result.reviews == []


def test_sync_scrape_profile_sources_includes_reviews_when_flagged(monkeypatch):
    monkeypatch.setattr(scraper, "_new_session", lambda: FakeSession())
    monkeypatch.setattr(scraper, "_warm_session", lambda s: None)
    monkeypatch.setattr(scraper, "_sync_scrape_diary", lambda u, m, session=None: [])
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid", lambda u, m, session=None: [])
    monkeypatch.setattr(
        scraper,
        "_sync_scrape_reviews",
        lambda u, m, session=None: [{"title": "X", "like_count": 7, "review_text": "ok"}],
    )

    result = scraper._sync_scrape_profile_sources("semihmutsuz", 5, include_reviews=True)
    assert result.reviews == [{"title": "X", "like_count": 7, "review_text": "ok"}]


async def test_scrape_profile_sources_runs_sources_in_parallel(monkeypatch):
    """Async orchestrator merges diary/grid/overview (each its own thread+session)."""
    _run_scraper_executor_inline(monkeypatch)
    monkeypatch.setattr(scraper, "_sync_scrape_diary",
                        lambda u, p, s=None, t=None: [{"title": "D", "year": "2024", "rating": None, "watch_date": "2024-01-01"}])
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid",
                        lambda u, p, s=None, t=None: [{"title": "G", "year": "2024", "rating": 4.0, "watch_date": ""}])
    monkeypatch.setattr(scraper, "_sync_scrape_overview", lambda u, s=None, t=None: (42, 7, []))

    result = await scraper.scrape_profile_sources("semihmutsuz", 5)

    assert result.diary[0]["title"] == "D"
    assert result.grid[0]["title"] == "G"
    assert result.film_count == 42
    assert result.review_count == 7
    assert result.reviews == []  # include_reviews defaults False


async def test_scrape_profile_sources_raises_when_both_film_sources_fail(monkeypatch):
    """If diary AND grid both fail, the real error (e.g. 'not found') must surface."""
    _run_scraper_executor_inline(monkeypatch)
    def boom(u, p, s=None, t=None):
        raise ValueError(f"User '{u}' not found")
    monkeypatch.setattr(scraper, "_sync_scrape_diary", boom)
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid", boom)
    monkeypatch.setattr(scraper, "_sync_scrape_overview", lambda u, s=None, t=None: (0, 0, []))

    with pytest.raises(ValueError, match="not found"):
        await scraper.scrape_profile_sources("ghost", 5)


async def test_scrape_profile_sources_survives_one_source_failing(monkeypatch):
    """One film source failing is tolerated — the other still produces results."""
    _run_scraper_executor_inline(monkeypatch)
    monkeypatch.setattr(scraper, "_sync_scrape_diary",
                        lambda u, p, s=None, t=None: (_ for _ in ()).throw(ValueError("rate limit")))
    monkeypatch.setattr(scraper, "_sync_scrape_films_grid",
                        lambda u, p, s=None, t=None: [{"title": "G", "year": "2024", "rating": 4.0, "watch_date": ""}])
    monkeypatch.setattr(scraper, "_sync_scrape_overview", lambda u, s=None, t=None: (10, 0, []))

    result = await scraper.scrape_profile_sources("semihmutsuz", 5)

    assert result.diary == []
    assert result.grid[0]["title"] == "G"


def test_parse_diary_rows_dates_rows_without_month_link():
    """Letterboxd renders the month <a> only on the FIRST row of each month;
    later rows in the same month have an empty .col-monthdate. The day cell's
    href carries the full /for/YYYY/MM/DD/ date, so every diary row must still
    get a watch_date — not just the first row of each month.

    Regression: requiring a month-link dropped ~88% of diary dates, collapsing
    a 410-entry diary to ~47 'watched' rows (one per distinct month).
    """
    html = """
    <table><tbody>
      <tr class="diary-entry-row">
        <td class="col-monthdate"><a href="/u/films/diary/for/2024/03/">Mar 2024</a></td>
        <td class="col-daydate"><a href="/u/films/diary/for/2024/03/15/">15</a></td>
        <td class="col-production"><a href="/film/a/">Film A</a></td>
        <td class="col-releaseyear">2020</td>
        <td class="col-rating"><span class="rating rated-8"></span></td>
      </tr>
      <tr class="diary-entry-row">
        <td class="col-monthdate"></td>
        <td class="col-daydate"><a href="/u/films/diary/for/2024/03/14/">14</a></td>
        <td class="col-production"><a href="/film/b/">Film B</a></td>
        <td class="col-releaseyear">2019</td>
        <td class="col-rating"><span class="rating rated-6"></span></td>
      </tr>
    </tbody></table>
    """
    soup = BeautifulSoup(html, "html.parser")
    films = scraper._parse_diary_rows(soup)

    by_title = {f["title"]: f for f in films}
    assert by_title["Film A"]["watch_date"] == "2024-03-15"
    # Film B has no month-link but a dated day-link — must still be dated.
    assert by_title["Film B"]["watch_date"] == "2024-03-14"


def test_diary_to_csv_dicts_keeps_undated_films_in_watched():
    """Undated films (grid-only / IMDB bulk imports with no Letterboxd watch
    date) must still count as watched and rated — only the diary timeline is
    gated by watch_date.

    Regression: c5adb3c excluded undated films from watched/ratings too, which
    collapsed full ~700-film profiles down to just the dated diary subset.
    """
    films = [
        {"title": "Dated", "year": 2020, "rating": 4.0, "watch_date": "2024-03-15"},
        {"title": "Undated", "year": 2019, "rating": 3.5, "watch_date": ""},
    ]
    result = scraper.diary_to_csv_dicts(films)

    watched_titles = {r["Name"] for r in result["watched"]}
    rated_titles = {r["Name"] for r in result["ratings"]}
    diary_titles = {r["Name"] for r in result["diary"]}

    # Both films count as watched and rated...
    assert watched_titles == {"Dated", "Undated"}
    assert rated_titles == {"Dated", "Undated"}
    # ...but only the dated film feeds the diary timeline.
    assert diary_titles == {"Dated"}
