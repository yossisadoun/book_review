-- Add show_grok_costs feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled) VALUES
  ('show_grok_costs', false)
ON CONFLICT (key) DO NOTHING;
