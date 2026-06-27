-- Migration 001: Extract key metrics from analysis_runs.summary JSONB into queryable columns.
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Also adds FK constraints between frontend tables for data integrity.
--
-- Why: The summary JSONB blob contains all analysis results but is opaque to SQL.
-- Extracting 5 key columns makes cross-user queries possible (e.g. "top 10 users by
-- sinefil_meter", "average total_countries across all analyses").
--
-- Refs: CLAUDE.md → Data model & Supabase guidelines.

-- ────────────────────────────────────────────────────
-- 1) Add extracted metric columns to analysis_runs
-- ────────────────────────────────────────────────────
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS total_films    INT,
  ADD COLUMN IF NOT EXISTS sinefil_meter  INT,
  ADD COLUMN IF NOT EXISTS cinematic_persona TEXT,
  ADD COLUMN IF NOT EXISTS average_rating FLOAT,
  ADD COLUMN IF NOT EXISTS total_countries INT;

-- Index on sinefil_meter for leaderboard-style queries
CREATE INDEX IF NOT EXISTS idx_analysis_runs_sinefil_meter
  ON public.analysis_runs (sinefil_meter DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_total_films
  ON public.analysis_runs (total_films DESC NULLS LAST);

-- ────────────────────────────────────────────────────
-- 2) Foreign key constraints (optional but recommended)
-- ────────────────────────────────────────────────────
-- Only add if no orphan rows exist. Run this first to check:
--   SELECT * FROM analysis_runs WHERE session_id NOT IN (SELECT session_id FROM user_sessions);
--   SELECT * FROM feedback WHERE session_id NOT IN (SELECT session_id FROM user_sessions);
-- If orphans exist, either clean them up or skip FK creation.

-- ALTER TABLE public.analysis_runs
--   ADD CONSTRAINT fk_analysis_runs_session
--   FOREIGN KEY (session_id) REFERENCES public.user_sessions(session_id);

-- ALTER TABLE public.feedback
--   ADD CONSTRAINT fk_feedback_session
--   FOREIGN KEY (session_id) REFERENCES public.user_sessions(session_id);

-- ────────────────────────────────────────────────────
-- Note: The frontend writes extracted columns at the same time it writes summary.
-- See frontend/src/lib/supabase/analysis_runs.ts → finishAnalysis()
-- Backend ops tables (ops_runs, ops_watchlist_runs, ops_date_night_runs) remain
-- as server-side mirrors for admin dashboard durability. They intentionally use
-- jsonb payload for flexibility; no column extraction needed unless cross-table
-- queries are required in the future.