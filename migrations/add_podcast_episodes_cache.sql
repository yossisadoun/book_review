-- Migration: Create podcast_episodes_cache table for shared caching
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.podcast_episodes_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  podcast_episodes_curated jsonb NOT NULL DEFAULT '[]'::jsonb,
  podcast_episodes_apple jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of book_title and book_author
  UNIQUE(book_title, book_author)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_cache_book_title 
  ON public.podcast_episodes_cache (lower(book_title));

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_cache_book_author 
  ON public.podcast_episodes_cache (lower(book_author));

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_cache_book_lookup 
  ON public.podcast_episodes_cache (lower(book_title), lower(book_author));

-- Add comments
COMMENT ON TABLE public.podcast_episodes_cache IS 'Stores cached podcast episodes for books (shared across all users)';
COMMENT ON COLUMN public.podcast_episodes_cache.podcast_episodes_curated IS 'JSON array of curated podcast episodes';
COMMENT ON COLUMN public.podcast_episodes_cache.podcast_episodes_apple IS 'JSON array of Apple Podcasts episodes';

-- Enable RLS (optional - can be public since it's just cached search results)
ALTER TABLE public.podcast_episodes_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can read cached results)
CREATE POLICY "podcast_episodes_cache_select_public"
ON public.podcast_episodes_cache FOR SELECT
USING (true);

-- Allow public insert/update (anyone can cache results)
CREATE POLICY "podcast_episodes_cache_insert_public"
ON public.podcast_episodes_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "podcast_episodes_cache_update_public"
ON public.podcast_episodes_cache FOR UPDATE
USING (true);
