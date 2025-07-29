-- Create qa_approvals table
CREATE TABLE IF NOT EXISTS public.qa_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  qa_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  approved_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qa_approvals_pkey PRIMARY KEY (id),
  CONSTRAINT qa_approvals_qa_id_fkey FOREIGN KEY (qa_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT qa_approvals_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES onboarding_assets (id) ON DELETE CASCADE,
  CONSTRAINT qa_approvals_unique_qa_asset UNIQUE (qa_id, asset_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_qa_approvals_qa_id ON public.qa_approvals (qa_id);
CREATE INDEX IF NOT EXISTS idx_qa_approvals_asset_id ON public.qa_approvals (asset_id);
CREATE INDEX IF NOT EXISTS idx_qa_approvals_approved_at ON public.qa_approvals (approved_at);
CREATE INDEX IF NOT EXISTS idx_qa_approvals_created_at ON public.qa_approvals (created_at);

-- Add RLS policies
ALTER TABLE public.qa_approvals ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage all QA approvals
CREATE POLICY "Admins can manage all QA approvals" ON public.qa_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy for QA users to view their own approvals
CREATE POLICY "QA users can view their own approvals" ON public.qa_approvals
  FOR SELECT USING (qa_id = auth.uid());

-- Policy for QA users to insert their own approvals
CREATE POLICY "QA users can insert their own approvals" ON public.qa_approvals
  FOR INSERT WITH CHECK (qa_id = auth.uid());

-- Policy for production users to view QA approvals
CREATE POLICY "Production users can view QA approvals" ON public.qa_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'production'
    )
  ); 