from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
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
    created_at: datetime = field(default_factory=datetime.utcnow)
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
    kind: str = "analyze"     # analyze | scrape
    username: Optional[str] = None
    claimed: bool = False     # scrape jobs: True once a worker has taken it
    trace_events: list[Dict[str, Any]] = field(default_factory=list)


_tasks: Dict[str, TaskState] = {}

# Last time the desktop scrape worker checked in. None until the first heartbeat.
_last_worker_heartbeat: Optional[datetime] = None
_last_worker_started_at: Optional[datetime] = None
_last_worker_shutdown_at: Optional[datetime] = None
_last_worker_meta: Dict[str, Any] = {}
_last_worker_self_test: Optional[Dict[str, Any]] = None


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


def claim_next_scrape_job() -> Optional[TaskState]:
    """Atomically claim the oldest unclaimed, pending scrape job (single-process,
    asyncio single-thread — no lock needed). Returns None if the queue is empty."""
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
    job.claimed_at = datetime.utcnow()
    append_task_event(job.task_id, "claimed", "Desktop worker claimed the scrape job", level="info")
    return job


def _seconds_between(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if start is None or end is None:
        return None
    return round((end - start).total_seconds(), 1)


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
    ):
        if field_name in telemetry:
            setattr(task, field_name, telemetry.get(field_name))


def _event_elapsed(task: TaskState) -> Optional[float]:
    return _seconds_between(task.created_at, datetime.utcnow())


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
            "timestamp": datetime.utcnow().isoformat(),
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
            "timestamp": str(event.get("timestamp") or datetime.utcnow().isoformat()),
        }
    )


def record_worker_heartbeat() -> None:
    global _last_worker_heartbeat
    _last_worker_heartbeat = datetime.utcnow()


def record_worker_startup(meta: Optional[Dict[str, Any]] = None) -> None:
    global _last_worker_started_at, _last_worker_meta
    _last_worker_started_at = datetime.utcnow()
    _last_worker_meta = dict(meta or {})
    record_worker_heartbeat()


def record_worker_shutdown(meta: Optional[Dict[str, Any]] = None) -> None:
    global _last_worker_shutdown_at, _last_worker_meta
    _last_worker_shutdown_at = datetime.utcnow()
    if meta:
        _last_worker_meta = {**_last_worker_meta, **meta}


def record_worker_self_test(result: Dict[str, Any]) -> None:
    global _last_worker_self_test
    _last_worker_self_test = {
        **result,
        "reported_at": datetime.utcnow(),
    }


def is_worker_online(max_age_seconds: int) -> bool:
    if _last_worker_heartbeat is None:
        return False
    return (datetime.utcnow() - _last_worker_heartbeat) <= timedelta(seconds=max_age_seconds)


def get_worker_status(max_age_seconds: int) -> Dict[str, Any]:
    now = datetime.utcnow()
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

    def _iso(value: Optional[datetime]) -> Optional[str]:
        return value.isoformat() if value is not None else None

    self_test = dict(_last_worker_self_test) if _last_worker_self_test else None
    if self_test and isinstance(self_test.get("reported_at"), datetime):
        self_test["reported_at"] = self_test["reported_at"].isoformat()

    return {
        "online": is_worker_online(max_age_seconds),
        "last_heartbeat": _iso(_last_worker_heartbeat),
        "heartbeat_age_seconds": heartbeat_age_seconds,
        "max_age_seconds": max_age_seconds,
        "last_started_at": _iso(_last_worker_started_at),
        "last_shutdown_at": _iso(_last_worker_shutdown_at),
        "meta": dict(_last_worker_meta),
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
        task.completed_at = datetime.utcnow()
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
        task.failed_at = datetime.utcnow()
        task.duration_seconds = _seconds_between(task.created_at, task.failed_at)
        task.queue_wait_seconds = _seconds_between(task.created_at, task.claimed_at)
        task.worker_seconds = _seconds_between(task.claimed_at, task.failed_at)
        _apply_telemetry(task, telemetry)


async def cleanup_loop() -> None:
    """Remove tasks older than 1 hour; runs every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.utcnow() - timedelta(hours=1)
        stale = [tid for tid, t in list(_tasks.items()) if t.created_at < cutoff]
        for tid in stale:
            _tasks.pop(tid, None)
