-- Migration: Create author_facts_cache table for shared caching
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.author_facts_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  author_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of book_title and book_author
  UNIQUE(book_title, book_author)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_author_facts_cache_book_title 
  ON public.author_facts_cache (lower(book_title));

CREATE INDEX IF NOT EXISTS idx_author_facts_cache_book_author 
  ON public.author_facts_cache (lower(book_author));

CREATE INDEX IF NOT EXISTS idx_author_facts_cache_book_lookup 
  ON public.author_facts_cache (lower(book_title), lower(book_author));

-- Add comments
COMMENT ON TABLE public.author_facts_cache IS 'Stores cached author facts for books (shared across all users)';
COMMENT ON COLUMN public.author_facts_cache.author_facts IS 'JSON array of author facts';

-- Enable RLS (optional - can be public since it's just cached search results)
ALTER TABLE public.author_facts_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can read cached results)
CREATE POLICY "author_facts_cache_select_public"
ON public.author_facts_cache FOR SELECT
USING (true);

-- Allow public insert/update (anyone can cache results)
CREATE POLICY "author_facts_cache_insert_public"
ON public.author_facts_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "author_facts_cache_update_public"
ON public.author_facts_cache FOR UPDATE
USING (true);
