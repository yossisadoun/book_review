-- Migration: Add pages column to books table
-- Run this in Supabase SQL Editor

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS pages int;

-- Add a comment to document the column
COMMENT ON COLUMN public.books.pages IS 'Number of pages in the book';
