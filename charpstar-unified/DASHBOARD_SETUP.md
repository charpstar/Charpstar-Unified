# Dashboard Layout System Setup

## Overview

The dashboard now supports drag-and-drop customization with persistent layouts stored in Supabase. Users can:

- Drag and drop widgets to reorder them
- Show/hide individual widgets
- Save layouts that persist across devices and sessions
- Load previously saved layouts
- Reset to default layout

## Database Setup

### 1. Create the Dashboard Layouts Table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create dashboard_layouts table for storing user dashboard layouts
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layout_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id ON dashboard_layouts(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own layouts
CREATE POLICY "Users can view their own dashboard layouts" ON dashboard_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard layouts" ON dashboard_layouts
  FOR INSERT WITH CHECK (auth.uid() = user.id);

CREATE POLICY "Users can update their own dashboard layouts" ON dashboard_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard layouts" ON dashboard_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. Alternative: Use the SQL File

You can also run the SQL file directly:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/dashboard-layouts.sql`
4. Click "Run" to execute

## Features

### Widget Types

- **Profile Widget**: User avatar, info, theme switcher
- **Quick Actions**: Fast access to main features
- **Stats Widgets**: Display metrics and counts
- **Activity Widget**: Recent user activity feed
- **Performance Widget**: Progress bars and goals
- **Calendar Widget**: Upcoming events
- **System Status Widget**: Service uptime indicators

### Widget Sizes

- **Small**: 1x1 grid space
- **Medium**: 2x1 grid space
- **Large**: 2x2 grid space

### User Experience

1. **Toggle Edit Mode**: Switch between view and edit modes
2. **Drag & Drop**: Reorder widgets by dragging them
3. **Widget Controls**: Hide/show individual widgets
4. **Save Layout**: Persist your custom arrangement to the cloud
5. **Load Layout**: Restore previously saved layouts
6. **Reset**: Return to default layout

## Technical Details

### Data Structure

Each layout is stored as JSONB with the following structure:

```json
[
  {
    "id": "widget-id",
    "title": "Widget Title",
    "type": "stats|chart|actions|profile|custom",
    "size": "small|medium|large",
    "position": { "x": 0, "y": 0 },
    "visible": true
  }
]
```

### Security

- Row Level Security (RLS) enabled
- Users can only access their own layouts
- Automatic cleanup when user accounts are deleted

### API Endpoints

- `GET /api/dashboard/layout` - Load user's saved layout
- `POST /api/dashboard/layout` - Save user's layout
- `DELETE /api/dashboard/layout` - Delete user's saved layout

## Troubleshooting

### Common Issues

1. **"Not logged in" error**: User must be authenticated to save layouts
2. **Layout not loading**: Check if the database table exists and RLS policies are set
3. **Save fails**: Verify user has proper permissions and table structure

### Debug Mode

The component includes console logging for debugging:

- Widget state changes
- Save/load operations
- Drag and drop events

## Future Enhancements

- Widget resizing capabilities
- Layout templates/presets
- Export/import functionality
- Widget configuration options
- Multi-device sync improvements
