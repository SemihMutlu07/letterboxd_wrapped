-- Table for storing Watchlist Comparison Logs
CREATE TABLE IF NOT EXISTS public.ops_watchlist_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usernames TEXT[] NOT NULL,
    ok BOOLEAN NOT NULL DEFAULT true,
    match_score INT,
    payload JSONB NOT NULL
);

-- Indices for fast searching and sorting in Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_ops_watchlist_runs_created_at 
ON public.ops_watchlist_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_watchlist_runs_usernames 
ON public.ops_watchlist_runs USING gin (usernames);


-- Table for storing Date Night Run Logs
CREATE TABLE IF NOT EXISTS public.ops_date_night_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    usernames TEXT[] NOT NULL,
    ok BOOLEAN NOT NULL DEFAULT true,
    payload JSONB NOT NULL
);

-- Indices for fast searching and sorting in Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_ops_date_night_runs_created_at 
ON public.ops_date_night_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_date_night_runs_usernames 
ON public.ops_date_night_runs USING gin (usernames);
