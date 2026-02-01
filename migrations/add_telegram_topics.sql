-- Telegram topics for book discussions
-- Links each book to a Telegram forum topic in our group

CREATE TABLE IF NOT EXISTS public.telegram_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  canonical_book_id text NOT NULL,
  book_title text NOT NULL,
  book_author text NOT NULL,
  telegram_topic_id bigint NOT NULL,
  invite_link text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT telegram_topics_pkey PRIMARY KEY (id)
);

-- Unique index on canonical_book_id - one topic per book
CREATE UNIQUE INDEX IF NOT EXISTS telegram_topics_canonical_idx
  ON public.telegram_topics(canonical_book_id);

-- Index for topic ID lookups
CREATE INDEX IF NOT EXISTS telegram_topics_topic_id_idx
  ON public.telegram_topics(telegram_topic_id);

-- RLS policies
ALTER TABLE public.telegram_topics ENABLE ROW LEVEL SECURITY;

-- Anyone can read (shared cache)
CREATE POLICY "Allow anonymous read access"
  ON public.telegram_topics FOR SELECT
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Allow authenticated insert"
  ON public.telegram_topics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "Allow authenticated update"
  ON public.telegram_topics FOR UPDATE
  TO authenticated
  USING (true);
