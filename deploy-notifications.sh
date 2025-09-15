#!/bin/bash

echo "🚀 Deploying Notification System..."

# Run database migration
echo "📊 Running database migration..."
supabase db push

# Deploy the email Edge Function
echo "📧 Deploying email Edge Function..."
supabase functions deploy send-email

echo "✅ Notification system deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Verify SMTP settings in Supabase Dashboard → Settings → SMTP"
echo "2. Test the system by assigning assets to a modeler"
echo "3. Check notifications in the database and email delivery"
echo ""
echo "🔍 To monitor:"
echo "- Check Supabase Edge Function logs in dashboard"
echo "- Monitor email delivery in your SMTP provider"
echo "- Test notification bell in the app" 