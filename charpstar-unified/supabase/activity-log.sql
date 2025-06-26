-- Create activity_log table for tracking user activities
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Reference profiles table instead of auth.users
  user_email VARCHAR(255), -- Store email directly in the table
  action VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'upload', 'create', 'update', 'delete', 'view', 'settings', etc.
  resource_type VARCHAR(50), -- 'asset', 'user', 'project', 'analytics', etc.
  resource_id UUID, -- ID of the affected resource
  metadata JSONB, -- Additional data about the activity
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource_type ON activity_log(resource_type);

-- Enable Row Level Security
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own activities" ON activity_log;
DROP POLICY IF EXISTS "Users can insert own activities" ON activity_log;
DROP POLICY IF EXISTS "Admins can view all activities" ON activity_log;

-- Create policies for custom user management
-- Users can view their own activities
CREATE POLICY "Users can view own activities" ON activity_log
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can insert their own activities
CREATE POLICY "Users can insert own activities" ON activity_log
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admins can view all activities (using custom profiles table)
CREATE POLICY "Admins can view all activities" ON activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create a function to log activities
CREATE OR REPLACE FUNCTION log_activity(
  p_action VARCHAR(255),
  p_description TEXT DEFAULT NULL,
  p_type VARCHAR(50) DEFAULT 'general',
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the user's profile ID
  SELECT id INTO v_user_id FROM profiles WHERE id = auth.uid();
  
  INSERT INTO activity_log (
    user_id,
    action,
    description,
    type,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_user_id,
    p_action,
    p_description,
    p_type,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_activity TO authenticated;

-- Drop the existing view if it exists
DROP VIEW IF EXISTS recent_activities;

-- Create a view for recent activities with user information
-- This view will respect RLS policies automatically
CREATE VIEW recent_activities AS
SELECT 
  al.id,
  al.action,
  al.description,
  al.type,
  al.resource_type,
  al.resource_id,
  al.metadata,
  al.created_at,
  al.user_id,
  COALESCE(al.user_email, au.email) as user_email, -- Use stored email or fallback to auth.users
  p.role as user_role
FROM activity_log al
LEFT JOIN profiles p ON al.user_id = p.id
LEFT JOIN auth.users au ON p.id = au.id -- Join through profiles to get auth.users email
ORDER BY al.created_at DESC;

-- Grant select permission on the view
GRANT SELECT ON recent_activities TO authenticated;

-- Add some debugging information
COMMENT ON TABLE activity_log IS 'Activity log table for tracking user actions';
COMMENT ON VIEW recent_activities IS 'View for displaying recent activities with user information';

-- Add user_email column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'activity_log' AND column_name = 'user_email'
    ) THEN
        ALTER TABLE activity_log ADD COLUMN user_email VARCHAR(255);
    END IF;
END $$; 