-- Migration: Create trivia_questions_cache table
-- Run this in Supabase SQL Editor
-- This table stores trivia questions generated for books, accessible across all users

CREATE TABLE IF NOT EXISTS public.trivia_questions_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  questions jsonb NOT NULL, -- Array of question objects with question, correct_answer, wrong_answers, source, source_detail/url
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient lookups by book title and author
CREATE INDEX IF NOT EXISTS trivia_questions_cache_book_lookup_idx 
ON public.trivia_questions_cache (book_title, book_author);

-- Create index for efficient random selection
CREATE INDEX IF NOT EXISTS trivia_questions_cache_created_at_idx 
ON public.trivia_questions_cache (created_at);

-- Add comments
COMMENT ON TABLE public.trivia_questions_cache IS 'Cached trivia questions for books, accessible across all users';
COMMENT ON COLUMN public.trivia_questions_cache.questions IS 'JSON array of question objects: {question, correct_answer, wrong_answers[], source, source_detail/url}';

-- Enable RLS (Row Level Security) - but allow all authenticated users to read
ALTER TABLE public.trivia_questions_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read trivia questions (they're shared across users)
CREATE POLICY "trivia_questions_cache_select_all"
ON public.trivia_questions_cache FOR SELECT
USING (true);

-- Policy: Only authenticated users can insert/update (for generating new questions)
CREATE POLICY "trivia_questions_cache_insert_authenticated"
ON public.trivia_questions_cache FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "trivia_questions_cache_update_authenticated"
ON public.trivia_questions_cache FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
