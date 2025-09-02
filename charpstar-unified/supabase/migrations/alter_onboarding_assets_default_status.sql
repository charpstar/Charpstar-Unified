-- Set default status to 'not_started' for new onboarding_assets rows
ALTER TABLE onboarding_assets
ALTER COLUMN status SET DEFAULT 'not_started';

COMMENT ON COLUMN onboarding_assets.status IS 'Workflow status. Defaults to not_started for new assets.';

