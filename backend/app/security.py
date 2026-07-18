"""Process-local abuse controls for the single-instance deployment."""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_events: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, bucket: str, *, limit: int, window: int) -> None:
    now = time.monotonic()
    events = _events[(bucket, client_key(request))]
    while events and events[0] <= now - window:
        events.popleft()
    if len(events) >= limit:
        retry_after = max(1, int(window - (now - events[0])))
        raise HTTPException(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            detail={"error_code": "rate_limited", "message": "Too many requests. Please try again later."},
        )
    events.append(now)


def reset_rate_limits() -> None:
    _events.clear()
