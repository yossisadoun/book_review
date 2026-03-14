-- Content hearts: tracks which users have hearted which content items
-- Run this in Supabase SQL Editor

CREATE TABLE public.content_hearts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_hash)
);

-- Index for counting hearts per content item
CREATE INDEX idx_content_hearts_hash ON public.content_hearts(content_hash);

-- Index for querying user's hearts
CREATE INDEX idx_content_hearts_user ON public.content_hearts(user_id);

-- RLS policies
ALTER TABLE public.content_hearts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all hearts" ON public.content_hearts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own hearts" ON public.content_hearts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hearts" ON public.content_hearts
  FOR DELETE USING (auth.uid() = user_id);
