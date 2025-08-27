-- Migration to add meta field to consents table
-- Run this in your Supabase SQL editor

-- Add meta column as JSONB to store additional metadata
ALTER TABLE consents 
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Create an index on meta for faster queries if needed
CREATE INDEX IF NOT EXISTS idx_consents_meta ON consents USING GIN (meta);

-- Update the table comment to document the new field
COMMENT ON COLUMN consents.meta IS 'Additional metadata about the consent decision (e.g., source, context)';
