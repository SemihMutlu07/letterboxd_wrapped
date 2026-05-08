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
    """ASGI test client — lifespan is bypassed; aiohttp session is mocked."""
    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key"}):
        from app.main import create_app  # noqa: PLC0415
        import aiohttp

        app = create_app()

        # Inject a real aiohttp session so route handlers can reference it
        # without triggering the full lifespan startup.
        session = aiohttp.ClientSession()
        app.state.aiohttp_session = session

        transport = ASGITransport(app=app)
        try:
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac
        finally:
            await session.close()


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
