-- Add AI-suggested pricing columns to onboarding_assets table
-- These columns store AI-generated pricing suggestions that don't overwrite manually set prices
-- Run this in Supabase SQL Editor

-- Check and add suggested_pricing_option_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'suggested_pricing_option_id'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN suggested_pricing_option_id TEXT;
    END IF;
END $$;

-- Check and add suggested_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'suggested_price'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN suggested_price NUMERIC(10, 2);
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN onboarding_assets.suggested_pricing_option_id IS 'AI-suggested pricing option ID based on product grouping and variations (e.g., "pbr_3d_model_after_second", "additional_colors_after_second"). NULL if no suggestion. Does not overwrite manually set pricing_option_id.';
COMMENT ON COLUMN onboarding_assets.suggested_price IS 'AI-suggested price in euros based on product grouping and variations. Does not overwrite manually set price. NULL if no suggestion.';





