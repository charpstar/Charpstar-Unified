-- Create FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_is_active ON faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_faqs_order_index ON faqs(order_index);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW
  EXECUTE FUNCTION update_faqs_updated_at();

-- Insert some sample FAQs
INSERT INTO faqs (question, answer, category, order_index) VALUES
('What is Charpstar?', 'Charpstar is a 3D asset management platform that helps clients, modelers, and QA teams collaborate on 3D model creation and review processes.', 'General', 1),
('How do I upload my products?', 'You can upload products using either CSV upload or manual entry. Go to the onboarding section and choose your preferred method. Make sure to include Article ID, Product Name, Product Link, and Category.', 'Getting Started', 1),
('What file formats are supported?', 'We support GLB files for 3D models and common image formats (JPG, PNG, WEBP) for reference images. The platform is optimized for GLB files for the best 3D viewing experience.', 'Technical', 1),
('How do I track my model progress?', 'You can track your model progress through the dashboard. Modelers see their assignments, QAs can review submitted work, and clients can monitor overall project status.', 'Workflow', 1),
('What are the different user roles?', 'There are four main roles: Admin (full access), Client (upload and review), Modeler (create 3D models), and QA (quality assurance and review). Each role has specific permissions and access levels.', 'General', 2),
('How do I contact support?', 'You can contact support through the platform messaging system or by email. Support is available during business hours and we typically respond within 24 hours.', 'Support', 1);
