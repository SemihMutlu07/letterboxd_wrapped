-- Migration 001: Extract key metrics from analysis_runs.summary JSONB into queryable columns.
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Why: The summary JSONB blob contains all analysis results but is opaque to SQL.
-- Extracting 5 key columns makes cross-user queries possible (e.g. "top 10 users by
-- sinefil_meter", "average total_countries across all analyses").
--
-- Refs: CLAUDE.md → Data model & Supabase guidelines.

-- ────────────────────────────────────────────────────
-- Add extracted metric columns to analysis_runs
-- ────────────────────────────────────────────────────
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS total_films    INT,
  ADD COLUMN IF NOT EXISTS sinefil_meter  INT,
  ADD COLUMN IF NOT EXISTS cinematic_persona TEXT,
  ADD COLUMN IF NOT EXISTS average_rating FLOAT,
  ADD COLUMN IF NOT EXISTS total_countries INT;

-- Index on sinefil_meter for leaderboard-style queries ("top N users by sinefil_meter")
CREATE INDEX IF NOT EXISTS idx_analysis_runs_sinefil_meter
  ON public.analysis_runs (sinefil_meter DESC NULLS LAST);

-- ────────────────────────────────────────────────────
-- Note: The frontend writes extracted columns at the same time it writes summary.
-- See frontend/src/lib/supabase/analysis_runs.ts → finishAnalysis()
-- Backend ops tables (ops_runs, ops_watchlist_runs, ops_date_night_runs) remain
-- as server-side mirrors for admin dashboard durability. They intentionally use
-- jsonb payload for flexibility; no column extraction needed unless cross-table
-- queries are required in the future.