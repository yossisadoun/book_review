-- Related movies/shows cache table
-- Stores Grok-generated movie/show recommendations enriched with iTunes data
CREATE TABLE IF NOT EXISTS public.related_movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  related_movies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_title, book_author)
);

ALTER TABLE public.related_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "related_movies_select" ON public.related_movies FOR SELECT USING (true);
CREATE POLICY "related_movies_insert" ON public.related_movies FOR INSERT WITH CHECK (true);
CREATE POLICY "related_movies_update" ON public.related_movies FOR UPDATE USING (true);
