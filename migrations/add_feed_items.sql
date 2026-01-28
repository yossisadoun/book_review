-- Feed items table for personalized content feed
-- Each item represents a piece of content derived from a user's book

CREATE TABLE IF NOT EXISTS public.feed_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Ownership
  user_id uuid NOT NULL,

  -- Source book (denormalized for query performance)
  source_book_id uuid NOT NULL,
  source_book_title text NOT NULL,
  source_book_author text NOT NULL,
  source_book_cover_url text,

  -- Content
  type text NOT NULL,
  content jsonb NOT NULL,
  content_hash text,  -- For deduplication

  -- Status & Scoring
  reading_status text,  -- Synced from book: 'read_it', 'reading', 'want_to_read'
  base_score float DEFAULT 1.0,

  -- Engagement tracking (for staleness calculation)
  times_shown integer DEFAULT 0,
  last_shown_at timestamp with time zone,

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT feed_items_pkey PRIMARY KEY (id),
  CONSTRAINT feed_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT feed_items_source_book_id_fkey FOREIGN KEY (source_book_id) REFERENCES public.books(id) ON DELETE CASCADE,
  CONSTRAINT feed_items_type_check CHECK (
    type IN ('fact', 'context', 'drilldown', 'influence', 'podcast', 'article', 'related_book', 'video', 'friend_book')
  ),
  CONSTRAINT feed_items_reading_status_check CHECK (
    reading_status IS NULL OR reading_status IN ('read_it', 'reading', 'want_to_read')
  )
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS feed_items_user_id_idx ON public.feed_items(user_id);
CREATE INDEX IF NOT EXISTS feed_items_user_type_idx ON public.feed_items(user_id, type);
CREATE INDEX IF NOT EXISTS feed_items_reading_status_idx ON public.feed_items(reading_status);
CREATE INDEX IF NOT EXISTS feed_items_created_at_idx ON public.feed_items(created_at DESC);
CREATE INDEX IF NOT EXISTS feed_items_source_book_idx ON public.feed_items(source_book_id);

-- Deduplication index: prevent same content item for same user
CREATE UNIQUE INDEX IF NOT EXISTS feed_items_dedup_idx ON public.feed_items(user_id, type, content_hash);

-- Enable RLS
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own feed items + items from people they follow
CREATE POLICY "Users can view own feed items"
  ON public.feed_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view followed users feed items"
  ON public.feed_items FOR SELECT
  USING (
    type = 'friend_book' AND
    user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own feed items"
  ON public.feed_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed items"
  ON public.feed_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed items"
  ON public.feed_items FOR DELETE
  USING (auth.uid() = user_id);

-- Function to sync reading_status from books to feed_items
CREATE OR REPLACE FUNCTION sync_feed_items_reading_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.reading_status IS DISTINCT FROM NEW.reading_status THEN
    UPDATE public.feed_items
    SET reading_status = NEW.reading_status
    WHERE source_book_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync reading_status
DROP TRIGGER IF EXISTS sync_feed_items_on_book_update ON public.books;
CREATE TRIGGER sync_feed_items_on_book_update
  AFTER UPDATE OF reading_status ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION sync_feed_items_reading_status();

-- Function to delete feed items when a book is deleted
CREATE OR REPLACE FUNCTION delete_feed_items_on_book_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.feed_items WHERE source_book_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to cleanup feed items when book is deleted
DROP TRIGGER IF EXISTS delete_feed_items_on_book_delete ON public.books;
CREATE TRIGGER delete_feed_items_on_book_delete
  BEFORE DELETE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION delete_feed_items_on_book_delete();

-- RPC function to increment times_shown for a feed item
CREATE OR REPLACE FUNCTION increment_feed_item_shown(item_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.feed_items
  SET
    times_shown = times_shown + 1,
    last_shown_at = now()
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE public.feed_items IS 'Personalized feed content derived from user books and social connections';
COMMENT ON COLUMN public.feed_items.type IS 'Content type: fact, context, drilldown, influence, podcast, article, related_book, video, friend_book';
COMMENT ON COLUMN public.feed_items.content_hash IS 'SHA-256 hash of content for deduplication';
COMMENT ON COLUMN public.feed_items.times_shown IS 'How many times this item appeared in user feed';
COMMENT ON COLUMN public.feed_items.last_shown_at IS 'Last time this item was shown, for staleness scoring';
