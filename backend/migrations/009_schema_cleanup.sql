-- Migration 009: schema cleanup — test data, privacy, ops_runs columns, RLS
-- Run in: Supabase Dashboard → SQL Editor
--
-- Order matters: counts are printed (NOTICE) before each DELETE so you can
-- verify the expected row numbers against what the dashboard shows.
--
-- NOTE: the runner must be an authenticated role with RLS access to the ops_*
-- tables (e.g. ops@movieswrapped.internal via the backend credentials) — the
-- anon key cannot see these rows since migration 005.

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

-- 1b. user_sessions: username LIKE '_verify_trigger%' (test/trigger rows)
do $$
declare n int;
begin
  select count(*) into n from user_sessions
    where username like '\_verify\_trigger%' escape '\';
  raise notice 'DELETE user_sessions _verify_trigger%: % rows', n;
end $$;

delete from user_sessions
  where username like '\_verify\_trigger%' escape '\';

-- 1c. ops_runs: failed rows older than 2026-07-01
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
-- 2. Privacy
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. consent = 'decline' → username NULL (user asked to opt out)
update user_sessions
  set username = null
  where consent = 'decline' and username is not null;

-- 2b. ops_watchlist_runs.payload: strip any client-IP field (defense in depth —
--     future-proofs against IPs accidentally landing in the jsonb payload).
--     Handles the common key names; no-op when absent.
update ops_watchlist_runs
  set payload = payload - 'client_ip'
             - 'clientIp'
             - 'ip'
             - 'ip_address'
             - 'x_forwarded_for'
  where payload ? 'client_ip'
     or payload ? 'clientIp'
     or payload ? 'ip'
     or payload ? 'ip_address'
     or payload ? 'x_forwarded_for';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. ops_runs: new nullable columns (no backfill)
-- ────────────────────────────────────────────────────────────────────────────
alter table ops_runs
  add column if not exists task_id text,
  add column if not exists job_type text,
  add column if not exists source text,
  add column if not exists error_code text,
  add column if not exists duration_ms integer,
  add column if not exists worker_id text;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS: close anon access on all ops_* tables.
--    analysis_runs is deliberately untouched — the frontend still inserts
--    there directly until Phase 2 moves that write to the backend.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  tbl text;
  policy_record record;
begin
  foreach tbl in array array[
    'ops_runs', 'ops_watchlist_runs', 'ops_date_night_runs',
    'ops_worker_events', 'ops_workers', 'ops_dashboard_settings', 'ops_tasks'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    -- Drop any anon-granting policies; keep backend (authenticated) policies.
    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and 'anon' = any(roles::text[])
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, tbl);
      raise notice 'Dropped anon policy % on %', policy_record.policyname, tbl;
    end loop;
    -- Belt and braces: revoke direct table grants from anon/authenticated
    -- so only RLS-gated backend-user rows are reachable.
    execute format('revoke all on public.%I from anon', tbl);
  end loop;
end $$;
