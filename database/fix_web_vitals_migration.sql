-- Migration to fix web_vitals table - remove FID from CHECK constraint
-- Run this in your Supabase SQL editor

-- First, drop the existing table (if it exists and has data you don't need)
-- DROP TABLE IF EXISTS web_vitals;

-- Or if you want to preserve existing data, alter the constraint:
ALTER TABLE web_vitals DROP CONSTRAINT IF EXISTS web_vitals_metric_check;
ALTER TABLE web_vitals ADD CONSTRAINT web_vitals_metric_check CHECK (metric IN ('CLS', 'FCP', 'LCP', 'TTFB', 'INP'));

-- Verify the change
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'web_vitals' AND column_name = 'metric';

-- Check the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'web_vitals'::regclass AND conname = 'web_vitals_metric_check';
