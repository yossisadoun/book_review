-- Remote feature flags table
-- Single-row table for app-wide feature flag configuration
CREATE TABLE IF NOT EXISTS remote_feature_flags (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  chat_enabled boolean NOT NULL DEFAULT true,
  create_post_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO remote_feature_flags (id, chat_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read, only service role can write
ALTER TABLE remote_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON remote_feature_flags FOR SELECT
  USING (true);
