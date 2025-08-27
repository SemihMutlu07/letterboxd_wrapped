-- Create the web_vitals table for tracking Core Web Vitals metrics
CREATE TABLE IF NOT EXISTS web_vitals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT,
    route TEXT NOT NULL,
    metric TEXT NOT NULL CHECK (metric IN ('CLS', 'FCP', 'LCP', 'TTFB', 'INP')),
    value DECIMAL(10,4) NOT NULL,
    nav_type TEXT,
    device_mem DECIMAL(5,2),
    hardware_concurrency INTEGER,
    effective_connection_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_web_vitals_session_id ON web_vitals(session_id);
CREATE INDEX IF NOT EXISTS idx_web_vitals_route ON web_vitals(route);
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric ON web_vitals(metric);
CREATE INDEX IF NOT EXISTS idx_web_vitals_created_at ON web_vitals(created_at);
CREATE INDEX IF NOT EXISTS idx_web_vitals_route_metric ON web_vitals(route, metric);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE web_vitals ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows inserts from any user
-- This allows the frontend to insert web vitals data
CREATE POLICY "Allow inserts for web vitals tracking" ON web_vitals
    FOR INSERT WITH CHECK (true);

-- Create a policy that allows reads for authenticated users only
-- This prevents public access to web vitals data
CREATE POLICY "Allow reads for authenticated users only" ON web_vitals
    FOR SELECT USING (auth.role() = 'authenticated');
