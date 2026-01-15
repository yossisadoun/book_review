-- Migration: Add canonical_book_id for deduplication
-- Run this in Supabase SQL Editor

-- Add the canonical_book_id column
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS canonical_book_id text;

-- Create a function to generate canonical book ID (normalized title + author)
CREATE OR REPLACE FUNCTION generate_canonical_book_id(book_title text, book_author text)
RETURNS text AS $$
BEGIN
  -- Normalize: lowercase, trim, remove extra spaces
  RETURN lower(trim(regexp_replace(coalesce(book_title, ''), '\s+', ' ', 'g')) || '|' || 
                trim(regexp_replace(coalesce(book_author, ''), '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill existing books with canonical IDs
UPDATE public.books
SET canonical_book_id = generate_canonical_book_id(title, author)
WHERE canonical_book_id IS NULL;

-- Remove duplicates: keep the oldest book for each (user_id, canonical_book_id) pair
-- Delete all but the first (by created_at) for each duplicate group
DELETE FROM public.books
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, canonical_book_id 
             ORDER BY created_at ASC
           ) as rn
    FROM public.books
    WHERE canonical_book_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Make it NOT NULL going forward (after backfill and cleanup)
ALTER TABLE public.books
ALTER COLUMN canonical_book_id SET NOT NULL;

-- Create unique constraint: same user can't have the same canonical book twice
CREATE UNIQUE INDEX IF NOT EXISTS books_user_canonical_unique 
ON public.books(user_id, canonical_book_id);

-- Create index for finding other users with the same book
CREATE INDEX IF NOT EXISTS books_canonical_id_idx 
ON public.books(canonical_book_id);

-- Add comment
COMMENT ON COLUMN public.books.canonical_book_id IS 'Normalized identifier for deduplication: lowercase(title|author)';
