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
