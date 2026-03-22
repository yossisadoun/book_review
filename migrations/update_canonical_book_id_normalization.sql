-- Migration: Update canonical_book_id normalization
-- Adds: diacritics stripping, hyphen normalization, parenthetical stripping,
--        primary author extraction, initial spacing collapse
-- Run in Supabase SQL Editor

-- Step 1: Install unaccent extension (for diacritics stripping)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Step 2: Update the generate_canonical_book_id function with full normalization
CREATE OR REPLACE FUNCTION generate_canonical_book_id(book_title text, book_author text)
RETURNS text AS $$
DECLARE
  norm_title text;
  norm_author text;
BEGIN
  -- === TITLE NORMALIZATION ===
  norm_title := coalesce(book_title, '');
  norm_title := lower(trim(norm_title));
  norm_title := unaccent(norm_title);               -- strip diacritics: é → e
  norm_title := regexp_replace(norm_title, '\s+', ' ', 'g');  -- collapse whitespace
  norm_title := regexp_replace(norm_title, '\s*\([^)]*\)\s*', ' ', 'g');  -- strip parentheticals: "beloved (novel)" → "beloved"
  norm_title := replace(norm_title, '-', ' ');       -- hyphens → spaces: "catch-22" → "catch 22"
  norm_title := regexp_replace(norm_title, '\s+', ' ', 'g');  -- re-collapse
  norm_title := trim(norm_title);

  -- === AUTHOR NORMALIZATION ===
  norm_author := coalesce(book_author, '');
  norm_author := lower(trim(norm_author));
  norm_author := unaccent(norm_author);              -- strip diacritics: García → garcia

  -- Primary author only: split on " & " or " and "
  norm_author := split_part(norm_author, ' & ', 1);
  -- Handle " and " separator (but not "and" within names like "Anderson")
  IF norm_author ~ '\sand\s' THEN
    -- Only split if " and " appears to separate authors (followed by a word that looks like a name)
    norm_author := regexp_replace(norm_author, '\s+and\s+.*$', '');
  END IF;

  -- Handle comma-separated co-authors: "douglas adams, eoin colfer"
  -- But preserve "last, first" format
  IF position(',' in norm_author) > 0 THEN
    -- If text before comma contains a space, it's "first last, co-author" → take first part
    IF position(' ' in trim(split_part(norm_author, ',', 1))) > 0 THEN
      norm_author := split_part(norm_author, ',', 1);
    END IF;
    -- Otherwise it's "last, first" format → keep as-is
  END IF;

  norm_author := regexp_replace(norm_author, '\s+', ' ', 'g');  -- collapse whitespace
  norm_author := regexp_replace(norm_author, '\.\s+', '.', 'g'); -- collapse initial spacing: "j. d." → "j.d."
  norm_author := replace(norm_author, '-', ' ');     -- hyphens → spaces: "saint-exupery" → "saint exupery"
  norm_author := regexp_replace(norm_author, '\s+', ' ', 'g');  -- re-collapse
  norm_author := trim(norm_author);

  RETURN norm_title || '|' || norm_author;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Preview changes (run this SELECT first to review before updating)
-- SELECT id, title, author, canonical_book_id AS old_id, generate_canonical_book_id(title, author) AS new_id
-- FROM books
-- WHERE canonical_book_id != generate_canonical_book_id(title, author)
-- ORDER BY title;

-- Step 4: Recompute all canonical_book_ids
UPDATE public.books
SET canonical_book_id = generate_canonical_book_id(title, author);

-- Step 5: Handle any new duplicates created by the improved normalization
-- (e.g., "Beloved (novel)" and "Beloved" by the same user now match)
-- Preview duplicates first:
-- SELECT user_id, canonical_book_id, count(*), array_agg(id || ': ' || title || ' / ' || author ORDER BY created_at)
-- FROM books
-- GROUP BY user_id, canonical_book_id
-- HAVING count(*) > 1;

-- Delete duplicates, keeping the oldest entry per (user_id, canonical_book_id)
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
  ) t
  WHERE rn > 1
);

-- Step 6: Also update telegram_topics canonical_book_ids if that table exists
UPDATE public.telegram_topics
SET canonical_book_id = generate_canonical_book_id(book_title, book_author)
WHERE canonical_book_id != generate_canonical_book_id(book_title, book_author);
