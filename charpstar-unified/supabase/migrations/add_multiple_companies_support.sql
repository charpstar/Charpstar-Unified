-- Migration: Support multiple companies per client
-- This migration changes the client column from text to text[] to allow multiple companies

-- Step 1: Create backup table
CREATE TABLE IF NOT EXISTS profiles_backup_before_multi_client AS 
SELECT * FROM profiles;

-- Step 2: Add a new temporary column as text array
ALTER TABLE public.profiles 
ADD COLUMN client_new text[] NULL;

-- Step 3: Migrate existing data (convert single client value to array)
UPDATE public.profiles 
SET client_new = CASE 
  WHEN client IS NULL THEN NULL
  WHEN client = '' THEN NULL
  ELSE ARRAY[client]
END;

-- Step 4: Drop the old column with CASCADE to remove dependent policies
-- This will drop all RLS policies that depend on the client column
ALTER TABLE public.profiles DROP COLUMN client CASCADE;

-- Step 5: Rename new column to client
ALTER TABLE public.profiles RENAME COLUMN client_new TO client;

-- Step 6: Add index for better query performance on array column
CREATE INDEX IF NOT EXISTS idx_profiles_client_gin 
ON public.profiles USING gin (client);

-- Step 7: Recreate RLS policies with array-aware logic

-- Policy: Users can view comments for assets they have access to
DROP POLICY IF EXISTS "Users can view comments for assets they have access to" ON asset_comments;
CREATE POLICY "Users can view comments for assets they have access to" 
ON asset_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_comments.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view annotations for their client assets or admins can view all
DROP POLICY IF EXISTS "Users can view annotations for their client assets or admins ca" ON asset_annotations;
CREATE POLICY "Users can view annotations for their client assets or admins ca" 
ON asset_annotations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_annotations.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can create annotations for their client assets or admins
DROP POLICY IF EXISTS "Users can create annotations for their client assets or admins " ON asset_annotations;
CREATE POLICY "Users can create annotations for their client assets or admins " 
ON asset_annotations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_annotations.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view comments for their client assets or admins can view all
DROP POLICY IF EXISTS "Users can view comments for their client assets or admins can v" ON asset_comments;
CREATE POLICY "Users can view comments for their client assets or admins can v" 
ON asset_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_comments.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can create comments for their client assets or admins can
DROP POLICY IF EXISTS "Users can create comments for their client assets or admins can" ON asset_comments;
CREATE POLICY "Users can create comments for their client assets or admins can" 
ON asset_comments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_comments.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view asset files for their assets
DROP POLICY IF EXISTS "Users can view asset files for their assets" ON asset_files;
CREATE POLICY "Users can view asset files for their assets" 
ON asset_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_files.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can upload files for their assets
DROP POLICY IF EXISTS "Users can upload files for their assets" ON asset_files;
CREATE POLICY "Users can upload files for their assets" 
ON asset_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = asset_files.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view automated QA results for their assets
DROP POLICY IF EXISTS "Users can view automated QA results for their assets" ON automated_qa_results;
CREATE POLICY "Users can view automated QA results for their assets" 
ON automated_qa_results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    JOIN onboarding_assets ON onboarding_assets.client = ANY(profiles.client)
    WHERE profiles.id = auth.uid()
    AND onboarding_assets.id = automated_qa_results.asset_id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Note: The client column is now text[] and can store multiple companies like:
-- ARRAY['Carpet shop', 'coop']
-- The backup table is: profiles_backup_before_multi_client

