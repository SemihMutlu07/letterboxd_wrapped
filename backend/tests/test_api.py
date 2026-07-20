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
    """GET /api/progress/{task_id} for a non-existent task returns 404 with
    enough context (boot_age_seconds/likely_server_restart) for the frontend
    to distinguish a genuinely invalid task_id from an in-memory task queue
    wiped by a backend restart."""
    r = await client.get("/api/progress/nonexistent-task-id")
    assert r.status_code == 404
    detail = r.json()["detail"]
    assert detail["error_code"] == "task_not_found"
    assert isinstance(detail["boot_age_seconds"], (int, float))
    assert detail["likely_server_restart"] is True  # test process just booted


@pytest.mark.asyncio
async def test_progress_legacy_removed(client: AsyncClient):
    r = await client.get("/api/progress")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_task_id_polling_flow(client: AsyncClient, zip_with_watched: bytes):
    """Submit a job, then poll its task_id — should reach a terminal state."""
    import asyncio

    async def fake_run_analysis(task_id, session, csv_files, request_dir, username=None):
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
        poll_token = r.json()["poll_token"]

        # Give the background task a moment to run
        await asyncio.sleep(0.2)

        denied = await client.get(f"/api/progress/{task_id}")
        assert denied.status_code == 403
        poll = await client.get(f"/api/progress/{task_id}", headers={"X-Task-Token": poll_token})
        assert poll.status_code == 200
        body = poll.json()
        assert body["status"] in ("pending", "running", "done", "failed")


@pytest.mark.asyncio
async def test_rejects_zip_path_traversal(client: AsyncClient):
    import io
    import zipfile

    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("../watched.csv", "Name,Year\nExample,2024\n")
    response = await client.post(
        "/api/analyze",
        files={"files": ("export.zip", archive.getvalue(), "application/zip")},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["error_code"] == "unsafe_archive"


@pytest.mark.asyncio
async def test_analyze_rate_limit_has_retry_after(client: AsyncClient):
    for _ in range(3):
        response = await client.post("/api/analyze", files={"files": ("bad.txt", b"bad", "text/plain")})
        assert response.status_code == 400
    limited = await client.post("/api/analyze", files={"files": ("bad.txt", b"bad", "text/plain")})
    assert limited.status_code == 429
    assert "Retry-After" in limited.headers


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


def _done_task(result: dict, kind: str = "watchlist"):
    """Minimal task stub that looks done to the poll loop."""
    from types import SimpleNamespace
    return SimpleNamespace(status="done", result=result, error=None, kind=kind, poll_token="poll-token")


def _failed_task(message: str):
    from types import SimpleNamespace
    return SimpleNamespace(status="failed", result=None, error=message, kind="watchlist", poll_token="poll-token")


def _watchlist_patches(first_wl, second_wl):
    """Return context managers that simulate a worker completing a watchlist-compare job."""
    task = _done_task({"first_watchlist": first_wl, "second_watchlist": second_wl})
    return (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=task),
        patch("app.routes.watchlist.asyncio.sleep"),
    )


@pytest.mark.asyncio
async def test_watchlist_compare_success(client: AsyncClient):
    alice_wl = [
        {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/", "poster_url": "https://img/aftersun.jpg"},
        {"title": "Inception", "year": "2010", "slug": "/film/inception/", "poster_url": ""},
    ]
    bob_wl = [
        {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/", "poster_url": "https://img/aftersun.jpg"},
        {"title": "Heat", "year": "1995", "slug": "/film/heat-1995/", "poster_url": ""},
    ]

    async def fake_enrich_concurrent(session, films, limit=50):
        # Provide TMDB-like enrichment data so the response includes poster_path,
        # popularity, vote counts and genres.
        return [
            {
                **film,
                "poster_path": "/aftersun.jpg",
                "popularity": 10.0,
                "vote_average": 7.5,
                "vote_count": 1000,
                "genres": ["Drama"],
            }
            for film in films
        ]

    with (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=_done_task({"first_watchlist": alice_wl, "second_watchlist": bob_wl})),
        patch("app.routes.watchlist.asyncio.sleep"),
        patch("app.routes.watchlist.enrich_films_concurrent", side_effect=fake_enrich_concurrent),
    ):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 202
    body = r.json()
    assert body == {"task_id": "test-id", "status": "pending", "poll_token": "poll-token"}


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
async def test_watchlist_compare_worker_offline(client: AsyncClient):
    with patch("app.routes.watchlist.task_manager.is_worker_online", return_value=False):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["ghost", "bob"]})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "worker_offline"


@pytest.mark.asyncio
async def test_watchlist_compare_worker_failure(client: AsyncClient):
    with (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=_failed_task("Scraper service is unreachable.")),
        patch("app.routes.watchlist.asyncio.sleep"),
    ):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["alice", "bob"]})
    assert r.status_code == 202


