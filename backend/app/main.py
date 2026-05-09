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
from app.routes import analyze, feedback, recommend, tmdb, watchlist

logger = logging.getLogger("letterboxd_wrapped")
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(levelname)-8s [%(name)s] %(message)s",
)

warnings.filterwarnings("ignore")

print("🎬 LETTERBOXD WRAPPED - High-Speed Backend Edition")
print("=" * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.tmdb_api_key:
        raise RuntimeError("TMDB_API_KEY not found. Set it in .env or as an environment variable.")

    app.state.aiohttp_session = aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit_per_host=20)
    )
    _cleanup = asyncio.create_task(cleanup_loop())
    print("🚀 FastAPI app startup: aiohttp session created.")
    yield
    _cleanup.cancel()
    await app.state.aiohttp_session.close()
    print("🌙 FastAPI app shutdown: aiohttp session closed.")


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
    async def catch_unhandled_exceptions(request: Request, call_next):
        # Catching exceptions here (inside user-middleware) lets CORSMiddleware
        # wrap the JSONResponse on the way out. @app.exception_handler(Exception)
        # routes to Starlette's ServerErrorMiddleware which sits OUTSIDE CORS
        # and would strip the Access-Control-Allow-Origin header.
        try:
            return await call_next(request)
        except Exception:
            logger.error("Unhandled exception on %s %s\n%s", request.method, request.url.path, traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content={"error_code": "internal_error", "message": "Something went wrong on the server."},
            )

    app.include_router(analyze.router)
    app.include_router(tmdb.router)
    app.include_router(feedback.router)
    app.include_router(watchlist.router)
    app.include_router(recommend.router)

    @app.get("/")
    async def root():
        return {"message": "🎬 Letterboxd Wrapped - High-Speed Backend"}

    @app.get("/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    # Run from backend/ directory: python -m app.main
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
