-- Migration: Add web_search_calls column to grok_usage_logs
-- Run this in the Supabase SQL Editor

-- Add column for tracking web search calls
ALTER TABLE grok_usage_logs
ADD COLUMN IF NOT EXISTS web_search_calls INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN grok_usage_logs.web_search_calls IS 'Number of web search API calls made during this Grok request';
