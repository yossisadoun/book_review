INSERT INTO feature_flags (key, enabled) VALUES ('daily_spotlight', false) ON CONFLICT (key) DO NOTHING;
