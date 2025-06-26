-- Run all database migrations
-- This script should be run in your Supabase SQL editor

-- 1. Create activity log table and related objects
\i activity-log.sql

-- 2. Create dashboard layouts table (if not exists)
\i dashboard-layouts.sql

-- 3. Setup avatar storage (if not exists)
\i setup-avatar-storage.sql

-- Verify tables were created
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('activity_log', 'dashboard_layouts', 'profiles', 'assets')
ORDER BY table_name; 