-- Migration 004: GIN index on ops_runs.payload
-- Speeds up future admin-dashboard queries that filter on payload->>'key'.
-- Run in: Supabase Dashboard → SQL Editor

create index if not exists idx_ops_runs_payload on public.ops_runs using gin (payload);
