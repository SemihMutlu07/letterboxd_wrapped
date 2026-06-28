-- Migration 002: ops_worker_events
-- Tracks worker online/offline transitions for admin dashboard timeline.
-- Run in: Supabase Dashboard → SQL Editor

create table if not exists ops_worker_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event_type  text not null,
  meta        jsonb not null default '{}'
);

alter table ops_worker_events enable row level security;

create policy "anon can insert worker events"
  on ops_worker_events for insert
  to anon
  with check (true);

create policy "anon can read worker events"
  on ops_worker_events for select
  to anon
  using (true);
