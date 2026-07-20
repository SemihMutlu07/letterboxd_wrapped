-- Migration 006: ops_tasks
-- Durable mirror of in-memory backend/app/task_manager.py `_tasks`, so
-- pending/running desktop-worker jobs (scrape/watchlist/date_night/find_film)
-- survive a Render backend restart. CSV-upload ("analyze") tasks are
-- intentionally NOT stored here — they read local disk files that a restart
-- also wipes, and the 9-minute worker-job timeout doesn't apply to them, so
-- a reloaded "analyze" row could hang forever instead of cleanly 404ing.
-- Run in: Supabase Dashboard -> SQL Editor

create table if not exists ops_tasks (
  task_id             text primary key,
  kind                text not null,             -- scrape | watchlist
  job_type            text,                       -- watchlist_compare | date_night | find_film
  status              text not null,              -- pending | running | done | failed
  stage               text,
  message             text,
  progress            int not null default 0,
  total               int not null default 0,
  username            text,
  avatar_only         boolean not null default false,
  usernames           jsonb not null default '[]',
  options             jsonb not null default '{}',
  claimed             boolean not null default false,
  owner_key           text,
  poll_token          text not null,
  result              jsonb,
  error               text,
  error_type          text,
  error_stage         text,
  error_code          text,
  duration_seconds    double precision,
  queue_wait_seconds  double precision,
  worker_seconds      double precision,
  scrape_seconds      double precision,
  analysis_seconds    double precision,
  postback_seconds    double precision,
  trace_events        jsonb not null default '[]',
  created_at          timestamptz not null,
  claimed_at          timestamptz,
  completed_at        timestamptz,
  failed_at           timestamptz,
  updated_at          timestamptz not null default now()
);

-- Startup reload only needs non-terminal rows; retention cleanup scans by
-- created_at (see supabase_ops.delete_before). Both benefit from this index.
create index if not exists idx_ops_tasks_status_created_at
  on ops_tasks (status, created_at);

alter table ops_tasks enable row level security;

-- Locked to the backend's dedicated ops auth user from creation (no anon
-- transitional policy — see 005_lock_ops_to_backend_user.sql precedent).
create policy "backend tasks all" on ops_tasks for all to authenticated
  using ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal')
  with check ((auth.jwt() ->> 'email') = 'ops@movieswrapped.internal');
