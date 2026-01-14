-- Migration: Add new rating columns and rename insight to insights
-- Run this in Supabase SQL Editor

-- Rename rating_insight to rating_insights
ALTER TABLE public.books 
RENAME COLUMN rating_insight TO rating_insights;

-- Add new rating columns
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS rating_world int CHECK (rating_world between 1 and 5);

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS rating_characters int CHECK (rating_characters between 1 and 5);

-- Add comments
COMMENT ON COLUMN public.books.rating_insights IS 'Rating for insights (1-5)';
COMMENT ON COLUMN public.books.rating_world IS 'Rating for world building (1-5)';
COMMENT ON COLUMN public.books.rating_characters IS 'Rating for characters (1-5)';
