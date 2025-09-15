# Database Migrations

This directory contains database migration scripts for the Charpstar Unified application.

## Recent Migration: Add CAD File Link Support

### Migration File: `add_cad_file_link_column.sql`

**Purpose**: Adds support for CAD files and other design files in addition to GLB files.

**Changes Made**:

1. Adds `cad_file_link` column to `onboarding_assets` table
2. Creates an index for better query performance
3. Maintains backward compatibility with existing `glb_link` column

**How to Apply**:

#### Option 1: Using Supabase CLI

```bash
# Navigate to the project directory
cd charpstar-unified

# Apply the migration
supabase db push

# Or if you prefer to run it manually
supabase db reset
```

#### Option 2: Manual SQL Execution

1. Connect to your Supabase database (via Dashboard or direct connection)
2. Execute the SQL commands from `add_cad_file_link_column.sql`
3. Verify the column was added: `\d onboarding_assets`

#### Option 3: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `add_cad_file_link_column.sql`
4. Execute the script

### Verification

After applying the migration, verify the changes:

```sql
-- Check if the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'onboarding_assets'
AND column_name = 'cad_file_link';

-- Check the table structure
\d onboarding_assets
```

### Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove the column
ALTER TABLE onboarding_assets DROP COLUMN cad_file_link;

-- Remove the index
DROP INDEX IF EXISTS idx_onboarding_assets_cad_file_link;
```

## Benefits of This Migration

1. **Dual File Support**: Clients can now upload both GLB files and CAD files
2. **Better File Organization**: Clear separation between 3D models and design files
3. **Backward Compatibility**: Existing GLB files continue to work
4. **Performance**: Indexed column for faster queries
5. **Flexibility**: Supports various CAD formats (STEP, IGES, DWG, etc.)

## Impact on Application

- CSV upload now uses `cad_file_link` column
- Existing functionality with `glb_link` remains unchanged
- Preview dialog shows CAD/File links appropriately
- Template updated to reflect new column structure
