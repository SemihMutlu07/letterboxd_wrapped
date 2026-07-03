-- Migration 003: ops_dashboard_settings
-- Durable admin/dashboard settings used by Render-hosted backend instances.
-- Run in: Supabase Dashboard -> SQL Editor

create table if not exists ops_dashboard_settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table ops_dashboard_settings enable row level security;

create policy "anon can read dashboard settings"
  on ops_dashboard_settings for select
  to anon
  using (true);

create policy "anon can insert dashboard settings"
  on ops_dashboard_settings for insert
  to anon
  with check (true);

create policy "anon can update dashboard settings"
  on ops_dashboard_settings for update
  to anon
  using (true)
  with check (true);

insert into ops_dashboard_settings (key, value)
values (
  'worker_control',
  '{"desired_state":"run","restart_token":0,"restart_requested_at":null}'::jsonb
)
on conflict (key) do nothing;
