# Monthly Invoice Deadline Reminders

This system automatically sends notifications to modelers on the 28th of each month reminding them to submit their invoices for completed work.

## How It Works

1. **Automatic Detection**: The system checks if today is the 28th of the month
2. **Modeler Lookup**: Finds all active modelers in the system
3. **Earnings Calculation**: Calculates total earnings for each modeler for the current month
4. **Notification Sending**: Sends personalized reminders with earnings details

## Setup Instructions

### 1. Cron Job Configuration

Set up a cron job to run daily and check for the 28th:

```bash
# Run every day at 9:00 AM UTC
0 9 * * * curl -X POST https://your-domain.com/api/notifications/invoice-deadline-reminders
```

### 2. Alternative: Vercel Cron Jobs

If using Vercel, add this to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/invoice-deadline-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 3. Manual Testing

You can test the system manually by calling the API endpoint:

```bash
curl -X POST https://your-domain.com/api/notifications/invoice-deadline-reminders
```

## Notification Details

Each modeler receives a notification containing:

- Total earnings for the month
- Number of completed assets
- Number of clients worked with
- Month and year
- Reminder to submit invoice by month end

## Example Notification

```
Title: Monthly Invoice Deadline Reminder
Message: Invoice deadline reminder: You have completed work worth €2,450.00 in December 2024 (15 assets across 3 clients). Please submit your invoice by the end of the month.
```

## Database Requirements

The system queries the following tables:

- `profiles` - to find modelers
- `asset_assignments` - to find completed work
- `onboarding_assets` - to get asset details and status

## Security

- Add API key authentication for production use
- Uncomment the authentication check in the API route
- Set `CRON_SECRET` environment variable

## Troubleshooting

- Check server logs for error messages
- Verify database connections
- Ensure modelers have completed work in the current month
- Check notification delivery settings
