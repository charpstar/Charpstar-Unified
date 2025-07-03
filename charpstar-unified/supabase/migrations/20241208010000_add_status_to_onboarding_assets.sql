-- Update onboarding_asset_status enum and set all to not_started
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_asset_status') THEN
    ALTER TYPE onboarding_asset_status RENAME TO onboarding_asset_status_old;
    CREATE TYPE onboarding_asset_status AS ENUM ('not_started', 'in_production', 'revisions', 'approved', 'delivered_by_artist');
    ALTER TABLE onboarding_assets ALTER COLUMN status TYPE onboarding_asset_status USING status::text::onboarding_asset_status;
    DROP TYPE onboarding_asset_status_old;
  ELSE
    CREATE TYPE onboarding_asset_status AS ENUM ('not_started', 'in_production', 'revisions', 'approved', 'delivered_by_artist');
  END IF;
END$$;

ALTER TABLE onboarding_assets ALTER COLUMN status SET DEFAULT 'not_started';
UPDATE onboarding_assets SET status = 'not_started';

-- Add comment
COMMENT ON COLUMN onboarding_assets.status IS 'Status of the asset in the onboarding workflow'; 