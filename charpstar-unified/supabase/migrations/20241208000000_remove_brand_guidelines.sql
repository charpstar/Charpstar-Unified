-- Remove brand guidelines functionality

-- Drop the guidelines table
DROP TABLE IF EXISTS guidelines;

-- Remove brand_guidelines_uploaded column from profiles table
ALTER TABLE profiles DROP COLUMN IF EXISTS brand_guidelines_uploaded; 