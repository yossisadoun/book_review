-- Feed improvements: add read tracking and book recency for scoring

-- Add 'read' boolean for marking feed items as read by user
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- Add source_book_created_at for recency-weighted scoring
ALTER TABLE public.feed_items
  ADD COLUMN IF NOT EXISTS source_book_created_at timestamp with time zone;

-- Index for filtering by read status
CREATE INDEX IF NOT EXISTS feed_items_read_idx ON public.feed_items(user_id, read);

-- Backfill source_book_created_at from books table
UPDATE public.feed_items fi
SET source_book_created_at = b.created_at
FROM public.books b
WHERE fi.source_book_id = b.id
  AND fi.source_book_created_at IS NULL;
