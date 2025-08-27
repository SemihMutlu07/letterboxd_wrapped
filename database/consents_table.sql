-- Create the consents table for tracking user consent decisions
CREATE TABLE IF NOT EXISTS consents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
    decision TEXT NOT NULL CHECK (decision IN ('accept', 'decline')),
    ms_to_decision INTEGER NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_consents_session_id ON consents(session_id);

-- Create an index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_consents_created_at ON consents(created_at);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows inserts from authenticated and anonymous users
-- This allows the frontend to insert consent data
CREATE POLICY "Allow inserts for consent tracking" ON consents
    FOR INSERT WITH CHECK (true);

-- Create a policy that allows reads for authenticated users only
-- This prevents public access to consent data
CREATE POLICY "Allow reads for authenticated users only" ON consents
    FOR SELECT USING (auth.role() = 'authenticated');
