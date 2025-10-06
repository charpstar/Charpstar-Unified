# Email Notification System

A comprehensive email notification system for the CharpstAR 3D model production pipeline, built with Resend and React email templates.

## Features

### Email Types

- **New Model Ready for Review** - Notifies clients when a model is ready for their review
- **Weekly Status Summary** - Weekly progress reports for clients
- **Batch Completion Notifications** - Alerts when entire batches are completed
- **Stale Model Reminders** - Smart triggers for models pending 7+ days

### Smart Triggers

- **Stale Model Detection** - Automatically identifies models that need attention
- **Batch Completion Detection** - Monitors batch progress and sends completion notifications
- **Weekly Summary Scheduling** - Sends weekly reports every Monday

## Development Mode

**IMPORTANT**: The system is currently in development mode and will NOT send actual emails. Instead, it logs what would be sent to the console.

### Environment Variables

```bash
# Required for production
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@mail.charpstar.co

# Optional - force development mode
EMAIL_DEV_MODE=true

# Required for proper links in emails
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Enabling Production Emails

To enable actual email sending:

1. Set `NODE_ENV=production` or remove `EMAIL_DEV_MODE=true`
2. Ensure `RESEND_API_KEY` is properly configured
3. Verify `EMAIL_FROM` domain is verified in Resend

## API Endpoints

### Individual Email Types

#### New Model Ready for Review

```bash
POST /api/email/model-ready-for-review
{
  "clientEmail": "client@example.com",
  "clientName": "Client Name",
  "modelName": "Model Name",
  "modelerName": "Modeler Name",
  "reviewLink": "https://app.com/review/123",
  "batch": 1,
  "deadline": "2024-01-15T00:00:00Z"
}
```

#### Weekly Status Summary

```bash
POST /api/email/weekly-status-summary
{
  "clientEmail": "client@example.com",
  "clientName": "Client Name",
  "weekRange": "Week of January 8, 2024"
}
```

#### Batch Completion

```bash
POST /api/email/batch-completion
{
  "clientEmail": "client@example.com",
  "clientName": "Client Name",
  "batchNumber": 1
}
```

#### Stale Model Reminder

```bash
POST /api/email/stale-model-reminder
{
  "clientEmail": "client@example.com",
  "clientName": "Client Name",
  "daysThreshold": 7
}
```

### Scheduled Reports

#### All Reports

```bash
POST /api/email/scheduled-reports
{
  "reportType": "all-reports"
}
```

#### Specific Report Type

```bash
POST /api/email/scheduled-reports
{
  "reportType": "weekly-summary",
  "clientEmail": "client@example.com",
  "clientName": "Client Name"
}
```

### Smart Triggers

#### All Triggers

```bash
POST /api/email/smart-triggers
{
  "triggerType": "all-triggers"
}
```

#### Specific Trigger

```bash
POST /api/email/smart-triggers
{
  "triggerType": "stale-models",
  "options": {
    "daysThreshold": 7
  }
}
```

### Testing

#### Test Email Service

```bash
POST /api/email/test
{
  "testEmail": "test@example.com",
  "testType": "all"
}
```

Available test types:

- `simple` - Basic email test
- `model-ready` - Model ready for review template
- `weekly-summary` - Weekly status summary template
- `batch-completion` - Batch completion template
- `stale-models` - Stale model reminder template
- `all` - Test all templates

## Cron Job Setup

### Weekly Summary (Every Monday)

```bash
0 9 * * 1 curl -X POST https://your-domain.com/api/email/smart-triggers \
  -H "Content-Type: application/json" \
  -d '{"triggerType": "weekly-summary-trigger"}'
```

### Stale Model Check (Daily)

```bash
0 10 * * * curl -X POST https://your-domain.com/api/api/email/smart-triggers \
  -H "Content-Type: application/json" \
  -d '{"triggerType": "stale-models", "options": {"daysThreshold": 7}}'
```

### Batch Completion Check (Daily)

```bash
0 11 * * * curl -X POST https://your-domain.com/api/email/smart-triggers \
  -H "Content-Type: application/json" \
  -d '{"triggerType": "batch-completion-check"}'
```

### All Reports (Weekly)

```bash
0 12 * * 1 curl -X POST https://your-domain.com/api/email/scheduled-reports \
  -H "Content-Type: application/json" \
  -d '{"reportType": "all-reports"}'
```

## Integration with Existing System

The email system integrates with your existing notification service:

```typescript
import { emailService } from "@/lib/emailService";

// Send model ready for review email
await emailService.sendModelReadyForReview(data, config);

// Send weekly status summary
await emailService.sendWeeklyStatusSummary(data, config);

// Send batch completion notification
await emailService.sendBatchCompletion(data, config);

// Send stale model reminder
await emailService.sendStaleModelReminder(data, config);
```

## Email Templates

All email templates are built with React and styled with inline CSS for maximum compatibility:

- `ModelReadyForReviewEmail.tsx` - New model ready for review
- `WeeklyStatusSummaryEmail.tsx` - Weekly status summary
- `BatchCompletionEmail.tsx` - Batch completion notification
- `StaleModelReminderEmail.tsx` - Stale model reminder

## Development vs Production

### Development Mode

- Emails are logged to console instead of being sent
- All API calls return success with simulated message IDs
- Perfect for testing and development

### Production Mode

- Emails are actually sent via Resend
- Real message IDs are returned
- Full error handling and logging

## Monitoring

The system provides comprehensive logging:

- Email send attempts and results
- Development mode notifications
- Error handling and fallbacks
- Success/failure tracking

## Security

- All API endpoints validate required fields
- Email addresses are validated
- Rate limiting can be added if needed
- No sensitive data is logged

## Troubleshooting

### Common Issues

1. **Emails not sending in production**

   - Check `RESEND_API_KEY` is set
   - Verify `EMAIL_FROM` domain is verified in Resend
   - Ensure `NODE_ENV=production` or remove `EMAIL_DEV_MODE=true`

2. **Development mode not working**

   - Set `EMAIL_DEV_MODE=true` or ensure `NODE_ENV=development`
   - Check console logs for "🚧 DEVELOPMENT MODE" messages

3. **Template rendering issues**
   - Ensure all required props are provided
   - Check React component imports
   - Verify email template syntax

### Testing

Use the test endpoint to verify email functionality:

```bash
curl -X POST https://your-domain.com/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@example.com", "testType": "all"}'
```

This will test all email templates and show you exactly what would be sent.
