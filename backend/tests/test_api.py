"""
Backend integration tests.

Run from backend/ directory:
    pytest
"""
import io
import zipfile
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch


# ---- fixtures ----------------------------------------------------------------

@pytest.fixture
def minimal_watched_csv() -> bytes:
    return b"Name,Year,Letterboxd URI\nInception,2010,https://letterboxd.com/film/inception/\n"


@pytest.fixture
def zip_with_watched(minimal_watched_csv: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("watched.csv", minimal_watched_csv)
    return buf.getvalue()


@pytest.fixture
async def client():
    """ASGI test client — lifespan is bypassed; network clients are mocked."""
    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key"}):
        from app.main import create_app  # noqa: PLC0415

        app = create_app()

        # Route handlers only pass this through to mocked service calls in tests.
        session = object()
        app.state.aiohttp_session = session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ---- health ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    r = await client.get("/")
    assert r.status_code == 200
    assert "message" in r.json()


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---- analyze (happy path — background task) ---------------------------------

@pytest.mark.asyncio
async def test_analyze_returns_202_task_id(client: AsyncClient, zip_with_watched: bytes):
    """POST /api/analyze should accept a ZIP and return 202 + task_id."""
    async def fake_run_analysis(*args, **kwargs):
        return None

    with patch(
        "app.routes.analyze._run_analysis",
        side_effect=fake_run_analysis,
    ):
        files = {"files": ("export.zip", zip_with_watched, "application/zip")}
        r = await client.post("/api/analyze", files=files)

    assert r.status_code == 202
    body = r.json()
    assert "task_id" in body
    assert body["status"] == "pending"


@pytest.mark.asyncio
async def test_analyze_missing_files(client: AsyncClient):
    """POST /api/analyze with no files should return 422."""
    r = await client.post("/api/analyze")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_analyze_corrupt_zip(client: AsyncClient):
    """POST /api/analyze with a corrupt ZIP should return 400."""
    files = {"files": ("bad.zip", b"not a zip", "application/zip")}
    r = await client.post("/api/analyze", files=files)
    assert r.status_code == 400


# ---- progress polling --------------------------------------------------------

@pytest.mark.asyncio
async def test_progress_unknown_task(client: AsyncClient):
    """GET /api/progress/{task_id} for a non-existent task returns 404."""
    r = await client.get("/api/progress/nonexistent-task-id")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_progress_legacy(client: AsyncClient):
    """GET /api/progress (legacy endpoint) should always return 200."""
    r = await client.get("/api/progress")
    assert r.status_code == 200
    body = r.json()
    assert "stage" in body


@pytest.mark.asyncio
async def test_task_id_polling_flow(client: AsyncClient, zip_with_watched: bytes):
    """Submit a job, then poll its task_id — should reach a terminal state."""
    import asyncio

    async def fake_run_analysis(task_id, session, csv_files, request_dir):
        from app import task_manager

        task_manager.set_task_done(task_id, {"status": "success", "stats": {"total_films": 1, "mock": True}})

    with patch(
        "app.routes.analyze._run_analysis",
        side_effect=fake_run_analysis,
    ):
        files = {"files": ("export.zip", zip_with_watched, "application/zip")}
        r = await client.post("/api/analyze", files=files)
        assert r.status_code == 202
        task_id = r.json()["task_id"]

        # Give the background task a moment to run
        await asyncio.sleep(0.2)

        poll = await client.get(f"/api/progress/{task_id}")
        assert poll.status_code == 200
        body = poll.json()
        assert body["status"] in ("pending", "running", "done", "failed")


# ---- parse-username ----------------------------------------------------------

@pytest.mark.asyncio
async def test_parse_username_known_pattern(client: AsyncClient):
    r = await client.post("/api/parse-username", json={"filename": "letterboxd-johndoe-2024-01-01.zip"})
    assert r.status_code == 200
    assert r.json()["username"] == "johndoe"


@pytest.mark.asyncio
async def test_parse_username_simple_export_name(client: AsyncClient):
    r = await client.post("/api/parse-username", json={"filename": "letterboxd-johndoe.zip"})
    assert r.status_code == 200
    assert r.json()["username"] == "johndoe"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("filename", "username"),
    [
        ("letterboxd-johndoe-utc.zip", "johndoe"),
        ("letterboxd-johndoe-2024.zip", "johndoe"),
        ("Letterboxd_johndoe_Export_2024.zip", "johndoe"),
        ("./path/letterboxd-johndoe.zip", "johndoe"),
        ("letterboxd-john-doe.zip", None),
    ],
)
async def test_parse_username_edge_cases(client: AsyncClient, filename: str, username: str | None):
    r = await client.post("/api/parse-username", json={"filename": filename})
    assert r.status_code == 200
    assert r.json()["username"] == username


@pytest.mark.asyncio
async def test_parse_username_no_match(client: AsyncClient):
    r = await client.post("/api/parse-username", json={"filename": "random_file.csv"})
    assert r.status_code == 200
    assert r.json()["username"] is None


# ---- watchlist compare -------------------------------------------------------

@pytest.fixture(autouse=True)
def _reset_watchlist_rate_limiter():
    from app.routes import watchlist  # noqa: PLC0415

    watchlist._rate_limiter.clear()
    yield
    watchlist._rate_limiter.clear()


