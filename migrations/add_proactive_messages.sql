-- Track proactive (unsolicited) messages sent to users
-- is_proactive on book_chats marks which messages were AI-initiated
ALTER TABLE book_chats ADD COLUMN IF NOT EXISTS is_proactive boolean DEFAULT false;

-- Log table to track proactive message frequency and reply status
CREATE TABLE IF NOT EXISTS proactive_message_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  chat_type text NOT NULL CHECK (chat_type IN ('book', 'general')),
  chat_key text NOT NULL,  -- book_id or 'general'
  sent_at timestamptz DEFAULT now(),
  was_replied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proactive_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own proactive logs"
  ON proactive_message_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own proactive logs"
  ON proactive_message_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proactive logs"
  ON proactive_message_log FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_proactive_log_user_key ON proactive_message_log(user_id, chat_key);
