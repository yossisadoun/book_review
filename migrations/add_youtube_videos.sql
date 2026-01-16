-- Migration: Add youtube_videos table for caching YouTube search results
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  videos jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_title, book_author)
);

CREATE INDEX IF NOT EXISTS youtube_videos_book_lookup_idx 
ON public.youtube_videos(book_title, book_author);

-- Add comment
COMMENT ON TABLE public.youtube_videos IS 'Cached YouTube video search results per book';

-- Enable RLS (Row Level Security) - allow all authenticated users to read/write
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read
CREATE POLICY "youtube_videos_select_all"
ON public.youtube_videos FOR SELECT
USING (true);

-- Policy: Allow all authenticated users to insert
CREATE POLICY "youtube_videos_insert_all"
ON public.youtube_videos FOR INSERT
WITH CHECK (true);

-- Policy: Allow all authenticated users to update
CREATE POLICY "youtube_videos_update_all"
ON public.youtube_videos FOR UPDATE
USING (true)
WITH CHECK (true);
