# Database Migrations

This directory contains database migration scripts for the Charpstar Unified application.

## Migration Files

### 1. `add_cad_file_link_column.sql`

- **Purpose**: Adds a `cad_file_link` column to the `onboarding_assets` table
- **Date**: Created when transitioning from GLB-only to CAD/GLB support
- **Description**: Allows clients to upload both GLB files and CAD files (STEP, IGES, DWG, etc.)
- **Status**: Ready for execution

### 2. `create_clients_table.sql`

- **Purpose**: Creates a comprehensive clients management table
- **Date**: Created for centralized client information management
- **Description**: Stores client details, contracts, specifications, and project requirements
- **Status**: Ready for execution

## How to Apply Migrations

### Option 1: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the migration script content
4. Execute the script

### Option 2: Supabase CLI

```bash
# Apply a specific migration
supabase db push --file=supabase/migrations/add_cad_file_link_column.sql

# Apply all migrations
supabase db push
```

## Migration Details

### CAD File Link Migration

- **Table**: `onboarding_assets`
- **New Column**: `cad_file_link` (TEXT)
- **Index**: Created for performance
- **Backward Compatibility**: Existing `glb_link` data preserved

### Clients Table Migration

- **New Table**: `clients`
- **Key Features**:
  - Client contact information
  - Contract types (standard, premium, enterprise, custom)
  - Financial details (contract value, payment terms)
  - Project specifications and requirements
  - Status tracking (active, inactive, pending)
  - Timestamps and audit trail
- **Indexes**: Multiple indexes for optimal query performance
- **Triggers**: Automatic `updated_at` timestamp updates
- **Sample Data**: Includes test data for development

## Important Notes

1. **Backup**: Always backup your database before running migrations
2. **Testing**: Test migrations in a development environment first
3. **Dependencies**: Some migrations may depend on others - check the order
4. **Rollback**: Plan for rollback scenarios if needed

## Post-Migration Steps

### After CAD File Link Migration

- Update your application code to use the new `cad_file_link` column
- Consider migrating existing GLB links to the new column if desired
- Update CSV templates and documentation

### After Clients Table Migration

- Access the new `/admin/clients` page in your application
- Add your existing client information to the new system
- Update team workflows to use the centralized client management
- Remove old client specification fields from other parts of the application

## Support

If you encounter issues with migrations:

1. Check the Supabase logs for error details
2. Verify your database user has the necessary permissions
3. Ensure the migration script syntax is correct for your PostgreSQL version
4. Contact the development team for assistance
