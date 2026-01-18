-- Migration: Replace pages column with isbn column
-- Run this in Supabase SQL Editor

-- Drop the pages column if it exists
ALTER TABLE public.books 
DROP COLUMN IF EXISTS pages;

-- Add the isbn column
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS isbn text;

-- Add a comment to document the column
COMMENT ON COLUMN public.books.isbn IS 'ISBN (International Standard Book Number) of the book';
