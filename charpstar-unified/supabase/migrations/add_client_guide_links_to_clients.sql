-- Migration: Add client_guide_links (array of URLs) to clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS client_guide_links TEXT[];

COMMENT ON COLUMN clients.client_guide_links IS 'Array of URLs to external guideline documents for the client.';

