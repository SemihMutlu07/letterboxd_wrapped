-- Migration 007: ops_workers
-- One row per worker — heartbeat state, not an event log.
-- Heartbeat upserts by worker_id; only real lifecycle/job events go to
-- ops_worker_events. Run in: Supabase Dashboard → SQL Editor
create table if not exists ops_workers (
  worker_id        text primary key,
  last_seen_at     timestamptz not null default now(),
  version          text not null default '',
  active_jobs      integer not null default 0,
  max_concurrency  integer not null default 1,
  status           text not null default 'online'
);

alter table ops_workers enable row level security;

-- Same backend-only access pattern as the other ops_* tables (see 005):
-- the backend authenticates as ops@movieswrapped.internal and the public
-- anon key can do nothing here.
create policy "backend ops workers select" on public.ops_workers for select to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend ops workers insert" on public.ops_workers for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
create policy "backend ops workers update" on public.ops_workers for update to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal')
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
