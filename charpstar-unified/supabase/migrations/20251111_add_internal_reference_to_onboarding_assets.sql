-- Add internal_reference column for storing client-private reference assets
ALTER TABLE onboarding_assets
  ADD COLUMN IF NOT EXISTS internal_reference TEXT;

-- Optional: track queries that filter on internal_reference in the future
-- (No index is created now since filtering is not yet required)

