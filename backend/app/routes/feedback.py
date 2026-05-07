from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

router = APIRouter()

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
_RATE_LIMIT_WINDOW = 600  # 10 minutes
_RATE_LIMIT_MAX = 3
_rate_limiter: dict[str, list[float]] = {}


def _parse_letterboxd_username(filename: str) -> Optional[str]:
    base = filename.replace("\\", "/").split("/")[-1].strip().lower()

    with_timestamp = re.match(
        r"^letterboxd-(.+?)-\d{4}(?:-\d{2}){0,4}(?:-utc)?(?:\.(?:csv|zip))?$",
        base,
        re.IGNORECASE,
    )
    if with_timestamp and with_timestamp.group(1):
        return with_timestamp.group(1).strip()

    simple = re.match(r"^letterboxd-(.+?)(?:\.(?:csv|zip))?$", base, re.IGNORECASE)
    if simple and simple.group(1):
        return simple.group(1).strip()

    return None


def _client_key(request: Request) -> str:
    xfwd = request.headers.get("x-forwarded-for")
    if xfwd:
        return xfwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(client_key: str) -> bool:
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    events = [t for t in _rate_limiter.get(client_key, []) if t >= cutoff]
    if len(events) >= _RATE_LIMIT_MAX:
        return False
    events.append(now)
    _rate_limiter[client_key] = events
    return True


@router.post("/api/parse-username")
async def parse_username(request: Request):
    """Parse a Letterboxd username from an export filename."""
    try:
        body = await request.json()
        filename = body.get("filename")
        if not filename or not isinstance(filename, str):
            return {"username": None}

        return {"username": _parse_letterboxd_username(filename)}
    except Exception:
        return {"username": None}


@router.post("/api/feedback")
async def submit_feedback(
    request: Request,
    sessionId: str = Form(...),
    kind: str = Form("general"),
    message: str = Form(""),
    include_names: bool = Form(False),
    attachment: Optional[UploadFile] = File(None),
):
    if not _check_rate_limit(_client_key(request)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    attachment_bytes: Optional[bytes] = None
    if attachment is not None:
        chunked = await attachment.read()
        if len(chunked) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Attachment too large (max 5 MB)")
        attachment_bytes = chunked

    reports_dir = Path("uploads") / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    issue_id = str(uuid.uuid4())[:8]

    payload = {
        "issue_id": issue_id,
        "sessionId": sessionId,
        "kind": kind,
        "message": message[:4000],
        "include_names": include_names,
        "received_at": datetime.utcnow().isoformat(),
        "client": _client_key(request),
    }
    (reports_dir / f"feedback-{issue_id}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if attachment_bytes is not None:
        (reports_dir / f"feedback-{issue_id}.bin").write_bytes(attachment_bytes)

    return {"ok": True, "issue_id": issue_id}


@router.post("/api/report")
async def submit_report(
    request: Request,
    sessionId: str = Form(...),
    include_names: bool = Form(False),
    bundle: UploadFile = File(...),
):
    if not _check_rate_limit(_client_key(request)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    data = await bundle.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Bundle too large (max 5 MB)")

    reports_dir = Path("uploads") / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    issue_id = str(uuid.uuid4())[:8]

    payload = {
        "issue_id": issue_id,
        "sessionId": sessionId,
        "include_names": include_names,
        "received_at": datetime.utcnow().isoformat(),
        "client": _client_key(request),
    }
    (reports_dir / f"report-{issue_id}.meta.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (reports_dir / f"report-{issue_id}.bin").write_bytes(data)

    return {"ok": True, "issue_id": issue_id}
