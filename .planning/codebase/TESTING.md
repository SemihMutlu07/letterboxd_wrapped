# TESTING.md — Testing Structure & Practices

> Mapping date: 2026-05-09

## Test Runners

| Layer | Runner | Config File |
|-------|--------|-------------|
| Frontend | Vitest v4 | `frontend/vitest.config.ts` |
| Backend | pytest + pytest-asyncio | `backend/pytest.ini` |

## Frontend Testing

### Configuration (`frontend/vitest.config.ts`)
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
});
```

### Test Setup (`frontend/src/test/setup.ts`)
- Imports `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument()`)

### Test Files

| File | Type | What it tests |
|------|------|---------------|
| `frontend/src/test/components.test.tsx` | Smoke tests | Basic rendering of key components |

### Current State
- **Coverage is thin.** Only one test file for the frontend with basic smoke tests.
- No tests for:
  - API client (`lib/api.ts`) — mocking fetch calls
  - Results page logic (derived data calculations, lazy loading)
  - Share card generation
  - Theme switching
  - Analytics/consent flow
  - Landing page interactions (upload, scrape)

### Running Tests
```bash
cd frontend
npm test         # vitest run
npm run test:watch  # vitest watch mode
```

## Backend Testing

### Configuration (`backend/pytest.ini`)
```ini
[pytest]
testpaths = tests
asyncio_mode = auto
markers =
    slow: tests that hit external APIs
```

### Test Files

| File | Type | What it tests |
|------|------|---------------|
| `backend/tests/test_api.py` | Integration (ASGI) | API endpoints via `httpx.AsyncClient` |
| `backend/tests/test_scraper.py` | Unit (mocked) | Scraper URL parsing, HTML extraction |

### Integration Test Pattern (`test_api.py`)

**Fixtures:**
- `minimal_watched_csv()` — 1-row CSV with Inception
- `zip_with_watched()` — ZIP containing that CSV
- `client()` — ASGI test client with mocked TMDB API key and aiohttp session

**Key testing approach:**
```python
@pytest.fixture
async def client():
    """ASGI test client — lifespan is bypassed; aiohttp session is mocked."""
    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key"}):
        from app.main import create_app
        import aiohttp
        app = create_app()
        session = aiohttp.ClientSession()
        app.state.aiohttp_session = session
        transport = ASGITransport(app=app)
        try:
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac
        finally:
            await session.close()
```

**Tests cover:**
1. Health check (`GET /health`) returns 200
2. Root (`GET /`) returns banner
3. Scrape profile invalid username (404)
4. Upload no files (400)
5. Upload ZIP with watched CSV (202)
6. Scraper HTML parsing

### Running Tests
```bash
cd backend
pytest                          # all tests
pytest -m "not slow"            # skip external-API tests
pytest tests/test_api.py        # single file
pytest -x --pdb                 # stop on first failure, drop into debugger
```

### Current State
- **Integration tests exist but are minimal** — they mock the TMDB API but don't test the full pipeline end-to-end.
- Scraper tests are basic (parsing sample HTML fragments).
- No tests for:
  - Cinema scale computation (`analysis_utils.py`)
  - TMDB client caching logic
  - Analysis pipeline edge cases (empty CSV, missing columns, NaN handling)
  - Rate limiting in watchlist/feedback routes
  - Username parsing regex patterns

## Coverage Gaps

| Area | Coverage | Notes |
|------|----------|-------|
| Frontend components | Minimal (smoke only) | Only 1 test file |
| Frontend API layer | None | No fetch mocking |
| Backend routes | Partial | Basic integration tests exist |
| Backend services | Minimal | Only scraper has tests |
| Backend utils (cinema scale) | None | Pure functions, easy to test |
| Backend TMDB client | None | Caching, rate limiting |
| Analysis pipeline edge cases | None | Empty/partial/malformed CSVs |
| Scraper resilience | Partial | Basic HTML parse tests |

## Test Dependencies
- `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`
- `jsdom` (DOM environment)
- `httpx` (Python ASGI test client)
- `pytest-asyncio` (async test support)
