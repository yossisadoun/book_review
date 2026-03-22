-- Add feature column to grok_usage_logs
ALTER TABLE grok_usage_logs ADD COLUMN IF NOT EXISTS feature text;

-- Backfill existing rows based on function_name mapping
UPDATE grok_usage_logs SET feature = CASE
  WHEN function_name = 'getGrokSuggestions' THEN 'search'
  WHEN function_name IN (
    'getBookSummary', 'getRelatedBooks', 'getGrokDiscussionQuestions',
    'getRelatedMovies', 'getGrokPodcastEpisodes', 'getGrokBookInfographic',
    'getGrokAuthorFacts', 'getFirstIssueYear', 'getGrokBookInfluences',
    'getGrokBookDomain', 'getGrokBookContext', 'getGrokDidYouKnow',
    'getGrokDidYouKnowWithSearch'
  ) THEN 'book_details'
  WHEN function_name IN (
    'getCharacterAvatars', 'generateSingleCharacterAvatar',
    'getCharacterContext', 'character_chat'
  ) THEN 'chat'
  WHEN function_name IN (
    'generateTriviaQuestionsForBook', 'generateTriviaQuestions'
  ) THEN 'trivia'
  ELSE 'other'
END
WHERE feature IS NULL;

-- Index for querying by feature
CREATE INDEX IF NOT EXISTS idx_grok_usage_logs_feature ON grok_usage_logs (feature);
