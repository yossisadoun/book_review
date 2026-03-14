-- Add feature flag for play buttons on related movies/shows (default off)
INSERT INTO feature_flags (key, enabled) VALUES
  ('related_work_play_buttons', false)
ON CONFLICT (key) DO NOTHING;
