-- Add onboarding progress tracking columns to profiles table
ALTER TABLE profiles 
ADD COLUMN csv_uploaded BOOLEAN DEFAULT FALSE,
ADD COLUMN reference_images_uploaded BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.csv_uploaded IS 'Whether the user has completed CSV upload step';
COMMENT ON COLUMN profiles.reference_images_uploaded IS 'Whether the user has completed reference images upload step';

-- Create a function to automatically update onboarding status when all steps are complete
CREATE OR REPLACE FUNCTION update_onboarding_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If all onboarding steps are complete, set onboarding to false
  IF NEW.csv_uploaded = TRUE AND 
     NEW.reference_images_uploaded = TRUE AND
     NEW.onboarding = TRUE THEN
    NEW.onboarding = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update onboarding status
CREATE TRIGGER trigger_update_onboarding_status
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_status(); 