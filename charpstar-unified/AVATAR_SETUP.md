# Avatar Feature Setup

This document explains how to set up the avatar/profile picture feature for the CharpstAR platform.

## Features

- **Custom Avatar Upload**: Users can upload their own profile pictures (JPG, PNG, GIF, WebP up to 5MB)
- **Preset Avatars**: Users can choose from 8 preset avatar options with different icons and colors
- **Avatar Management**: Users can remove their avatar to revert to initials
- **Cross-Platform**: Avatars are available in both the dashboard and settings dialog

## Setup Instructions

### 1. Database Setup

Run the SQL script to create the avatar storage bucket and add the avatar_url column:

```sql
-- Execute the contents of supabase/setup-avatar-storage.sql
```

This will:

- Create an 'avatars' storage bucket with 5MB file size limit
- Set up Row Level Security (RLS) policies for avatar access
- Add avatar_url column to the profiles table

### 2. Supabase Storage Configuration

1. Go to your Supabase dashboard
2. Navigate to Storage > Buckets
3. Verify the 'avatars' bucket exists
4. Check that the bucket is public and has the correct policies

### 3. Environment Variables

Ensure your Supabase environment variables are properly configured in your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### For Users

1. **Dashboard**: Click on the avatar in the User Profile card to open the avatar picker
2. **Settings**: Go to Settings > Account tab and use the Profile Picture section

### Avatar Options

- **Upload Custom**: Click "Choose File" to upload your own image
- **Preset Avatars**: Choose from 8 preset options (Default, Team, Premium, Star, Heart, Zap, Target, Palette)
- **Remove Avatar**: Click "Remove Avatar" to revert to email initials

### File Requirements

- **Supported formats**: JPG, PNG, GIF, WebP
- **Maximum size**: 5MB
- **Recommended dimensions**: 200x200 pixels or larger (will be automatically resized)

## Technical Implementation

### Components

- `AvatarPicker`: Main component for avatar selection and upload
- `Avatar`: Display component with fallback to initials
- API routes: `/api/users/avatar` for avatar management

### Storage Structure

Avatars are stored in Supabase Storage with the following naming convention:

```
avatars/{user_id}-{timestamp}.{extension}
```

### Security

- Users can only upload/update/delete their own avatars
- Avatars are publicly viewable for display purposes
- File type and size validation on both client and server

## Troubleshooting

### Common Issues

1. **Upload fails**: Check file size and format
2. **Avatar not displaying**: Verify storage bucket permissions
3. **Permission errors**: Ensure RLS policies are correctly configured

### Debug Steps

1. Check browser console for upload errors
2. Verify Supabase storage bucket exists and is public
3. Confirm avatar_url column exists in profiles table
4. Test API endpoint `/api/users/avatar` directly

## Future Enhancements

Potential improvements for the avatar feature:

- Image cropping and editing
- Avatar templates/themes
- Bulk avatar import for teams
- Avatar analytics (usage statistics)
- Integration with external avatar services (Gravatar, etc.)
