-- Migration 009: schema cleanup — test data, ops_runs columns
-- Run in: Supabase Dashboard → SQL Editor
--
-- Order matters: counts are printed (NOTICE) before each DELETE so you can
-- verify the expected row numbers against what the dashboard shows.
--
-- NOTE: the runner must be an authenticated role with RLS access to the ops_*
-- tables (e.g. ops@movieswrapped.internal via the backend credentials) — the
-- anon key cannot see these rows since migration 005.
--
-- This file reflects the current state of the database: the privacy updates
-- (consent decline username NULL, payload IP stripping) and the RLS anon
-- lockdown were applied manually and are intentionally NOT repeated here.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Test data cleanup
-- ────────────────────────────────────────────────────────────────────────────

-- 1a. ops_watchlist_runs: rows whose payload contains usernames ["alice","bob"]
do $$
declare n int;
begin
  select count(*) into n from ops_watchlist_runs
    where payload @> '{"usernames": ["alice", "bob"]}';
  raise notice 'DELETE ops_watchlist_runs alice/bob: % rows', n;
end $$;

delete from ops_watchlist_runs
  where payload @> '{"usernames": ["alice", "bob"]}';

-- 1b. ops_runs: failed rows older than 2026-07-01
do $$
declare n int;
begin
  select count(*) into n from ops_runs
    where created_at < '2026-07-01' and ok = false;
  raise notice 'DELETE ops_runs old failed: % rows', n;
end $$;

delete from ops_runs
  where created_at < '2026-07-01' and ok = false;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ops_runs: new nullable columns (no backfill)
-- ────────────────────────────────────────────────────────────────────────────
alter table ops_runs
  add column if not exists task_id text,
  add column if not exists job_type text,
  add column if not exists source text,
  add column if not exists error_code text,
  add column if not exists duration_ms integer,
  add column if not exists worker_id text;

-- Admin dashboard queries group runs by worker/task; a partial index keeps
-- those lookups fast without covering NULL rows from pre-migration runs.
create index if not exists idx_ops_runs_task_id
  on ops_runs (task_id)
  where task_id is not null;
