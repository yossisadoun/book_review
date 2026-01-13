-- Migration: Add curated podcast episodes column to books table
-- Run this in Supabase SQL Editor

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS podcast_episodes_curated jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN public.books.podcast_episodes_curated IS 'JSON array of podcast episodes from curated source (pre-fetched from prioritized shows)';
