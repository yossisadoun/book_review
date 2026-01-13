-- Migration: Add source-specific podcast episode columns to books table
-- Run this in Supabase SQL Editor

-- Add Grok podcast episodes column
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS podcast_episodes_grok jsonb;

-- Add Apple Podcasts episodes column
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS podcast_episodes_apple jsonb;

-- Add comments to document the columns
COMMENT ON COLUMN public.books.podcast_episodes_grok IS 'JSON array of podcast episodes fetched from Grok API';
COMMENT ON COLUMN public.books.podcast_episodes_apple IS 'JSON array of podcast episodes fetched from Apple Podcasts API';
