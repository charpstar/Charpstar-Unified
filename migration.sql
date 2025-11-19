-- Migration: Add preview_images column to assets table
-- This column stores an array of image URLs (text[]) for the 8 views of 3D models

-- Add preview_images column to assets table (used by GLB processor)
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS preview_images text[];

-- Optional: Add comment to document the column
COMMENT ON COLUMN assets.preview_images IS 'Array of image URLs for 8 different views of the 3D model (front, back, left, right, top, bottom, isometric_front_right, isometric_front_left)';

