# Time Override Testing Guide

This feature allows you to test time-dependent functionality by simulating future dates. It's perfect for testing deadlines, scheduled events, or any feature that depends on the current date/time.

## How to Use (Simple Method)

### Step 1: Add the Test Parameter
Add `?testTime=YYYY-MM-DD` to any URL in your browser.

### Step 2: Examples

**Test Christmas 2024:**
```
http://localhost:3000/dashboard?testTime=2024-12-25
```

**Test New Year 2025:**
```
http://localhost:3000/dashboard?testTime=2025-01-01
```

**Test specific time (December 25, 2024 at 3:30 PM):**
```
http://localhost:3000/dashboard?testTime=2024-12-25T15:30:00
```

**Test any page:**
```
http://localhost:3000/analytics?testTime=2024-12-25
http://localhost:3000/production?testTime=2024-12-25
```

### Step 3: Visual Confirmation
When time override is active, you'll see a yellow "TEST MODE" indicator in the top-right corner showing the simulated date/time.

### Step 4: Return to Normal
- Click the "X" button on the test mode indicator, OR
- Remove the `?testTime=...` part from the URL and refresh

## Date Format Options

- **Date only**: `2024-12-25`
- **Date and time**: `2024-12-25T15:30:00`
- **Date and time with timezone**: `2024-12-25T15:30:00Z`

## Safety Features

- ✅ Only works in development mode
- ✅ Won't affect production builds
- ✅ Easy to turn on/off
- ✅ Visual indicator when active
- ✅ No permanent changes to data

## Troubleshooting

**Not working?**
- Make sure you're in development mode (`npm run dev`)
- Check that the date format is correct
- Try refreshing the page after adding the parameter

**Date format examples:**
- ✅ `2024-12-25`
- ✅ `2024-12-25T15:30`
- ✅ `2024-12-25T15:30:00`
- ❌ `12/25/2024`
- ❌ `25-12-2024`
