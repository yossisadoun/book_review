-- Migration: add_analytics_events
-- Creates analytics_events table for tracking user interactions across platforms

CREATE TABLE analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  feature text NOT NULL,
  action text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  account_type text NOT NULL CHECK (account_type IN ('guest', 'apple', 'google')),
  metadata jsonb,
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_analytics_events_user_created
  ON analytics_events (user_id, created_at);

CREATE INDEX idx_analytics_events_feature_action_created
  ON analytics_events (feature, action, created_at);

CREATE INDEX idx_analytics_events_session
  ON analytics_events (session_id);

-- RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Authenticated and anonymous users can insert only
CREATE POLICY "Users can insert analytics events"
  ON analytics_events
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Only service role can read
CREATE POLICY "Service role can read analytics events"
  ON analytics_events
  FOR SELECT
  TO service_role
  USING (true);

-- No update or delete policies — explicitly denied by RLS
