-- Add 'related_work' to feed_items type CHECK constraint
-- Run this in Supabase SQL Editor before deploying the code

-- Check existing constraint
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'feed_items'::regclass AND contype = 'c';

-- Drop and recreate with new type
ALTER TABLE feed_items DROP CONSTRAINT IF EXISTS feed_items_type_check;
ALTER TABLE feed_items ADD CONSTRAINT feed_items_type_check
CHECK (type = ANY (ARRAY['fact'::text, 'context'::text, 'drilldown'::text, 'influence'::text, 'podcast'::text, 'article'::text, 'related_book'::text, 'video'::text, 'friend_book'::text, 'did_you_know'::text, 'related_work'::text]));
