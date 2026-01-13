-- Migration: Add fuzzy search function for curated_podcast_episodes
-- Run this in Supabase SQL Editor

-- Enable pg_trgm extension for fuzzy matching (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function for fuzzy matching curated episodes
CREATE OR REPLACE FUNCTION search_curated_episodes(
  search_title text,
  search_author text
)
RETURNS TABLE (
  id uuid,
  collection_id bigint,
  podcast_name text,
  episode_title text,
  episode_url text,
  audio_url text,
  episode_summary text,
  podcast_summary text,
  length_minutes integer,
  air_date date,
  book_title text,
  book_author text,
  relevance_score numeric
) 
LANGUAGE plpgsql
AS $$
DECLARE
  clean_title text;
  clean_author text;
BEGIN
  -- Clean the search terms (remove parentheticals like "(novel)", normalize)
  clean_title := lower(regexp_replace(search_title, '\s*\([^)]+\)\s*$', '', 'g'));
  clean_author := lower(trim(search_author));
  
  RETURN QUERY
  SELECT 
    cpe.id,
    cpe.collection_id,
    cpe.podcast_name,
    cpe.episode_title,
    cpe.episode_url,
    cpe.audio_url,
    cpe.episode_summary,
    cpe.podcast_summary,
    cpe.length_minutes,
    cpe.air_date,
    cpe.book_title,
    cpe.book_author,
    (
      -- Exact matches (highest score)
      CASE WHEN lower(cpe.book_title) = clean_title THEN 200 ELSE 0 END +
      CASE WHEN lower(cpe.book_author) = clean_author THEN 150 ELSE 0 END +
      
      -- Substring matches
      CASE WHEN lower(cpe.book_title) LIKE '%' || clean_title || '%' THEN 100 ELSE 0 END +
      CASE WHEN lower(cpe.book_author) LIKE '%' || clean_author || '%' THEN 80 ELSE 0 END +
      CASE WHEN lower(cpe.episode_title) LIKE '%' || clean_title || '%' THEN 60 ELSE 0 END +
      CASE WHEN lower(cpe.episode_title) LIKE '%' || clean_author || '%' THEN 40 ELSE 0 END +
      
      -- Trigram similarity (fuzzy matching) - handles variations like "Golden Hill" vs "Golden Hill (novel)"
      COALESCE(similarity(lower(cpe.book_title), clean_title) * 90, 0) +
      COALESCE(similarity(lower(cpe.book_author), clean_author) * 70, 0) +
      COALESCE(similarity(lower(cpe.episode_title), clean_title) * 50, 0) +
      
      -- Word-by-word matching using similarity
      COALESCE(
        GREATEST(
          similarity(lower(cpe.book_title), clean_title),
          similarity(lower(cpe.episode_title), clean_title)
        ) * 40,
        0
      )
    )::numeric as relevance_score
  FROM curated_podcast_episodes cpe
  WHERE 
    -- Broad search conditions (catches everything, then ranks)
    -- Only search in book_title, book_author, and episode_title (not episode_summary)
    lower(cpe.book_title) LIKE '%' || clean_title || '%' OR
    lower(cpe.book_author) LIKE '%' || clean_author || '%' OR
    lower(cpe.episode_title) LIKE '%' || clean_title || '%' OR
    lower(cpe.episode_title) LIKE '%' || clean_author || '%' OR
    -- Trigram similarity threshold (0.3 = 30% similarity)
    similarity(lower(cpe.book_title), clean_title) > 0.3 OR
    similarity(lower(cpe.book_author), clean_author) > 0.3 OR
    similarity(lower(cpe.episode_title), clean_title) > 0.3
  ORDER BY relevance_score DESC, air_date DESC NULLS LAST
  LIMIT 10;
END;
$$;

-- Create GIN indexes for trigram similarity searches (speeds up fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_curated_episodes_book_title_trgm 
  ON curated_podcast_episodes USING gin (lower(book_title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_curated_episodes_book_author_trgm 
  ON curated_podcast_episodes USING gin (lower(book_author) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_curated_episodes_episode_title_trgm 
  ON curated_podcast_episodes USING gin (lower(episode_title) gin_trgm_ops);

-- Add comment to document the function
COMMENT ON FUNCTION search_curated_episodes IS 'Fuzzy search function for curated podcast episodes using trigram similarity. Handles variations like "Golden Hill" vs "Golden Hill (novel)" and author name variations.';
