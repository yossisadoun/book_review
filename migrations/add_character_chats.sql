-- Character chats table (mirrors book_chats structure)
CREATE TABLE IF NOT EXISTS character_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_title text NOT NULL,
  book_author text NOT NULL,
  character_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_character_chats_user
  ON character_chats(user_id, book_title, character_name, created_at);

-- RLS
ALTER TABLE character_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own character chats"
  ON character_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own character chats"
  ON character_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own character chats"
  ON character_chats FOR DELETE
  USING (auth.uid() = user_id);
