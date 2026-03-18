-- Migration: add_feed_items_composite_index
-- Covers the primary feed query shape: WHERE user_id = X AND type = Y ORDER BY created_at DESC
-- Replaces the partial (user_id, type) index which doesn't cover the sort

DROP INDEX IF EXISTS feed_items_user_type_idx;

CREATE INDEX IF NOT EXISTS feed_items_user_type_created_idx
  ON public.feed_items(user_id, type, created_at DESC);
