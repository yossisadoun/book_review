-- Key-value feature flags table (replaces column-based remote_feature_flags for web)
-- Old table is kept for iOS backward compatibility until migrated
CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed with current flags
INSERT INTO feature_flags (key, enabled) VALUES
  ('chat_enabled', true),
  ('create_post_enabled', false)
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read, only service role can write
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);
