-- Migration: add_batch_mark_feed_items_shown
-- Replaces N+1 select+update pattern with a single batched RPC call

CREATE OR REPLACE FUNCTION batch_mark_feed_items_shown(item_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE feed_items
  SET times_shown = times_shown + 1,
      last_shown_at = now()
  WHERE id = ANY(item_ids);
$$;
