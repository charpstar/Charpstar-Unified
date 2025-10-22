-- Create render_jobs table for storing product render jobs
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  products JSONB,
  settings JSONB,
  glb_urls TEXT[],
  download_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON public.render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON public.render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_created_at ON public.render_jobs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own jobs
CREATE POLICY "Users can view their own render jobs"
  ON public.render_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own render jobs"
  ON public.render_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs
CREATE POLICY "Users can update their own render jobs"
  ON public.render_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for the render client)
CREATE POLICY "Service role can manage all render jobs"
  ON public.render_jobs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_render_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' OR NEW.status = 'failed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_render_jobs_updated_at_trigger
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_render_jobs_updated_at();

-- Grant permissions
GRANT ALL ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;

