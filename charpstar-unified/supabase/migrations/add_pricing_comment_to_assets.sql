-- Add pricing comment column to onboarding_assets table
ALTER TABLE onboarding_assets
ADD COLUMN pricing_comment TEXT;

-- Add index for better performance when filtering by comments
CREATE INDEX idx_onboarding_assets_pricing_comment ON onboarding_assets (pricing_comment) WHERE pricing_comment IS NOT NULL;
