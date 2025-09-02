-- Migration: Add client_guide to clients table for project-wide guidelines
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS client_guide TEXT;

COMMENT ON COLUMN clients.client_guide IS 'Client-specific modeling guide and technical specifications prepared by QA/Lead 3D Artist.';

