-- Normalize discussion_questions_cache to use book_title + book_author
-- like all other cache tables, instead of canonical_book_id.
--
-- Steps:
-- 1. Backfill normalized book_title/book_author from existing data
-- 2. Drop the canonical_book_id unique index
-- 3. Add unique index on (book_title, book_author)
-- 4. Drop the canonical_book_id column

-- Step 1: Ensure book_title and book_author are normalized (lowercase, trimmed)
UPDATE public.discussion_questions_cache
SET book_title = lower(trim(book_title)),
    book_author = lower(trim(book_author));

-- Step 2: Deduplicate — if normalization creates dupes, keep the most recent
DELETE FROM public.discussion_questions_cache a
USING public.discussion_questions_cache b
WHERE a.id < b.id
  AND lower(trim(a.book_title)) = lower(trim(b.book_title))
  AND lower(trim(a.book_author)) = lower(trim(b.book_author));

-- Step 3: Drop old canonical_book_id unique index
DROP INDEX IF EXISTS public.discussion_questions_cache_canonical_idx;

-- Step 4: Drop old title/author fallback index
DROP INDEX IF EXISTS public.discussion_questions_cache_title_author_idx;

-- Step 5: Add unique index on (book_title, book_author) — matches all other caches
CREATE UNIQUE INDEX discussion_questions_cache_title_author_unique
ON public.discussion_questions_cache(book_title, book_author);

-- Step 6: Drop canonical_book_id column (no longer needed)
ALTER TABLE public.discussion_questions_cache DROP COLUMN IF EXISTS canonical_book_id;

-- Comments
COMMENT ON TABLE public.discussion_questions_cache IS 'Cached AI-generated discussion questions for books, shared across all users. Keyed on (book_title, book_author) like all other caches.';
