# Activity Logging System

This document describes the real-time activity logging system implemented in the Charpstar Unified application.

## Overview

The activity logging system tracks user actions throughout the application and displays them in a live feed on the dashboard. This provides users with real-time visibility into their own activities and, for administrators, visibility into all user activities.

## Features

- **Real-time Activity Feed**: Live updates every 5 seconds with real-time database subscriptions
- **Comprehensive Tracking**: Logs user actions across all major features
- **Rich Metadata**: Stores additional context about each activity
- **Role-based Access**: Users see their own activities, admins see all activities
- **Performance Optimized**: Efficient database queries with proper indexing

## Database Schema

### activity_log Table

```sql
CREATE TABLE activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Activity Types

- `upload` - File uploads
- `create` - Creating new resources
- `update` - Updating existing resources
- `delete` - Deleting resources
- `view` - Viewing pages or resources
- `settings` - Changing settings
- `login` - User login
- `logout` - User logout
- `download` - Downloading files
- `share` - Sharing resources
- `export` - Exporting data
- `import` - Importing data
- `general` - General activities

### Resource Types

- `asset` - 3D assets and files
- `user` - User management
- `project` - Projects
- `analytics` - Analytics pages
- `model` - 3D models
- `material` - Materials
- `texture` - Textures
- `scene` - 3D scenes
- `layout` - Dashboard layouts
- `profile` - User profiles

## API Endpoints

### POST /api/activity/log

Log a new activity.

**Request Body:**

```json
{
  "action": "Uploaded asset: model.glb",
  "description": "User uploaded a new 3D model",
  "type": "upload",
  "resource_type": "asset",
  "resource_id": "uuid-here",
  "metadata": {
    "asset_name": "model.glb",
    "file_size": 1024000
  }
}
```

### GET /api/activity/log

Fetch activities with optional filtering.

**Query Parameters:**

- `limit` - Number of activities to fetch (default: 10)
- `offset` - Pagination offset (default: 0)
- `type` - Filter by activity type
- `resource_type` - Filter by resource type

## Usage

### Basic Activity Logging

```typescript
import { ActivityLogger } from "@/lib/activityLogger";

// Log a simple activity
ActivityLogger.pageViewed("dashboard");

// Log an asset upload
ActivityLogger.assetUploaded("model.glb", "asset-uuid");

// Log a custom activity
ActivityLogger.custom("Exported project to PDF", "export", "project", {
  project_name: "My Project",
  format: "PDF",
});
```

### Using the Activity Hook

```typescript
import { useActivities } from '@/hooks/use-activities';
import { Upload, Plus, Edit, Trash2, Eye, Settings, LogIn, LogOut, Download, Share2, FileDown, FileUp, Activity } from 'lucide-react';

function MyComponent() {
  const { activities, isLoading, error, formatTimeAgo, getActivityIcon } = useActivities({
    limit: 10,
    realtime: true,
    type: 'upload' // Optional filter
  });

  // Helper function to get Lucide React icon component
  const getActivityIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
      Upload,
      Plus,
      Edit,
      Trash2,
      Eye,
      Settings,
      LogIn,
      LogOut,
      Download,
      Share2,
      FileDown,
      FileUp,
      Activity,
    };

    return iconMap[iconName] || Activity;
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading activities</div>;

  return (
    <div>
      {activities.map(activity => (
        <div key={activity.id}>
          {React.createElement(getActivityIconComponent(getActivityIcon(activity.type)), { className: "h-4 w-4" })}
          <span>{activity.action}</span>
          <span>{formatTimeAgo(activity.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
```

## Predefined Activity Loggers

The `ActivityLogger` provides convenient methods for common activities:

### Asset Activities

- `assetUploaded(name, id)` - Log asset uploads
- `assetDeleted(name, id)` - Log asset deletions
- `assetViewed(name, id)` - Log asset views

### User Activities

- `profileUpdated(field)` - Log profile updates
- `avatarChanged()` - Log avatar changes

### Dashboard Activities

- `layoutSaved()` - Log dashboard layout saves
- `layoutLoaded()` - Log dashboard layout loads

### Analytics Activities

- `analyticsViewed(page)` - Log analytics page views

### 3D Editor Activities

- `modelCreated(name, id)` - Log 3D model creation
- `modelSaved(name, id)` - Log 3D model saves

### Settings Activities

- `settingsChanged(setting)` - Log setting changes
- `themeChanged(theme)` - Log theme changes

### Navigation Activities

- `pageViewed(page)` - Log page views

### User Management Activities (Admin)

- `userCreated(email)` - Log user creation
- `userUpdated(email)` - Log user updates
- `userDeleted(email)` - Log user deletion

## Real-time Updates

The activity feed automatically updates every 5 seconds and uses Supabase real-time subscriptions to get instant updates when new activities are logged.

## Security

- Row Level Security (RLS) is enabled on the activity_log table
- Users can only view their own activities
- Admins can view all activities
- All activities are logged with the authenticated user's ID

## Performance Considerations

- Database indexes are created for efficient querying
- Activities are paginated to prevent large data loads
- Real-time subscriptions are properly cleaned up
- Metadata is stored as JSONB for flexible querying

## Setup Instructions

1. Run the database migration:

   ```sql
   -- In Supabase SQL editor
   \i supabase/activity-log.sql
   ```

2. The activity logging system will automatically start tracking user activities

3. The dashboard activity widget will display real-time activities

## Monitoring and Analytics

The activity log can be used for:

- User behavior analytics
- Feature usage tracking
- Audit trails
- Performance monitoring
- User engagement metrics

## Future Enhancements

- Activity filtering and search
- Activity export functionality
- Activity notifications
- Activity analytics dashboard
- Integration with external analytics tools
