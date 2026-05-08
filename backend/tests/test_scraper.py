from app.services import scraper


class FakeSession:
    def __init__(self):
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.closed = True


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

    diary, grid = scraper._sync_scrape_profile_sources("semihmutsuz", 60)

    assert len(sessions) == 1
    assert sessions[0].closed is True
    assert diary[0]["title"] == "Diary Film"
    assert grid[0]["title"] == "Grid Film"
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
        {"title": "Inception", "year": "2010", "rating": None, "watch_date": "", "slug": "/film/inception/"},
        {"title": "Aftersun", "year": "2022", "rating": None, "watch_date": "", "slug": "/film/aftersun/"},
    ]
