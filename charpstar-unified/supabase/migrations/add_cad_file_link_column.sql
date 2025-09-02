-- Migration: Add cad_file_link column to onboarding_assets table
-- This allows clients to upload both GLB files and CAD files

-- Add the new column
ALTER TABLE onboarding_assets 
ADD COLUMN cad_file_link TEXT;

-- Add a comment to document the column purpose
COMMENT ON COLUMN onboarding_assets.cad_file_link IS 'Link to CAD file or other design file (STEP, IGES, DWG, etc.)';

-- Create an index on the new column for better query performance
CREATE INDEX idx_onboarding_assets_cad_file_link ON onboarding_assets(cad_file_link);

-- Update existing rows to set cad_file_link to NULL (they will keep their existing glb_link)
-- This ensures backward compatibility
UPDATE onboarding_assets 
SET cad_file_link = NULL 
WHERE cad_file_link IS NULL;
