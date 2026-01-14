-- Migration: Add notes column to books table
-- Run this in Supabase SQL Editor

-- Add notes column
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS notes text;

-- Add comment
COMMENT ON COLUMN public.books.notes IS 'User notes for the book';
