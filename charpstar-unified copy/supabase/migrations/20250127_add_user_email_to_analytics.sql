-- Add user_email column to scene_render_analytics table
ALTER TABLE scene_render_analytics ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_scene_render_analytics_user_email ON scene_render_analytics(user_email);
 