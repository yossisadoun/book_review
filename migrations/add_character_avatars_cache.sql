-- Character avatars cache table
CREATE TABLE IF NOT EXISTS character_avatars_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_title text NOT NULL,
  book_author text NOT NULL,
  avatars jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(book_title, book_author)
);

CREATE INDEX IF NOT EXISTS idx_character_avatars_lookup
  ON character_avatars_cache(book_title, book_author);

-- RLS
ALTER TABLE character_avatars_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read character avatars cache"
  ON character_avatars_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert character avatars cache"
  ON character_avatars_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update character avatars cache"
  ON character_avatars_cache FOR UPDATE
  USING (auth.role() = 'authenticated');
