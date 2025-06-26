# Activity Logging Debugging Guide

This guide helps troubleshoot issues with the activity logging system.

## Current Issue: 401 Unauthorized Error

The activity log API is returning a 401 Unauthorized error. Here's how to debug and fix it:

## Step 1: Test Authentication

Visit this URL in your browser to test if authentication is working:

```
http://localhost:3000/api/activity/test
```

**Expected Response:**

```json
{
  "success": true,
  "user_id": "your-user-id",
  "profile": { "id": "...", "role": "..." },
  "activities_count": 0,
  "message": "Authentication and database access working"
}
```

**If you get 401:**

- Make sure you're logged in to the application
- Check if your session is valid
- Try logging out and back in

## Step 2: Check Database Setup

Run this SQL in your Supabase SQL editor to verify the database setup:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('activity_log', 'recent_activities')
ORDER BY table_name;

-- Check if policies exist
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

-- Check if function exists
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'log_activity'
  AND routine_schema = 'public';

-- Test the view
SELECT * FROM recent_activities LIMIT 1;
```

## Step 3: Test Manual Activity Logging

Try logging an activity manually in the SQL editor:

```sql
-- Replace 'your-user-id' with your actual user ID
SELECT log_activity(
  'Test activity',
  'Testing the activity logging system',
  'general',
  'test',
  NULL,
  '{"test": true}'::jsonb
);
```

## Step 4: Check Browser Console

Open your browser's developer tools and check the Console and Network tabs:

1. **Console Tab:** Look for any JavaScript errors
2. **Network Tab:** Check the actual request/response for the activity log API call

## Step 5: Verify API Route

The API route should be accessible at:

```
GET http://localhost:3000/api/activity/log?limit=8&offset=0
```

## Common Issues and Solutions

### Issue 1: Session Not Found

**Symptoms:** 401 error with "Authentication required"
**Solution:**

- Make sure you're logged in
- Check if cookies are enabled
- Try refreshing the page

### Issue 2: Database Access Denied

**Symptoms:** 500 error with database access issues
**Solution:**

- Run the database migration again
- Check RLS policies
- Verify user permissions

### Issue 3: View Not Found

**Symptoms:** 500 error mentioning "recent_activities"
**Solution:**

- Run the activity-log.sql migration
- Check if the view was created successfully

### Issue 4: Function Not Found

**Symptoms:** 500 error mentioning "log_activity"
**Solution:**

- Run the activity-log.sql migration
- Check if the function was created successfully

## Debugging Commands

### Check Current User Session

```sql
-- In Supabase SQL editor
SELECT auth.uid() as current_user_id;
```

### Check User Profile

```sql
-- Replace with your user ID
SELECT * FROM profiles WHERE id = 'your-user-id';
```

### Test RLS Policies

```sql
-- This should return your own activities only
SELECT * FROM activity_log WHERE user_id = auth.uid();
```

### Check Activity Log Table

```sql
-- Check table structure
\d activity_log

-- Check recent activities
SELECT * FROM recent_activities LIMIT 5;
```

## Next Steps

1. **Run the test endpoint** to verify authentication
2. **Check the database setup** with the SQL queries above
3. **Look at browser console** for any errors
4. **Try manual activity logging** in SQL editor
5. **Check the API response** in Network tab

If you're still having issues, please share:

- The response from `/api/activity/test`
- Any console errors
- The database setup verification results
