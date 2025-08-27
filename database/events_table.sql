-- Create the events table for tracking analytics events
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT,
    route TEXT,
    name TEXT NOT NULL,
    props JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_route ON events(route);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows inserts from any user
-- This allows the frontend to insert event data
CREATE POLICY "Allow inserts for event tracking" ON events
    FOR INSERT WITH CHECK (true);

-- Create a policy that allows reads for authenticated users only
-- This prevents public access to event data
CREATE POLICY "Allow reads for authenticated users only" ON events
    FOR SELECT USING (auth.role() = 'authenticated');
