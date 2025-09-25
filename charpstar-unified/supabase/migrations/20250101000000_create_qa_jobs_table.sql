-- Create qa_jobs table for automated QA system
CREATE TABLE IF NOT EXISTS qa_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'complete', 'failed', 'screenshots_captured')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    error TEXT,
    qa_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_qa_jobs_status ON qa_jobs(status);
CREATE INDEX IF NOT EXISTS idx_qa_jobs_created_at ON qa_jobs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qa_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_qa_jobs_updated_at
    BEFORE UPDATE ON qa_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_qa_jobs_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE qa_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own QA jobs
CREATE POLICY "Users can view QA jobs" ON qa_jobs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert QA jobs
CREATE POLICY "Users can create QA jobs" ON qa_jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update QA jobs
CREATE POLICY "Users can update QA jobs" ON qa_jobs
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON qa_jobs TO authenticated;
GRANT ALL ON qa_jobs TO service_role;

