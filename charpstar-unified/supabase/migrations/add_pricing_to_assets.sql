-- Add pricing columns to onboarding_assets table
ALTER TABLE onboarding_assets 
ADD COLUMN pricing_option_id TEXT,
ADD COLUMN price DECIMAL(10,2) DEFAULT 0;

-- Create an index for better performance when filtering by pricing
CREATE INDEX idx_onboarding_assets_pricing_option ON onboarding_assets(pricing_option_id);

-- Add a comment to document the pricing_option_id values
COMMENT ON COLUMN onboarding_assets.pricing_option_id IS 'Pricing option ID from the predefined pricing structure (e.g., pbr_3d_model_first, hard_3d_model_after_second, etc.)';
COMMENT ON COLUMN onboarding_assets.price IS 'Price in euros for this asset based on the selected pricing option';
