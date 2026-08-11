-- Migration 010: per-task worker lease fields on ops_tasks
-- Claim ownership for multi-worker safety: stale requeue keys off claimed_by's
-- heartbeat, and postbacks must present the matching lease_token.
-- Run in: Supabase Dashboard -> SQL Editor

alter table ops_tasks
  add column if not exists claimed_by text;

alter table ops_tasks
  add column if not exists lease_token text;
