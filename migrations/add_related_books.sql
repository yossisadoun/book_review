-- Migration: Create related_books table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.related_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  related_books jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of book_title and book_author
  UNIQUE(book_title, book_author)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_related_books_book_title 
  ON public.related_books (lower(book_title));

CREATE INDEX IF NOT EXISTS idx_related_books_book_author 
  ON public.related_books (lower(book_author));

CREATE INDEX IF NOT EXISTS idx_related_books_book_lookup 
  ON public.related_books (lower(book_title), lower(book_author));

-- Add comments
COMMENT ON TABLE public.related_books IS 'Stores related book recommendations for books';
COMMENT ON COLUMN public.related_books.related_books IS 'JSON array of related books with title, author, reason, thumbnail, cover_url, publish_year, etc.';

-- Enable RLS (optional - can be public since it's just cached search results)
ALTER TABLE public.related_books ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can read cached results)
CREATE POLICY "related_books_select_public"
ON public.related_books FOR SELECT
USING (true);

-- Allow public insert/update (anyone can cache results)
CREATE POLICY "related_books_insert_public"
ON public.related_books FOR INSERT
WITH CHECK (true);

CREATE POLICY "related_books_update_public"
ON public.related_books FOR UPDATE
USING (true);
