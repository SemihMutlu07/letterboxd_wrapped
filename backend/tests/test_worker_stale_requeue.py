"""Stale-claim requeue must respect the claim owner's heartbeat (per-task lease).

A long scrape past STALE_CLAIM_SECONDS must stay running while its claimed_by
worker keeps heartbeating. Another live worker must not protect a dead owner's
claim, and must not cause a live owner's long scrape to be yanked.
"""
from datetime import datetime, timedelta, timezone

from app import task_manager
from app.config import settings


def _reset() -> None:
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._worker_heartbeats.clear()
    task_manager._last_worker_meta = {}


def _heartbeat(worker_id: str, *, age_seconds: float = 1) -> None:
    """Record a heartbeat as-of (now - age_seconds)."""
    now = datetime.now(timezone.utc)
    when = now - timedelta(seconds=age_seconds)
    task_manager._worker_heartbeats[worker_id] = when
    task_manager._last_worker_heartbeat = when
    task_manager._last_worker_meta = {"worker_id": worker_id}


def test_live_owner_long_scrape_is_not_requeued():
    """Old claim + fresh owner heartbeat => stay running, requeue 0."""
    _reset()
    try:
        now = datetime.now(timezone.utc)
        tid = task_manager.create_scrape_job("longhauler")
        job = task_manager.claim_next_scrape_job(worker_id="worker-a")
        assert job is not None and job.task_id == tid
        assert job.claimed_by == "worker-a"
        assert job.lease_token

        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)
        _heartbeat("worker-a", age_seconds=1)

        assert task_manager.requeue_stale_claims(now=now) == 0
        assert job.status == "running"
        assert job.claimed is True
        assert job.claimed_at is not None
        assert job.lease_token is not None
    finally:
        _reset()


def test_dead_owner_stale_claim_is_requeued_even_if_other_worker_live():
    """Owner A dead + worker B alive => A's over-age claim requeues."""
    _reset()
    try:
        now = datetime.now(timezone.utc)
        task_manager.create_scrape_job("ghost")
        job = task_manager.claim_next_scrape_job(worker_id="worker-a")
        assert job is not None
        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)

        # A went dark; B is still heartbeating (global online would be true).
        _heartbeat("worker-a", age_seconds=settings.worker_heartbeat_max_age_seconds + 120)
        _heartbeat("worker-b", age_seconds=1)

        assert task_manager.requeue_stale_claims(now=now) == 1
        assert job.status == "pending" and job.claimed is False
        assert job.claimed_by is None and job.lease_token is None
    finally:
        _reset()


def test_live_owner_protected_while_other_worker_also_online():
    """B's long scrape stays; A's dead claim requeues — independent leases."""
    _reset()
    try:
        now = datetime.now(timezone.utc)
        task_manager.create_scrape_job("a-job")
        job_a = task_manager.claim_next_scrape_job(worker_id="worker-a")
        task_manager.create_scrape_job("b-job")
        job_b = task_manager.claim_next_scrape_job(worker_id="worker-b")
        assert job_a and job_b

        job_a.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 60)
        job_b.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 60)

        _heartbeat("worker-a", age_seconds=settings.worker_heartbeat_max_age_seconds + 120)
        _heartbeat("worker-b", age_seconds=1)

        assert task_manager.requeue_stale_claims(now=now) == 1
        assert job_a.status == "pending" and job_a.claimed is False
        assert job_b.status == "running" and job_b.claimed is True
        assert job_b.claimed_by == "worker-b"
    finally:
        _reset()


def test_dead_worker_stale_claim_is_still_requeued():
    """Control: old claim + no recent owner heartbeat => requeue 1."""
    _reset()
    try:
        now = datetime.now(timezone.utc)
        task_manager.create_scrape_job("ghost")
        job = task_manager.claim_next_scrape_job(worker_id="worker-a")
        assert job is not None and job.status == "running"

        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)
        _heartbeat("worker-a", age_seconds=1200)

        assert task_manager.requeue_stale_claims(now=now) == 1
        assert job.status == "pending" and job.claimed is False
    finally:
        _reset()


def test_legacy_claim_without_owner_uses_global_online_gate():
    """Pre-lease in-flight rows (no claimed_by) keep the global HB protection."""
    _reset()
    try:
        now = datetime.now(timezone.utc)
        task_manager.create_scrape_job("legacy")
        job = task_manager.claim_next_scrape_job(worker_id="worker-a")
        assert job is not None
        # Simulate a row loaded before migration filled claimed_by.
        job.claimed_by = None
        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)
        task_manager._last_worker_heartbeat = now - timedelta(seconds=1)

        assert task_manager.requeue_stale_claims(now=now) == 0
        assert job.status == "running"
    finally:
        _reset()
