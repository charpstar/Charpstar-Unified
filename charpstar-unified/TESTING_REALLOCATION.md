# Testing Model Re-Allocation and File Download Functionality

## Overview

This guide explains how to test the new functionality that allows modelers to download files from previous modelers after asset re-allocation.

## What Was Implemented

### 1. Admin Allocation Page

- **Location**: `/production/allocate`
- **Functionality**: Shows previous modeler files during re-allocation
- **Files Available**: GLB files, reference images, additional files

### 2. Modeler My Assignments Page

- **Location**: `/my-assignments`
- **Functionality**: Shows previous modeler files for re-allocated assets
- **Files Available**: All files from previous modelers

### 3. Modeler Batch Detail Page

- **Location**: `/my-assignments/[client]/[batch]`
- **Functionality**: Shows previous modeler files for specific batch
- **Files Available**: All files from previous modelers

## How to Test

### Prerequisites

1. **Admin Account**: Required to re-allocate assets
2. **Multiple Modeler Accounts**: At least 2 modelers needed
3. **Assets with Files**: Assets that have been worked on by previous modelers

### Step 1: Create Test Data

1. **Upload Assets**: Use the asset library to upload some test assets
2. **Assign to Modeler A**: Allocate assets to the first modeler
3. **Upload Files**: Have Modeler A upload GLB files, reference images, etc.
4. **Complete Work**: Mark assets as completed or in progress

### Step 2: Re-Allocate Assets

1. **Go to Production Page**: Navigate to `/production`
2. **Select Assets**: Choose assets to re-allocate
3. **Click "Allocate"**: This will take you to the allocation page
4. **Choose New Modeler**: Select a different modeler (Modeler B)
5. **Set Pricing**: Configure pricing and deadline
6. **Click "Allocate & Notify"**: Complete the re-allocation

### Step 3: Verify Admin Can See Files

During allocation, you should see:

- **Previous Modeler Files Available** section
- List of assets with downloadable files
- Download buttons for GLB, reference images, and other files

### Step 4: Test Modeler Access

1. **Login as New Modeler**: Use Modeler B's account
2. **Go to My Assignments**: Navigate to `/my-assignments`
3. **Check for Files**: Look for "Previous Modeler Files Available" section
4. **Download Files**: Test download functionality for various file types

### Step 5: Test Batch-Specific Access

1. **Navigate to Batch**: Go to `/my-assignments/[client]/[batch]`
2. **Verify Files**: Check that previous modeler files are visible
3. **Test Downloads**: Ensure all file types can be downloaded

## Expected Behavior

### ✅ What Should Work

- **File Detection**: Automatically detects files from previous modelers
- **Download Buttons**: Functional download buttons for all file types
- **File Organization**: Files grouped by asset with clear labels
- **Previous Modeler Info**: Shows who previously worked on each asset

### ❌ What Should Not Happen

- **Missing Files**: Files should not disappear after re-allocation
- **Access Denied**: New modeler should have full access to previous files
- **Broken Downloads**: Download links should work for all file types

## File Types Supported

### 1. GLB Files

- **Source**: `onboarding_assets.glb_link`
- **Download**: Direct download with descriptive filename
- **Format**: `{product_name}-{article_id}.glb`

### 2. Reference Images

- **Source**: `onboarding_assets.reference` array
- **Download**: Individual reference images
- **Format**: `ref-{index}.png`

### 3. Additional Files

- **Source**: `asset_files` table, `glb_upload_history`, `product_link`
- **Download**: All additional files with original names
- **Format**: Original filename preserved

## Troubleshooting

### Common Issues

#### 1. Files Not Showing

- **Check**: Database tables exist (`asset_files`, `glb_upload_history`)
- **Verify**: Assets have actual file data
- **Debug**: Check browser console for errors

#### 2. Download Not Working

- **Check**: File URLs are accessible
- **Verify**: CORS settings allow downloads
- **Test**: Try opening URL in new tab

#### 3. Previous Modeler Info Missing

- **Check**: `profiles` table has user data
- **Verify**: Assignment history exists
- **Debug**: Check database queries

### Debug Steps

1. **Browser Console**: Check for JavaScript errors
2. **Network Tab**: Verify API calls are successful
3. **Database**: Query tables directly to verify data
4. **Permissions**: Ensure user has access to required tables

## Database Tables Required

### Core Tables

- `asset_assignments` - Tracks asset assignments
- `onboarding_assets` - Asset metadata and file links
- `profiles` - User information

### Optional Tables (for enhanced functionality)

- `asset_files` - Additional file metadata
- `glb_upload_history` - GLB file version history

## Security Considerations

### Access Control

- **Modelers**: Can only see files for their assigned assets
- **Admins**: Can see all files during allocation
- **File URLs**: Should be properly secured and accessible

### Data Privacy

- **Previous Modeler Info**: Only shows name/email, not sensitive data
- **File Access**: Limited to necessary file downloads
- **Audit Trail**: Assignment history is preserved

## Future Enhancements

### Potential Improvements

1. **File Preview**: Thumbnail previews for images
2. **Version History**: Track file changes over time
3. **Bulk Download**: Download all files for an asset at once
4. **File Organization**: Better categorization of file types
5. **Progress Tracking**: Show download progress for large files

## Support

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review console logs** for error messages
3. **Verify database structure** matches requirements
4. **Test with simple data** to isolate issues
