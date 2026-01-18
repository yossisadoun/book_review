-- Migration: Create book_influences_cache table for shared caching
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.book_influences_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  influences jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of book_title and book_author
  UNIQUE(book_title, book_author)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_book_influences_cache_book_title 
  ON public.book_influences_cache (lower(book_title));

CREATE INDEX IF NOT EXISTS idx_book_influences_cache_book_author 
  ON public.book_influences_cache (lower(book_author));

CREATE INDEX IF NOT EXISTS idx_book_influences_cache_book_lookup 
  ON public.book_influences_cache (lower(book_title), lower(book_author));

-- Add comments
COMMENT ON TABLE public.book_influences_cache IS 'Cached book influences from Grok API per book';
COMMENT ON COLUMN public.book_influences_cache.influences IS 'JSON array of literary influences, references, and allusions';

-- Enable RLS (Row Level Security) - allow all authenticated users to read/write
ALTER TABLE public.book_influences_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read
CREATE POLICY "book_influences_cache_select_all"
ON public.book_influences_cache FOR SELECT
USING (true);

-- Policy: Allow all authenticated users to insert
CREATE POLICY "book_influences_cache_insert_all"
ON public.book_influences_cache FOR INSERT
WITH CHECK (true);

-- Policy: Allow all authenticated users to update
CREATE POLICY "book_influences_cache_update_all"
ON public.book_influences_cache FOR UPDATE
USING (true)
WITH CHECK (true);
