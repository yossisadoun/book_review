-- Migration: Create google_scholar_articles table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.google_scholar_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  articles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of book_title and book_author
  UNIQUE(book_title, book_author)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_google_scholar_articles_book_title 
  ON public.google_scholar_articles (lower(book_title));

CREATE INDEX IF NOT EXISTS idx_google_scholar_articles_book_author 
  ON public.google_scholar_articles (lower(book_author));

CREATE INDEX IF NOT EXISTS idx_google_scholar_articles_book_lookup 
  ON public.google_scholar_articles (lower(book_title), lower(book_author));

-- Add comments
COMMENT ON TABLE public.google_scholar_articles IS 'Stores Google Scholar analysis articles for books';
COMMENT ON COLUMN public.google_scholar_articles.articles IS 'JSON array of analysis articles with title, snippet, url, authors, and year';

-- Enable RLS (optional - can be public since it's just cached search results)
ALTER TABLE public.google_scholar_articles ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can read cached results)
CREATE POLICY "google_scholar_articles_select_public"
ON public.google_scholar_articles FOR SELECT
USING (true);

-- Allow public insert/update (anyone can cache results)
CREATE POLICY "google_scholar_articles_insert_public"
ON public.google_scholar_articles FOR INSERT
WITH CHECK (true);

CREATE POLICY "google_scholar_articles_update_public"
ON public.google_scholar_articles FOR UPDATE
USING (true);
