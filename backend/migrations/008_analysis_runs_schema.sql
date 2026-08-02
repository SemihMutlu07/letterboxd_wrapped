-- Migration 008: analysis_runs schema additions
-- Run in: Supabase Dashboard → SQL Editor
--
-- Links each analysis run to the backend task that produced it (idempotent,
-- partial unique index so a repeated run can never double-write the same
-- task), records which cine algorithm version produced the result, and
-- reserves user/session identity columns. No backfill: historical rows keep
-- task_id NULL.

-- task_id: backend task uuid (from ops_tasks / task_manager). NULL for old rows.
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS task_id uuid;

-- One task → at most one analysis_runs row. Partial index ignores NULLs so
-- pre-migration rows and non-task analyses are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS analysis_runs_task_id_uniq
  ON public.analysis_runs (task_id)
  WHERE task_id IS NOT NULL;

-- Which cine algorithm version produced this run. The backend reports it in
-- stats.sinefil_meter.model_version; the DB default keeps legacy inserts safe.
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS analysis_version text NOT NULL DEFAULT 'cine_v2';

-- Error classification code (Phase 2 taxonomy). For now a generic code +
-- error_message text stand together.
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS error_code text;

-- Identity columns: user_id reserved for future auth; anonymous_session_id
-- carries the browser session id the run was made under.
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS anonymous_session_id text;
