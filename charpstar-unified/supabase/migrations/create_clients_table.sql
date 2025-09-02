-- Migration: Create clients table for admin client management
-- This table stores client information, contracts, and project specifications

-- Create the clients table
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    company VARCHAR(255),
    contract_type VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (contract_type IN ('standard', 'premium', 'enterprise', 'custom')),
    contract_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_terms TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
    specifications TEXT,
    requirements TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments to document the table and columns
COMMENT ON TABLE clients IS 'Client management table for storing client information, contracts, and project specifications';
COMMENT ON COLUMN clients.name IS 'Full name of the client contact person';
COMMENT ON COLUMN clients.email IS 'Primary email address for the client (unique)';
COMMENT ON COLUMN clients.company IS 'Company or organization name';
COMMENT ON COLUMN clients.contract_type IS 'Type of contract: standard, premium, enterprise, or custom';
COMMENT ON COLUMN clients.contract_value IS 'Total contract value in euros';
COMMENT ON COLUMN clients.payment_terms IS 'Payment terms and conditions (e.g., Net 30, 50% upfront)';
COMMENT ON COLUMN clients.start_date IS 'Contract start date';
COMMENT ON COLUMN clients.end_date IS 'Contract end date (optional for ongoing contracts)';
COMMENT ON COLUMN clients.status IS 'Current client status: active, inactive, or pending';
COMMENT ON COLUMN clients.specifications IS 'Detailed client specifications and requirements';
COMMENT ON COLUMN clients.requirements IS 'Technical requirements and project scope';
COMMENT ON COLUMN clients.notes IS 'Additional notes and comments';

-- Create indexes for better query performance
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_company ON clients(company);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_contract_type ON clients(contract_type);
CREATE INDEX idx_clients_start_date ON clients(start_date);
CREATE INDEX idx_clients_created_at ON clients(created_at);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO clients (name, email, company, contract_type, contract_value, payment_terms, start_date, status, specifications, requirements) VALUES
('John Smith', 'john.smith@techcorp.com', 'TechCorp Industries', 'premium', 50000.00, 'Net 30', '2024-01-15', 'active', 'High-quality 3D models for product catalog with PBR materials and multiple LODs. Models should be optimized for web viewing and mobile devices.', 'Models must be under 5MB for web, support PBR workflow, include normal maps, and be compatible with Unity/Unreal Engine.'),
('Sarah Johnson', 'sarah.j@designstudio.com', 'Design Studio Pro', 'enterprise', 120000.00, '50% upfront, 50% on completion', '2024-02-01', 'active', 'Complete product visualization suite including 3D models, animations, and interactive elements for e-commerce platform.', 'All assets must be web-optimized, support AR viewing, include animation rigs, and be delivered in multiple formats (GLB, USDZ, FBX).'),
('Mike Chen', 'mike.chen@startup.io', 'Startup.io', 'standard', 15000.00, 'Net 15', '2024-03-01', 'pending', 'Simple product models for MVP testing. Focus on speed and basic quality.', 'Basic models with simple materials, optimized for fast loading, compatible with Three.js.');

-- Grant appropriate permissions (adjust based on your Supabase setup)
-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable read access for authenticated users" ON clients FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable insert for authenticated users" ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Enable update for authenticated users" ON clients FOR UPDATE USING (auth.role() = 'authenticated');
