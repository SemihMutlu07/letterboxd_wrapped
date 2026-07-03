from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import uuid


@dataclass
class TaskState:
    task_id: str
    status: str = "pending"   # pending | running | done | failed
    stage: str = "idle"
    message: str = "Queued"
    progress: int = 0
    total: int = 0
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    queue_wait_seconds: Optional[float] = None
    worker_seconds: Optional[float] = None
    scrape_seconds: Optional[float] = None
    analysis_seconds: Optional[float] = None
    postback_seconds: Optional[float] = None
    error_type: Optional[str] = None
    error_stage: Optional[str] = None
    error_code: Optional[str] = None
    kind: str = "analyze"     # analyze | scrape | watchlist
    username: Optional[str] = None
    usernames: list = field(default_factory=list)  # watchlist jobs
    job_type: str = ""  # watchlist_compare | date_night
    claimed: bool = False     # scrape/watchlist jobs: True once a worker has taken it
    trace_events: list[Dict[str, Any]] = field(default_factory=list)


_tasks: Dict[str, TaskState] = {}

# Last time the desktop scrape worker checked in. None until the first heartbeat.
_last_worker_heartbeat: Optional[datetime] = None
_last_worker_started_at: Optional[datetime] = None
_last_worker_shutdown_at: Optional[datetime] = None
_last_worker_meta: Dict[str, Any] = {}
_last_worker_self_test: Optional[Dict[str, Any]] = None

WORKER_DESIRED_STATES = {"run", "pause"}
SUPERVISOR_LOG_TAIL_MAX_LINES = 80
SUPERVISOR_LOG_LINE_MAX_CHARS = 500

_worker_desired_state: str = "run"
_worker_restart_token: int = 0
_worker_restart_requested_at: Optional[datetime] = None
_last_supervisor_poll_at: Optional[datetime] = None
_last_supervisor_report_at: Optional[datetime] = None
_last_supervisor_status: Dict[str, Any] = {}
_supervisor_log_tail: list[str] = []


def create_task_state() -> str:
    task_id = str(uuid.uuid4())
    _tasks[task_id] = TaskState(task_id=task_id)
    return task_id


def create_scrape_job(username: str) -> str:
    """Queue a username scrape job for the desktop worker to claim."""
    task_id = str(uuid.uuid4())
    task = TaskState(
        task_id=task_id,
        kind="scrape",
        username=username,
        stage="queued",
        message="Queued on desktop scraper",
    )
    _tasks[task_id] = task
    append_task_event(task_id, "queued", "Queued on desktop scraper", level="info")
    return task_id


def create_watchlist_compare_job(usernames: list) -> str:
    """Queue a watchlist comparison job for the desktop worker to claim."""
    task_id = str(uuid.uuid4())
    task = TaskState(
        task_id=task_id,
        kind="watchlist",
        job_type="watchlist_compare",
        usernames=list(usernames),
        stage="queued",
        message="Queued on desktop scraper",
    )
    _tasks[task_id] = task
    return task_id


def create_date_night_job(usernames: list) -> str:
    """Queue a date-night scrape job for the desktop worker to claim."""
    task_id = str(uuid.uuid4())
    task = TaskState(
        task_id=task_id,
        kind="watchlist",
        job_type="date_night",
        usernames=list(usernames),
        stage="queued",
        message="Queued on desktop scraper",
    )
    _tasks[task_id] = task
    return task_id


def claim_next_watchlist_job() -> Optional[TaskState]:
    """Atomically claim the oldest unclaimed watchlist/date-night job."""
    if is_worker_paused():
        return None
    queued = sorted(
        [t for t in _tasks.values() if t.kind == "watchlist" and t.status == "pending" and not t.claimed],
        key=lambda t: t.created_at,
    )
    if not queued:
        return None
    job = queued[0]
    job.claimed = True
    job.status = "running"
    job.stage = "scraping"
    job.message = "Desktop worker is reading Letterboxd"
    job.claimed_at = datetime.now(timezone.utc)
    return job