@pytest.mark.asyncio
async def test_watchlist_compare_success(client: AsyncClient):
    async def fake_scrape_watchlist(username, max_pages=40):
        if username == "alice":
            return [
                {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"},
                {"title": "Inception", "year": "2010", "slug": "/film/inception/"},
            ]
        return [
            {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"},
            {"title": "Heat", "year": "1995", "slug": "/film/heat-1995/"},
        ]

    with patch("app.routes.watchlist.scrape_watchlist", side_effect=fake_scrape_watchlist):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["users"] == ["alice", "bob"]
    assert body["counts"] == {
        "first_total": 2,
        "second_total": 2,
        "common": 1,
        "first_only": 1,
        "second_only": 1,
    }
    assert body["match_score"] == 50.0
    assert body["common"] == [{"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"}]


@pytest.mark.asyncio
async def test_watchlist_compare_rejects_same_username(client: AsyncClient):
    r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "@alice"]})
    assert r.status_code == 400
    assert r.json()["detail"]["error_code"] == "same_username"


@pytest.mark.asyncio
async def test_watchlist_compare_rejects_invalid_username(client: AsyncClient):
    r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "bad name"]})
    assert r.status_code == 400
    assert r.json()["detail"]["error_code"] == "invalid_username"


@pytest.mark.asyncio
async def test_watchlist_compare_user_not_found(client: AsyncClient):
    async def fake_scrape_watchlist(username, max_pages=40):
        raise ValueError(f"User '{username}' not found")

    with patch("app.routes.watchlist.scrape_watchlist", side_effect=fake_scrape_watchlist):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["ghost", "bob"]})

    assert r.status_code == 404
    assert r.json()["detail"]["error_code"] == "user_not_found"


@pytest.mark.asyncio
async def test_watchlist_compare_scrape_failure(client: AsyncClient):
    async def fake_scrape_watchlist(username, max_pages=40):
        raise RuntimeError("network down")

    with patch("app.routes.watchlist.scrape_watchlist", side_effect=fake_scrape_watchlist):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 502
    assert r.json()["detail"]["error_code"] == "watchlist_scrape_failed"


@pytest.mark.asyncio
async def test_recommend_from_compare_highest_rated(client: AsyncClient):
    async def fake_scrape_watchlist(username, max_pages=40):
        return [
            {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"},
            {"title": "Heat", "year": "1995", "slug": "/film/heat-1995/"},
        ]

    async def fake_enrich(session, films, limit=30):
        return [
            {**film, "vote_average": 7.0 if film["title"] == "Aftersun" else 8.3, "poster_path": "/p.jpg"}
            for film in films
        ]

    with (
        patch("app.routes.watchlist.scrape_watchlist", side_effect=fake_scrape_watchlist),
        patch("app.routes.watchlist.enrich_films", side_effect=fake_enrich),
    ):
        r = await client.post(
            "/api/recommend-from-compare",
            json={"usernames": ["alice", "bob"], "strategy": "highest_rated"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["recommendation"]["title"] == "Heat"
    assert body["recommendation"]["reason"] == "Both of you have it on your watchlist."


@pytest.mark.asyncio
async def test_recommend_from_compare_no_overlap(client: AsyncClient):
    async def fake_scrape_watchlist(username, max_pages=40):
        if username == "alice":
            return [{"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"}]
        return [{"title": "Heat", "year": "1995", "slug": "/film/heat-1995/"}]

    with patch("app.routes.watchlist.scrape_watchlist", side_effect=fake_scrape_watchlist):
        r = await client.post("/api/recommend-from-compare", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 404
    assert r.json()["detail"]["error_code"] == "no_common_watchlist"


@pytest.mark.asyncio
async def test_date_night_success(client: AsyncClient):
    async def fake_scrape_profile_sources(username, max_pages=25):
        return (
            [{"title": "Before Sunrise", "year": "1995", "rating": 4.5, "watch_date": "2024-01-01"}],
            [{"title": "Heat", "year": "1995", "rating": 4.0, "watch_date": ""}],
        )

    async def fake_scrape_watchlist(username, max_pages=25):
        return [{"title": "Past Lives", "year": "2023", "slug": "/film/past-lives/"}]

    async def fake_enrich(session, films, limit=80):
        return [
            {
                **film,
                "genres": ["Romance", "Drama"],
                "directors": ["Richard Linklater"],
                "decade": "1990s",
            }
            for film in films
        ]

    async def fake_discover(session, mutual_profile, watched_keys):
        from app.models.recommend import FilmRecommendation

        return [
            FilmRecommendation(
                title="Past Lives",
                year="2023",
                reason="Matched because you both lean toward Romance",
                poster_path="/past.jpg",
            )
        ]

    with (
        patch("app.routes.recommend.scrape_profile_sources", side_effect=fake_scrape_profile_sources),
        patch("app.routes.recommend.scrape_watchlist", side_effect=fake_scrape_watchlist),
        patch("app.routes.recommend.enrich_films", side_effect=fake_enrich),
        patch("app.routes.recommend.discover_date_night_recommendations", side_effect=fake_discover),
    ):
        r = await client.post("/api/date-night", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 200
    body = r.json()
    assert body["mutual_profile"]["top_genres"] == ["Romance", "Drama"]
    assert body["mutual_profile"]["era_overlap"] == "1990s"
    assert body["recommendations"][0]["title"] == "Past Lives"
