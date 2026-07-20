"""
Letterboxd Wrapped API — app factory.

Run from the backend/ directory:
    python -m uvicorn app.main:app --reload
"""
from __future__ import annotations

import asyncio
import warnings
from contextlib import asynccontextmanager

import logging
import traceback

import aiohttp
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.task_manager import cleanup_loop
from app.routes import analyze, feedback, recommend, tmdb, watchlist, worker
from app import admin, supabase_ops
from app.services.worker_monitor import log_worker_event, start_worker_monitor
from app.services.run_log import cleanup_expired_runs

logger = logging.getLogger("letterboxd_wrapped")
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(levelname)-8s [%(name)s] %(message)s",
)

# urllib3 DEBUG logs the full URL of every fetch — noisy, and any future
# query-param secret would leak into stdout. Pin urllib3 at WARNING.
logging.getLogger("urllib3").setLevel(logging.WARNING)

warnings.filterwarnings("ignore")

banner = "🎬 LETTERBOXD WRAPPED - High-Speed Backend Edition"
logger.info("=" * 60)
logger.info(banner)
logger.info("=" * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.tmdb_api_key:
        raise RuntimeError("TMDB_API_KEY not found. Set it in .env or as an environment variable.")

    await cleanup_expired_runs()
    app.state.aiohttp_session = aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit_per_host=20)
    )
    asyncio.create_task(supabase_ops.check_expected_schema())
    _cleanup = asyncio.create_task(cleanup_loop())
    _monitor = await start_worker_monitor()
    logger.info("🚀 FastAPI app startup: aiohttp session created.")
    yield
    _monitor.cancel()
    _cleanup.cancel()
    await app.state.aiohttp_session.close()
    logger.info("🌙 FastAPI app shutdown: aiohttp session closed.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Letterboxd Wrapped API",
        description="Analyze Letterboxd exports and generate wrapped-style film statistics.",
        version="2.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def limit_upload_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 50 * 1024 * 1024:
            return JSONResponse(
                status_code=413,
                content={"error_code": "payload_too_large", "message": "Request body must be under 50 MB."},
            )
        return await call_next(request)

    @app.middleware("http")
    async def catch_unhandled_exceptions(request: Request, call_next):
        # Catching exceptions here (inside user-middleware) lets CORSMiddleware
        # wrap the JSONResponse on the way out. @app.exception_handler(Exception)
        # routes to Starlette's ServerErrorMiddleware which sits OUTSIDE CORS
        # and would strip the Access-Control-Allow-Origin header.
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error("Unhandled exception on %s %s\n%s", request.method, request.url.path, traceback.format_exc())
            await log_worker_event(
                "backend_error",
                {
                    "source": "backend",
                    "severity": "error",
                    "path": request.url.path,
                    "method": request.method,
                    "error_type": type(exc).__name__,
                    "message": "Unhandled backend exception",
                },
            )
            return JSONResponse(
                status_code=500,
                content={"error_code": "internal_error", "message": "Something went wrong on the server."},
            )

    app.include_router(admin.router)
    app.include_router(analyze.router)
    app.include_router(tmdb.router)
    app.include_router(feedback.router)
    app.include_router(watchlist.router)
    app.include_router(recommend.router)
    app.include_router(worker.router)

    @app.get("/")
    async def root():
        return {"message": "🎬 Letterboxd Wrapped - High-Speed Backend", "admin": "/admin"}

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    # Run from backend/ directory: python -m app.main
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
