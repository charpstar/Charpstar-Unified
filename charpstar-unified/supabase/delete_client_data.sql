-- Delete all data for client "Karthik Test Production"
-- Run this in Supabase SQL Editor
-- WARNING: This will permanently delete all data for this client!

-- First, check how many records will be deleted
SELECT 
    'onboarding_assets' as table_name,
    COUNT(*) as record_count
FROM onboarding_assets
WHERE client = 'Karthik Test Production'

UNION ALL

SELECT 
    'assets' as table_name,
    COUNT(*) as record_count
FROM assets
WHERE client = 'Karthik Test Production';

-- Delete from onboarding_assets table
DELETE FROM onboarding_assets
WHERE client = 'Karthik Test Production';

-- Delete from assets table
DELETE FROM assets
WHERE client = 'Karthik Test Production';

-- Verify deletion
SELECT 
    'onboarding_assets' as table_name,
    COUNT(*) as remaining_records
FROM onboarding_assets
WHERE client = 'Karthik Test Production'

UNION ALL

SELECT 
    'assets' as table_name,
    COUNT(*) as remaining_records
FROM assets
WHERE client = 'Karthik Test Production';





