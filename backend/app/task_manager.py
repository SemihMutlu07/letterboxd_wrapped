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


_tasks: Dict[str, TaskState] = {}


def create_task_state() -> str:
    task_id = str(uuid.uuid4())
    _tasks[task_id] = TaskState(task_id=task_id)
    return task_id


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
    print(f"📊 [{task_id[:8]}] {stage}: {message} ({progress}/{total})")


def set_task_running(task_id: str) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "running"


def set_task_done(task_id: str, result: Any) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "done"
        task.result = result
        task.stage = "complete"
        task.message = "Analysis complete!"
        task.progress = 100
        task.total = 100


def set_task_failed(task_id: str, error: str) -> None:
    task = _tasks.get(task_id)
    if task:
        task.status = "failed"
        task.error = error
        task.stage = "error"
        task.message = error


async def cleanup_loop() -> None:
    """Remove tasks older than 1 hour; runs every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.utcnow() - timedelta(hours=1)
        stale = [tid for tid, t in list(_tasks.items()) if t.created_at < cutoff]
        for tid in stale:
            _tasks.pop(tid, None)
