-- Migration: Add 'did_you_know' to feed_items type CHECK constraint
-- Run this in the Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE feed_items DROP CONSTRAINT IF EXISTS feed_items_type_check;

-- Add new constraint with did_you_know included
ALTER TABLE feed_items ADD CONSTRAINT feed_items_type_check
CHECK (type = ANY (ARRAY[
  'fact'::text,
  'context'::text,
  'drilldown'::text,
  'influence'::text,
  'podcast'::text,
  'article'::text,
  'related_book'::text,
  'video'::text,
  'friend_book'::text,
  'did_you_know'::text
]));
