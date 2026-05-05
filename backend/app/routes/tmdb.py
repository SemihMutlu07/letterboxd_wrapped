from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.services.tmdb_client import tmdb_get

router = APIRouter()


@router.get("/api/tmdb/person/search")
async def search_tmdb_person(request: Request, name: str, role: str | None = None):
    """Search TMDB for a person and return their profile image URL."""
    if not name:
        raise HTTPException(status_code=400, detail="Name parameter is required")

    session = request.app.state.aiohttp_session
    try:
        person_data = await tmdb_get(session, "search/person", {"query": name, "include_adult": "false"})

        if not person_data or not person_data.get("results"):
            return {"found": False, "message": "No person found"}

        person = person_data["results"][0]

        if role and len(person_data["results"]) > 1:
            dept_map = {"director": "Directing", "actor": "Acting"}
            target_dept = dept_map.get(role.lower())
            if target_dept:
                for result in person_data["results"]:
                    if result.get("known_for_department") == target_dept:
                        person = result
                        break

        profile_path = person.get("profile_path")
        if profile_path:
            return {
                "found": True,
                "person_id": person.get("id"),
                "profile_path": profile_path,
                "name": person.get("name"),
                "known_for_department": person.get("known_for_department"),
                "url": f"https://image.tmdb.org/t/p/w300{profile_path}",
            }
        return {
            "found": False,
            "person_id": person.get("id"),
            "name": person.get("name"),
            "message": "No profile image available",
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TMDB API error: {exc}") from exc


@router.get("/tmdb-proxy/{path:path}")
async def tmdb_proxy(path: str, request: Request):
    """Proxy TMDB images to avoid CORS issues."""
    session = request.app.state.aiohttp_session
    try:
        async with session.get(f"https://image.tmdb.org/{path}") as resp:
            if resp.status != 200:
                raise HTTPException(status_code=404, detail="Image not found")
            data = await resp.read()
            return Response(
                content=data,
                media_type=resp.headers.get("Content-Type", "image/jpeg"),
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Range, Accept",
                    "Access-Control-Expose-Headers": "Content-Length, Content-Range",
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to proxy image: {exc}") from exc


@router.options("/tmdb-proxy/{path:path}")
async def tmdb_proxy_options(path: str):
    """Handle CORS preflight for TMDB proxy."""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Range, Accept",
            "Access-Control-Expose-Headers": "Content-Length, Content-Range",
        },
    )
