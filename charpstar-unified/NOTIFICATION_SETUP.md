# Notification System Setup Guide

## Overview

This guide explains how to set up email notifications for asset assignments in Charpstar Unified using Supabase SMTP.

## What's Implemented

### ✅ **Database Schema**

- `notifications` table with proper indexes and RLS policies
- Migration file: `supabase/migrations/create_notifications_table.sql`

### ✅ **Notification Service**

- `lib/notificationService.ts` - Handles notification creation and retrieval
- `lib/emailService.ts` - Uses Supabase Edge Functions for email sending

### ✅ **Supabase Edge Function**

- `supabase/functions/send-email/index.ts` - Handles SMTP email sending
- Uses your existing Supabase SMTP configuration

### ✅ **API Integration**

- Asset assignment API (`/api/assets/assign`) now sends notifications
- Notifications are created in database and emails are sent via Supabase

### ✅ **Frontend Components**

- Notification bell component added to site header
- Available for all users (modelers, QA, admins, clients)
- Shows unread notification count with badge
- Real-time updates every 30 seconds

## Setup Steps

### 1. Run Database Migration

```bash
# Apply the notifications table migration
supabase db push
```

### 2. Deploy the Email Edge Function

```bash
# Deploy the send-email function to Supabase
supabase functions deploy send-email
```

### 3. Verify SMTP Configuration

Ensure your Supabase project has SMTP configured in the dashboard:

- Go to Supabase Dashboard → Settings → SMTP
- Verify SMTP settings are configured correctly
- Test the SMTP connection

### 4. Test the System

1. Assign assets to a modeler through the production interface
2. Check that notifications appear in the database
3. Verify email sending via Supabase logs

## How It Works

### When an Admin Assigns Assets:

1. Admin assigns assets to modelers via `/production/allocate`
2. API creates asset assignments in database
3. **NEW**: Notification service creates notification records
4. **NEW**: Email service calls Supabase Edge Function
5. **NEW**: Supabase Edge Function sends email via your SMTP settings
6. Modelers receive in-app notifications and emails

### When Production/Admin Approves Assets:

1. Production/admin approves assets via `/admin-review` or `/modeler-review`
2. API updates asset status to "approved"
3. **NEW**: Notification service creates asset completion notification
4. **NEW**: Email service sends approval confirmation email
5. Modelers receive congratulations notification and email

### When Production/Admin Requests Revisions:

1. Production/admin marks assets for revision via `/admin-review` or `/modeler-review`
2. API updates asset status to "revisions"
3. **NEW**: Notification service creates revision notification
4. **NEW**: Email service sends revision request email
5. Modelers receive revision notification and email

### Notification Types Supported:

- `asset_allocation` - New assets assigned
- `asset_completed` - Asset marked as completed
- `deadline_reminder` - Deadline approaching
- `qa_review` - QA review results
- `status_change` - Asset status changes

## Testing

### Test Database Notifications:

```sql
-- Check notifications table
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check unread notifications for a user
SELECT * FROM notifications
WHERE recipient_id = 'user-uuid'
AND read = false
ORDER BY created_at DESC;
```

### Test Email Sending:

- Check Supabase Edge Function logs in dashboard
- Monitor email delivery in your SMTP provider
- Check browser console for any errors

## Next Steps

### Immediate:

1. Deploy the Edge Function
2. Test with real assignments
3. Monitor notification delivery

### Future Enhancements:

1. Add notification preferences page
2. Implement notification templates
3. Add notification analytics
4. Create notification history page
5. Add real-time notifications via WebSocket

## Troubleshooting

### Notifications Not Appearing:

- Check database migration was applied
- Verify RLS policies are working
- Check API error logs

### Emails Not Sending:

- Verify Supabase SMTP configuration
- Check Edge Function logs in Supabase dashboard
- Ensure Edge Function is deployed correctly
- Test SMTP connection in Supabase dashboard

### Performance Issues:

- Monitor notification table size
- Consider archiving old notifications
- Optimize notification queries
