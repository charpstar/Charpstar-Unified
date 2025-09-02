-- Migration: Add estimated_cost column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN clients.estimated_cost IS 'Estimated internal cost used for break-even calculations';

