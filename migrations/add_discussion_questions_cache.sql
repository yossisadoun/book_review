-- Cache table for AI-generated book discussion questions
-- Shared across users via canonical_book_id

CREATE TABLE IF NOT EXISTS public.discussion_questions_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Book identification (canonical for sharing)
  canonical_book_id text NOT NULL,
  book_title text NOT NULL,
  book_author text NOT NULL,

  -- The generated questions (JSON array)
  questions jsonb NOT NULL,

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT discussion_questions_cache_pkey PRIMARY KEY (id)
);

-- Unique index on canonical_book_id - one entry per book
CREATE UNIQUE INDEX IF NOT EXISTS discussion_questions_cache_canonical_idx
ON public.discussion_questions_cache(canonical_book_id);

-- Index for lookups by title/author (fallback)
CREATE INDEX IF NOT EXISTS discussion_questions_cache_title_author_idx
ON public.discussion_questions_cache(lower(book_title), lower(book_author));

-- Enable RLS
ALTER TABLE public.discussion_questions_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can read (shared cache), only authenticated users can insert
CREATE POLICY "Anyone can read discussion questions"
  ON public.discussion_questions_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert discussion questions"
  ON public.discussion_questions_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update discussion questions"
  ON public.discussion_questions_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Comments
COMMENT ON TABLE public.discussion_questions_cache IS 'Cached AI-generated discussion questions for books, shared across all users';
COMMENT ON COLUMN public.discussion_questions_cache.canonical_book_id IS 'Normalized book identifier for sharing: lowercase(title|author)';
COMMENT ON COLUMN public.discussion_questions_cache.questions IS 'JSON array of discussion questions with id, question, and category';
