-- Migration: Add first_issue_year column to books table
-- Run this in Supabase SQL Editor

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS first_issue_year int;

-- Add a comment to document the column
COMMENT ON COLUMN public.books.first_issue_year IS 'The original publication year (earliest known) for this book in its earliest version';
