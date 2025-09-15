-- Create pending_replies table
CREATE TABLE IF NOT EXISTS pending_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES onboarding_assets(id) ON DELETE CASCADE,
  parent_comment_id UUID NOT NULL REFERENCES asset_comments(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pending_replies_status ON pending_replies(status);
CREATE INDEX IF NOT EXISTS idx_pending_replies_created_by ON pending_replies(created_by);
CREATE INDEX IF NOT EXISTS idx_pending_replies_asset_id ON pending_replies(asset_id);
CREATE INDEX IF NOT EXISTS idx_pending_replies_created_at ON pending_replies(created_at);

-- Enable Row Level Security
ALTER TABLE pending_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Admins can see all pending replies
CREATE POLICY "Admins can view all pending replies" ON pending_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Users can see their own pending replies
CREATE POLICY "Users can view their own pending replies" ON pending_replies
  FOR SELECT USING (created_by = auth.uid());

-- Only admins can update pending replies (approve/reject)
CREATE POLICY "Admins can update pending replies" ON pending_replies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only authenticated users can create pending replies
CREATE POLICY "Authenticated users can create pending replies" ON pending_replies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_pending_replies_updated_at
  BEFORE UPDATE ON pending_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_replies_updated_at();
