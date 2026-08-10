"""Stale-claim requeue must respect worker liveness, not just claim age.

P0 (plan step 7): requeue_stale_claims() currently re-queues any scrape job
whose claimed_at is older than STALE_CLAIM_SECONDS, looking ONLY at the claim
age. It never checks whether the desktop worker is still alive (heartbeating).

Consequence: a legitimately long scrape (large library, slow Letterboxd) that
runs past 5 minutes while the worker is healthily heartbeating gets yanked back
to 'pending' out from under the still-running worker — duplicating work and
confusing the user.

This test pins the correct contract: an in-flight job whose worker heartbeated
seconds ago must NOT be re-queued. It is expected to FAIL against the current
claim-age-only implementation (the fix lands in the next task).
"""
from datetime import datetime, timedelta, timezone

from app import task_manager


def _reset() -> None:
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None


def test_live_worker_long_scrape_is_not_requeued():
    """Old claim + fresh heartbeat (worker alive) => must stay running, requeue 0."""
    _reset()
    try:
        now = datetime.now(timezone.utc)

        tid = task_manager.create_scrape_job("longhauler")
        job = task_manager.claim_next_scrape_job()
        assert job is not None and job.task_id == tid
        assert job.status == "running" and job.stage == "scraping"

        # Claimed well past the stale window — a big library legitimately takes
        # longer than STALE_CLAIM_SECONDS to scrape.
        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)

        # ...but the worker is unmistakably alive: it heartbeated 1s ago, far
        # inside worker_heartbeat_max_age_seconds.
        task_manager._last_worker_heartbeat = now - timedelta(seconds=1)

        requeued = task_manager.requeue_stale_claims(now=now)

        assert requeued == 0, (
            "live-worker in-flight job was wrongly re-queued: "
            "requeue_stale_claims ignores heartbeat and looks only at claim age (P0)"
        )
        assert job.status == "running"
        assert job.claimed is True
        assert job.claimed_at is not None
    finally:
        _reset()


def test_dead_worker_stale_claim_is_still_requeued():
    """Control: old claim + NO recent heartbeat (worker gone) => requeue 1.

    Guards against a fix that simply disables requeuing entirely; the genuine
    dead-worker recovery path must keep working.
    """
    _reset()
    try:
        now = datetime.now(timezone.utc)

        task_manager.create_scrape_job("ghost")
        job = task_manager.claim_next_scrape_job()
        assert job is not None and job.status == "running"

        job.claimed_at = now - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 120)
        # Worker last heartbeated 20 minutes ago -> offline.
        task_manager._last_worker_heartbeat = now - timedelta(seconds=1200)

        assert task_manager.requeue_stale_claims(now=now) == 1
        assert job.status == "pending" and job.claimed is False
    finally:
        _reset()