def claim_next_scrape_job() -> Optional[TaskState]:
    """Atomically claim the oldest unclaimed, pending scrape job (single-process,
    asyncio single-thread — no lock needed). Returns None if the queue is empty."""
    if is_worker_paused():
        return None
    queued = sorted(
        [t for t in _tasks.values() if t.kind == "scrape" and t.status == "pending" and not t.claimed],
        key=lambda t: t.created_at,
    )
    if not queued:
        return None
    job = queued[0]
    job.claimed = True
    job.status = "running"
    job.stage = "scraping"
    job.message = "Desktop worker is reading Letterboxd"
    job.claimed_at = datetime.now(timezone.utc)
    append_task_event(job.task_id, "claimed", "Desktop worker claimed the scrape job", level="info")
    return job


def _seconds_between(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if start is None or end is None:
        return None
    return round((end - start).total_seconds(), 1)


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _apply_telemetry(task: TaskState, telemetry: Optional[Dict[str, Any]]) -> None:
    if not telemetry:
        return
    for field_name in (
        "duration_seconds",
        "queue_wait_seconds",
        "worker_seconds",
        "scrape_seconds",
        "analysis_seconds",
        "postback_seconds",
        "error_type",
        "error_stage",
        "error_code",
    ):
        if field_name in telemetry:
            setattr(task, field_name, telemetry.get(field_name))


def _event_elapsed(task: TaskState) -> Optional[float]:
    return _seconds_between(task.created_at, datetime.now(timezone.utc))


def append_task_event(
    task_id: str,
    stage: str,
    message: str,
    *,
    elapsed_seconds: Optional[float] = None,
    level: str = "info",
    metrics: Optional[Dict[str, Any]] = None,
) -> None:
    task = _tasks.get(task_id)
    if not task:
        return
    task.trace_events.append(
        {
            "stage": stage,
            "message": message,
            "elapsed_seconds": elapsed_seconds if elapsed_seconds is not None else _event_elapsed(task),
            "level": level,
            "metrics": metrics or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


def append_task_event_payload(task_id: str, event: Dict[str, Any]) -> None:
    task = _tasks.get(task_id)
    if not task:
        return
    stage = str(event.get("stage") or "event")
    message = str(event.get("message") or "")
    elapsed = event.get("elapsed_seconds")
    key = (stage, message, elapsed)
    for existing in task.trace_events:
        if (existing.get("stage"), existing.get("message"), existing.get("elapsed_seconds")) == key:
            return
    task.trace_events.append(
        {
            "stage": stage,
            "message": message,
            "elapsed_seconds": elapsed if isinstance(elapsed, (int, float)) else _event_elapsed(task),
            "level": str(event.get("level") or "info"),
            "metrics": event.get("metrics") if isinstance(event.get("metrics"), dict) else {},
            "timestamp": str(event.get("timestamp") or datetime.now(timezone.utc).isoformat()),
        }
    )


def record_worker_heartbeat(meta: Optional[Dict[str, Any]] = None) -> None:
    global _last_worker_heartbeat, _last_worker_meta
    _last_worker_heartbeat = datetime.now(timezone.utc)
    if meta:
        _last_worker_meta = {**_last_worker_meta, **meta}


def record_worker_startup(meta: Optional[Dict[str, Any]] = None) -> None:
    global _last_worker_started_at, _last_worker_meta
    _last_worker_started_at = datetime.now(timezone.utc)
    _last_worker_meta = dict(meta or {})
    record_worker_heartbeat()


def record_worker_shutdown(meta: Optional[Dict[str, Any]] = None) -> None:
    global _last_worker_shutdown_at, _last_worker_meta
    _last_worker_shutdown_at = datetime.now(timezone.utc)
    if meta:
        _last_worker_meta = {**_last_worker_meta, **meta}


def record_worker_self_test(result: Dict[str, Any]) -> None:
    global _last_worker_self_test
    _last_worker_self_test = {
        **result,
        "reported_at": datetime.now(timezone.utc),
    }


def is_worker_paused() -> bool:
    return _worker_desired_state == "pause"


def set_worker_desired_state(desired_state: str) -> Dict[str, Any]:
    global _worker_desired_state
    normalized = str(desired_state or "").strip().lower()
    if normalized not in WORKER_DESIRED_STATES:
        raise ValueError("desired_state must be 'run' or 'pause'")
    _worker_desired_state = normalized
    return get_worker_control_state()


def request_worker_restart() -> Dict[str, Any]:
    global _worker_restart_token, _worker_restart_requested_at
    _worker_restart_token += 1
    _worker_restart_requested_at = datetime.now(timezone.utc)
    return get_worker_control_state()


def apply_worker_control_state(control: Dict[str, Any]) -> Dict[str, Any]:
    """Replace in-memory worker controls with a validated persisted snapshot."""
    global _worker_desired_state, _worker_restart_token, _worker_restart_requested_at
    desired_state = str(control.get("desired_state") or "run").strip().lower()
    if desired_state not in WORKER_DESIRED_STATES:
        desired_state = "run"

    restart_token = control.get("restart_token")
    try:
        restart_token_int = max(0, int(restart_token))
    except (TypeError, ValueError):
        restart_token_int = 0

    _worker_desired_state = desired_state
    _worker_restart_token = restart_token_int
    _worker_restart_requested_at = _parse_iso_datetime(control.get("restart_requested_at"))
    return get_worker_control_state()


def get_worker_control_state() -> Dict[str, Any]:
    return {
        "desired_state": _worker_desired_state,
        "restart_token": _worker_restart_token,
        "restart_requested_at": _iso(_worker_restart_requested_at),
    }


def record_supervisor_poll(last_seen_restart_token: Optional[str] = None) -> Dict[str, Any]:
    global _last_supervisor_poll_at
    _last_supervisor_poll_at = datetime.now(timezone.utc)
    control = get_worker_control_state()
    # One-directional: only restart when the backend's token is NEWER than what the
    # supervisor last saw. A plain `!=` would fire a spurious restart (+ git pull,
    # killing in-flight scrapes) after a backend restart resets the token to 0 while
    # the supervisor still holds a higher last-seen value.
    should_restart = False
    if last_seen_restart_token is not None:
        try:
            should_restart = int(last_seen_restart_token) < int(control["restart_token"])
        except (TypeError, ValueError):
            should_restart = False
    return {
        **control,
        "should_restart": should_restart,
        "last_supervisor_poll_at": _iso(_last_supervisor_poll_at),
    }


def _coerce_supervisor_log_tail(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        lines = value.splitlines()
    elif isinstance(value, list):
        lines = [str(item) for item in value]
    else:
        lines = [str(value)]
    clipped: list[str] = []
    for line in lines[-SUPERVISOR_LOG_TAIL_MAX_LINES:]:
        clipped.append(line[-SUPERVISOR_LOG_LINE_MAX_CHARS:])
    return clipped


def record_supervisor_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    global _last_supervisor_report_at, _last_supervisor_status, _supervisor_log_tail
    _last_supervisor_report_at = datetime.now(timezone.utc)
    allowed = {
        "supervisor_version",
        "supervisor_started_at",
        "backend_url",
        "poll_interval_seconds",
        "desired_state",
        "child_status",
        "child_pid",
        "child_started_at",
        "child_exit_code",
        "last_restart_token_seen",
        "last_control_error",
    }
    status = {key: payload.get(key) for key in allowed if key in payload}
    status["reported_at"] = _iso(_last_supervisor_report_at)
    _last_supervisor_status = status
    _supervisor_log_tail = _coerce_supervisor_log_tail(payload.get("log_tail"))
    return get_worker_supervisor_status()


def get_worker_supervisor_status() -> Dict[str, Any]:
    return {
        "last_poll_at": _iso(_last_supervisor_poll_at),
        "last_report_at": _iso(_last_supervisor_report_at),
        "child_status": _last_supervisor_status.get("child_status") or "unknown",
        "child_pid": _last_supervisor_status.get("child_pid"),
        "child_started_at": _last_supervisor_status.get("child_started_at"),
        "last_restart_token_seen": _last_supervisor_status.get("last_restart_token_seen"),
        "last_control_error": _last_supervisor_status.get("last_control_error"),
        "status": dict(_last_supervisor_status),
        "log_tail": list(_supervisor_log_tail),
    }


def is_worker_online(max_age_seconds: int) -> bool:
    if _last_worker_heartbeat is None:
        return False
    return (datetime.now(timezone.utc) - _last_worker_heartbeat) <= timedelta(seconds=max_age_seconds)


def get_worker_version_status(expected_protocol_version: int, backend_git_sha: Optional[str] = None) -> Dict[str, Any]:
    worker_protocol = _last_worker_meta.get("worker_protocol_version")
    try:
        worker_protocol_int = int(worker_protocol) if worker_protocol is not None else None
    except (TypeError, ValueError):
        worker_protocol_int = None
    protocol_match = worker_protocol_int == expected_protocol_version
    return {
        "expected_protocol_version": expected_protocol_version,
        "worker_protocol_version": worker_protocol_int,
        "protocol_match": protocol_match,
        "worker_git_sha": _last_worker_meta.get("worker_git_sha"),
        "worker_branch": _last_worker_meta.get("worker_branch"),
        "backend_git_sha": backend_git_sha,
        "mismatch": not protocol_match,
    }


def get_worker_status(max_age_seconds: int, *, expected_protocol_version: int = 1, backend_git_sha: Optional[str] = None) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    heartbeat_age_seconds = (
        round((now - _last_worker_heartbeat).total_seconds(), 1)
        if _last_worker_heartbeat is not None
        else None
    )
    scrape_tasks = [t for t in _tasks.values() if t.kind == "scrape"]
    queued = [t for t in scrape_tasks if t.status == "pending" and not t.claimed]
    running = [t for t in scrape_tasks if t.status == "running"]
    completed = [t for t in scrape_tasks if t.status == "done"]
    failed = [t for t in scrape_tasks if t.status == "failed"]

    self_test = dict(_last_worker_self_test) if _last_worker_self_test else None
    if self_test and isinstance(self_test.get("reported_at"), datetime):
        self_test["reported_at"] = self_test["reported_at"].isoformat()

    return {
        "online": is_worker_online(max_age_seconds),
        "control": get_worker_control_state(),
        "supervisor": get_worker_supervisor_status(),
        "last_heartbeat": _iso(_last_worker_heartbeat),
        "heartbeat_age_seconds": heartbeat_age_seconds,
        "max_age_seconds": max_age_seconds,
        "last_started_at": _iso(_last_worker_started_at),
        "last_shutdown_at": _iso(_last_worker_shutdown_at),
        "meta": dict(_last_worker_meta),
        "version": get_worker_version_status(expected_protocol_version, backend_git_sha),
        "self_test": self_test,
        "queue": {
            "queued": len(queued),
            "running": len(running),
            "completed": len(completed),
            "failed": len(failed),
        },
        "current_jobs": [
            {
                "task_id": t.task_id,
                "username": t.username,
                "status": t.status,
                "stage": t.stage,
                "message": t.message,
                "created_at": t.created_at.isoformat(),
                "claimed_at": _iso(t.claimed_at),
                "elapsed_seconds": _seconds_between(t.created_at, now),
                "duration_seconds": t.duration_seconds,
                "queue_wait_seconds": t.queue_wait_seconds,
                "worker_seconds": t.worker_seconds,
                "scrape_seconds": t.scrape_seconds,
                "analysis_seconds": t.analysis_seconds,
                "postback_seconds": t.postback_seconds,
                "error_type": t.error_type,
                "error_stage": t.error_stage,
                "error_code": t.error_code,
                "latest_event": t.trace_events[-1] if t.trace_events else None,
            }
            for t in sorted(queued + running, key=lambda task: task.created_at)
        ][:10],
        "recent_failures": [
            {
                "task_id": t.task_id,
                "username": t.username,
                "message": t.error or t.message,
                "error_type": t.error_type,
                "error_stage": t.error_stage,
                "error_code": t.error_code,
                "duration_seconds": t.duration_seconds,
                "queue_wait_seconds": t.queue_wait_seconds,
                "worker_seconds": t.worker_seconds,
                "failed_at": _iso(t.failed_at),
            }
            for t in sorted(failed, key=lambda task: task.failed_at or task.created_at, reverse=True)
        ][:10],
    }


def get_task_state(task_id: str) -> Optional[TaskState]:
    return _tasks.get(task_id)


def update_task_progress(
    task_id: str,
    stage: str,
    message: str,
    progress: int = 0,
    total: int = 0,
) -> None:
    task = _tasks.get(task_id)
    if task:
        task.stage = stage
        task.message = message
        task.progress = progress
        task.total = total
        append_task_event(task_id, stage, message, metrics={"progress": progress, "total": total})
    print(f"📊 [{task_id[:8]}] {stage}: {message} ({progress}/{total})")


def set_task_running(task_id: str) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "running"


def set_task_done(task_id: str, result: Any, telemetry: Optional[Dict[str, Any]] = None) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "done"
        task.result = result
        task.stage = "complete"
        task.message = "Analysis complete!"
        task.progress = 100
        task.total = 100
        task.completed_at = datetime.now(timezone.utc)
        task.duration_seconds = _seconds_between(task.created_at, task.completed_at)
        task.queue_wait_seconds = _seconds_between(task.created_at, task.claimed_at)
        task.worker_seconds = _seconds_between(task.claimed_at, task.completed_at)
        _apply_telemetry(task, telemetry)


def set_task_failed(task_id: str, error: str, telemetry: Optional[Dict[str, Any]] = None) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "failed"
        task.error = error
        task.stage = "error"
        task.message = error
        task.failed_at = datetime.now(timezone.utc)
        task.duration_seconds = _seconds_between(task.created_at, task.failed_at)
        task.queue_wait_seconds = _seconds_between(task.created_at, task.claimed_at)
        task.worker_seconds = _seconds_between(task.claimed_at, task.failed_at)
        _apply_telemetry(task, telemetry)


# ponytail: a scrape running longer than this is treated as a dead worker and
# re-queued; raise it if real scrapes ever legitimately exceed it.
STALE_CLAIM_SECONDS = 900


def requeue_stale_claims(now: Optional[datetime] = None) -> int:
    """Reset scrape jobs stuck 'running' past STALE_CLAIM_SECONDS back to 'pending'
    so a single-worker outage (desktop offline mid-scrape) re-queues the job
    instead of stranding the user on a job that will never complete. Idempotent —
    a late postback is keyed by task_id. Returns how many were re-queued."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=STALE_CLAIM_SECONDS)
    count = 0
    for t in _tasks.values():
        if t.kind == "scrape" and t.status == "running" and t.claimed_at and t.claimed_at < cutoff:
            t.claimed = False
            t.status = "pending"
            t.stage = "queued"
            t.message = "Re-queued after the worker went away mid-scrape"
            t.claimed_at = None
            append_task_event(t.task_id, "requeued", "Worker went away mid-scrape; re-queued", level="warning")
            count += 1
    return count


async def cleanup_loop() -> None:
    """Re-queue stale claims, then remove tasks older than 1 hour; every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        now = datetime.now(timezone.utc)
        requeue_stale_claims(now)
        cutoff = now - timedelta(hours=1)
        stale = [tid for tid, t in list(_tasks.items()) if t.created_at < cutoff]
        for tid in stale:
            _tasks.pop(tid, None)
