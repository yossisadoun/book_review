-- Migration: Add domain_label column to book_domain_cache table
-- Run this in Supabase SQL Editor if the table already exists

ALTER TABLE IF EXISTS public.book_domain_cache 
ADD COLUMN IF NOT EXISTS domain_label text NOT NULL DEFAULT 'Domain';

-- Add comment
COMMENT ON COLUMN public.book_domain_cache.domain_label IS '1-2 word label for the domain (e.g., "Taxonomy", "Maritime Law")';
