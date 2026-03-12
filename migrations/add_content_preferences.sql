-- Add content_preferences column to users table
-- Stores user's preferred content types as JSONB
-- Default: all enabled { fun_facts: true, podcasts: true, youtube: true, related_work: true, articles: true }

ALTER TABLE users
ADD COLUMN IF NOT EXISTS content_preferences jsonb DEFAULT '{"fun_facts": true, "podcasts": true, "youtube": true, "related_work": true, "articles": true}'::jsonb;
