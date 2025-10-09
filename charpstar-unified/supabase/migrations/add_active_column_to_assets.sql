-- Add active column to assets table (matching onboarding_assets)
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS active boolean NULL DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_assets_active 
ON public.assets USING btree (active) 
TABLESPACE pg_default;

-- Update existing assets to be active by default
UPDATE public.assets 
SET active = true 
WHERE active IS NULL;