@pytest.mark.asyncio
async def test_watchlist_compare_worker_user_not_found(client: AsyncClient):
    # A worker scrape that raised ValueError("User 'ghost' not found") must map
    # back to 404 user_not_found, not collapse into a generic 503.
    with (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=_failed_task("User 'ghost' not found")),
        patch("app.routes.watchlist.asyncio.sleep"),
    ):
        r = await client.post("/api/watchlist-compare", json={"usernames": ["ghost", "bob"]})
    assert r.status_code == 202


@pytest.mark.asyncio
async def test_recommend_from_compare_highest_rated(client: AsyncClient):
    common_films = [
        {"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"},
        {"title": "Heat", "year": "1995", "slug": "/film/heat-1995/"},
    ]

    async def fake_enrich(session, films, limit=30):
        return [
            {**film, "vote_average": 7.0 if film["title"] == "Aftersun" else 8.3, "poster_path": "/p.jpg"}
            for film in films
        ]

    with (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=_done_task({"first_watchlist": common_films, "second_watchlist": common_films})),
        patch("app.routes.watchlist.asyncio.sleep"),
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
    alice_wl = [{"title": "Aftersun", "year": "2022", "slug": "/film/aftersun/"}]
    bob_wl = [{"title": "Heat", "year": "1995", "slug": "/film/heat-1995/"}]

    with (
        patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True),
        patch("app.routes.watchlist.task_manager.create_watchlist_compare_job", return_value="test-id"),
        patch("app.routes.watchlist.task_manager.get_task_state", return_value=_done_task({"first_watchlist": alice_wl, "second_watchlist": bob_wl})),
        patch("app.routes.watchlist.asyncio.sleep"),
    ):
        r = await client.post("/api/recommend-from-compare", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 404
    assert r.json()["detail"]["error_code"] == "no_common_watchlist"


@pytest.mark.asyncio
async def test_date_night_success(client: AsyncClient):
    scraped_data = {
        "first_diary": [{"title": "Before Sunrise", "year": "1995", "rating": 4.5, "watch_date": "2024-01-01"}],
        "first_grid": [{"title": "Heat", "year": "1995", "rating": 4.0, "watch_date": ""}],
        "second_diary": [{"title": "Before Sunrise", "year": "1995", "rating": 4.0, "watch_date": "2024-02-01"}],
        "second_grid": [],
        "first_watchlist": [{"title": "Past Lives", "year": "2023", "slug": "/film/past-lives/"}],
        "second_watchlist": [{"title": "Past Lives", "year": "2023", "slug": "/film/past-lives/"}],
    }

    with (
        patch("app.routes.recommend.task_manager.is_worker_online", return_value=True),
        patch("app.routes.recommend.task_manager.create_date_night_job", return_value="test-id"),
        patch("app.routes.recommend.task_manager.get_task_state", return_value=_done_task(scraped_data)),
    ):
        r = await client.post("/api/date-night", json={"usernames": ["alice", "bob"]})

    assert r.status_code == 202
    body = r.json()
    assert body == {"task_id": "test-id", "status": "pending", "poll_token": "poll-token"}


# ---- find film -----------------------------------------------------------------

@pytest.mark.asyncio
async def test_find_film_rejects_too_few_and_too_many_usernames(client: AsyncClient):
    r = await client.post("/api/find-film", json={"usernames": ["alice"]})
    assert r.status_code == 422
    r = await client.post("/api/find-film", json={"usernames": [f"user{i}" for i in range(7)]})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_find_film_rejects_invalid_username(client: AsyncClient):
    r = await client.post("/api/find-film", json={"usernames": ["alice", "bad name"]})
    assert r.status_code == 400
    assert r.json()["detail"]["error_code"] == "invalid_username"


@pytest.mark.asyncio
async def test_find_film_rejects_duplicates_that_leave_one_user(client: AsyncClient):
    r = await client.post("/api/find-film", json={"usernames": ["alice", "@Alice "]})
    assert r.status_code == 400
    assert r.json()["detail"]["error_code"] == "duplicate_username"


@pytest.mark.asyncio
async def test_find_film_worker_offline(client: AsyncClient):
    with patch("app.routes.watchlist.task_manager.is_worker_online", return_value=False):
        r = await client.post("/api/find-film", json={"usernames": ["alice", "bob", "carol"]})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "worker_offline"


@pytest.mark.asyncio
async def test_find_film_queues_job_and_returns_poll_token(client: AsyncClient):
    from app import task_manager

    with patch("app.routes.watchlist.task_manager.is_worker_online", return_value=True):
        r = await client.post("/api/find-film", json={"usernames": ["alice", "@Bob", "carol", "alice"]})

    assert r.status_code == 202
    body = r.json()
    assert body["status"] == "pending"
    task = task_manager.get_task_state(body["task_id"])
    assert task.job_type == "find_film"
    assert task.usernames == ["alice", "bob", "carol"]  # normalized, deduped, order kept
    assert body["poll_token"] == task.poll_token
    task_manager._tasks.pop(body["task_id"], None)  # don't leak into other tests
