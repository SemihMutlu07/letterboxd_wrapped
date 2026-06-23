-- Movies Wrapped — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor on the new project
-- (https://ghumergebwwrwlykwjsu.supabase.co)
--
-- Creates 3 ops tables for admin dashboard durability + RLS policies
-- so the backend can read/write using the anon (publishable) key only.

-- ──────────────────────────────────────────────
-- 1) ops_runs — main analysis runs
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ops_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    username    TEXT,
    ok          BOOLEAN NOT NULL DEFAULT true,
    total_films INT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ops_runs_created_at ON public.ops_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_runs_username  ON public.ops_runs (username);

ALTER TABLE public.ops_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_runs_anon_all" ON public.ops_runs
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);


-- ──────────────────────────────────────────────
-- 2) ops_watchlist_runs — watchlist comparison runs
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ops_watchlist_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usernames   TEXT[] NOT NULL DEFAULT '{}',
    ok          BOOLEAN NOT NULL DEFAULT true,
    match_score INT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ops_watchlist_runs_created_at ON public.ops_watchlist_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_watchlist_runs_usernames  ON public.ops_watchlist_runs USING gin (usernames);

ALTER TABLE public.ops_watchlist_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_watchlist_runs_anon_all" ON public.ops_watchlist_runs
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);


-- ──────────────────────────────────────────────
-- 3) ops_date_night_runs — date night recommendation runs
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ops_date_night_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usernames   TEXT[] NOT NULL DEFAULT '{}',
    ok          BOOLEAN NOT NULL DEFAULT true,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ops_date_night_runs_created_at ON public.ops_date_night_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_date_night_runs_usernames  ON public.ops_date_night_runs USING gin (usernames);

ALTER TABLE public.ops_date_night_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_date_night_runs_anon_all" ON public.ops_date_night_runs
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);
