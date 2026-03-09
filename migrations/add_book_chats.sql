-- Book Chat Messages
-- Stores conversation history between users and the AI reading companion per book

CREATE TABLE book_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id uuid NOT NULL,
  book_title text NOT NULL,
  book_author text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_book_chats_user_book ON book_chats(user_id, book_id, created_at);

ALTER TABLE book_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chats" ON book_chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats" ON book_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
