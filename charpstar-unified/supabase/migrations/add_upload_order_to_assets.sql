-- Add upload_order column to onboarding_assets table
ALTER TABLE onboarding_assets 
ADD COLUMN upload_order INTEGER;

-- Create an index for better performance when sorting by upload_order
CREATE INDEX idx_onboarding_assets_upload_order ON onboarding_assets(upload_order);

-- Update existing records to have upload_order based on created_at
-- This ensures existing data has a reasonable order
UPDATE onboarding_assets 
SET upload_order = EXTRACT(EPOCH FROM created_at)::INTEGER
WHERE upload_order IS NULL;
