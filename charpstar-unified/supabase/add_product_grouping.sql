-- Add product grouping columns to onboarding_assets table
-- This enables automatic grouping and sorting of similar products for production allocation
-- Run this in Supabase SQL Editor

-- Check and add product_group_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'product_group_id'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN product_group_id TEXT;
    END IF;
END $$;

-- Check and add group_order column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'group_order'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN group_order INTEGER;
    END IF;
END $$;

-- Check and add variation attributes columns for production use
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'variation_size'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN variation_size TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'variation_color'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN variation_color TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_assets' 
        AND column_name = 'variation_orientation'
    ) THEN
        ALTER TABLE onboarding_assets ADD COLUMN variation_orientation TEXT;
    END IF;
END $$;

-- Create indexes (these will be skipped if they already exist)
CREATE INDEX IF NOT EXISTS idx_onboarding_assets_product_group_id 
ON onboarding_assets(product_group_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_assets_product_group_order 
ON onboarding_assets(product_group_id, group_order);

-- Create indexes for variation columns
CREATE INDEX IF NOT EXISTS idx_onboarding_assets_variation_size 
ON onboarding_assets(variation_size);

CREATE INDEX IF NOT EXISTS idx_onboarding_assets_variation_color 
ON onboarding_assets(variation_color);

-- Add comments for documentation
COMMENT ON COLUMN onboarding_assets.product_group_id IS 'Group identifier for products that are variations (e.g., "Wardrobe_PARIS", "Corner_Sofa_Bed_MANAMO"). Based on base product name, sanitized for database use. NULL for ungrouped products.';
COMMENT ON COLUMN onboarding_assets.group_order IS 'Order within the product group. Used for sorting variations (e.g., by color, size). 1-based index within each group. NULL for ungrouped products.';
COMMENT ON COLUMN onboarding_assets.variation_size IS 'Size variation value extracted from product name (e.g., "120", "150", "160"). NULL if no size variation.';
COMMENT ON COLUMN onboarding_assets.variation_color IS 'Color variation value extracted from product name (e.g., "White", "Black", "Graphite"). NULL if no color variation.';
COMMENT ON COLUMN onboarding_assets.variation_orientation IS 'Orientation variation value extracted from product name (e.g., "Left", "Right"). NULL if no orientation variation.';

