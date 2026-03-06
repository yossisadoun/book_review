-- Add Spotify podcast episodes column to cache and books tables

ALTER TABLE podcast_episodes_cache ADD COLUMN IF NOT EXISTS podcast_episodes_spotify jsonb DEFAULT '[]'::jsonb;

ALTER TABLE books ADD COLUMN IF NOT EXISTS podcast_episodes_spotify jsonb;
