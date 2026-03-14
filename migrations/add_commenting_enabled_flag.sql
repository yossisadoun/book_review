-- Add feature flag for comment buttons across feed and book page (default off)
INSERT INTO feature_flags (key, enabled) VALUES
  ('commenting_enabled', false)
ON CONFLICT (key) DO NOTHING;
