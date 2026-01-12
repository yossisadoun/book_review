-- Migration: Add author_facts column to books table
-- Run this in Supabase SQL Editor

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS author_facts jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN public.books.author_facts IS 'JSON array of fun facts about the author in the context of the book';
