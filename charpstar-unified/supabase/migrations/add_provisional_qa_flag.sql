-- Add provisional QA flag to asset_assignments table
-- This will help distinguish between regular QA assignments and provisional QA assignments

ALTER TABLE asset_assignments 
ADD COLUMN is_provisional BOOLEAN DEFAULT FALSE;

-- Update the comment to reflect the new column
COMMENT ON COLUMN asset_assignments.is_provisional IS 'Flag to indicate if this is a provisional QA assignment that overrides the regular QA allocation';

-- Create an index for better performance when querying provisional assignments
CREATE INDEX IF NOT EXISTS idx_asset_assignments_provisional 
ON asset_assignments(user_id, role, is_provisional) 
WHERE role = 'qa';
