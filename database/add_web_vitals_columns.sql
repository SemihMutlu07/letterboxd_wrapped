-- Add missing columns to web_vitals table
-- Run this in your Supabase SQL editor

-- Add the missing columns if they don't exist
ALTER TABLE web_vitals 
ADD COLUMN IF NOT EXISTS device_mem NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS hardware_concurrency INTEGER,
ADD COLUMN IF NOT EXISTS effective_connection_type TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow inserts for web vitals tracking" ON web_vitals;
DROP POLICY IF EXISTS "Allow reads for authenticated users only" ON web_vitals;

-- Recreate the insert policy for anonymous users
CREATE POLICY "Allow inserts for web vitals tracking" ON web_vitals
    FOR INSERT WITH CHECK (true);

-- Recreate the read policy for authenticated users only
CREATE POLICY "Allow reads for authenticated users only" ON web_vitals
    FOR SELECT USING (auth.role() = 'authenticated');

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'web_vitals' 
ORDER BY ordinal_position;

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'web_vitals';
