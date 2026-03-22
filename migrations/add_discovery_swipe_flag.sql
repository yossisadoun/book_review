-- Add discovery_swipe feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled) VALUES
  ('discovery_swipe', false)
ON CONFLICT (key) DO NOTHING;
