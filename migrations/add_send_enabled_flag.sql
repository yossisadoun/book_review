-- Add feature flag for send/share buttons across feed and book page (default off)
INSERT INTO feature_flags (key, enabled) VALUES
  ('send_enabled', false)
ON CONFLICT (key) DO NOTHING;
