-- Book summary cache: stores generated book cheat sheets
-- Run this in Supabase SQL Editor

CREATE TABLE public.book_summary_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  summary_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_title, book_author)
);

-- Index for lookups
CREATE INDEX idx_book_summary_cache_lookup ON public.book_summary_cache(book_title, book_author);

-- RLS policies
ALTER TABLE public.book_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read book summaries" ON public.book_summary_cache
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert summaries" ON public.book_summary_cache
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update summaries" ON public.book_summary_cache
  FOR UPDATE USING (auth.uid() IS NOT NULL);
