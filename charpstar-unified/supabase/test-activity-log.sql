-- Test script for activity log functionality
-- Run this in Supabase SQL editor to verify everything is working

-- 1. Test the activity_log table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'activity_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Test the recent_activities view structure
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'recent_activities' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Test inserting a sample activity (if you have a user)
-- Replace 'your-user-id-here' with an actual user ID from auth.users
-- INSERT INTO activity_log (user_id, action, type, resource_type) 
-- VALUES ('your-user-id-here', 'Test activity', 'general', 'test');

-- 4. Test the view (will be empty initially)
SELECT * FROM recent_activities LIMIT 5;

-- 5. Check if the log_activity function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'log_activity' 
  AND routine_schema = 'public';

-- 6. Test RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'activity_log'; 