// --- Types & Constants ---
export const RATING_DIMENSIONS = ['writing'] as const;

export const GRADIENTS = [
  'from-rose-500 to-pink-600',
  'from-indigo-600 to-blue-700',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-600 to-fuchsia-600',
  'from-cyan-500 to-blue-500',
] as const;

// Podcast episode interface
export interface PodcastEpisode {
  title: string;
  length?: string;
  air_date?: string;
  url: string;
  audioUrl?: string; // Direct audio URL for playback (from Apple Podcasts episodeUrl)
  platform: string;
  podcast_name?: string; // Name of the podcast show
  episode_summary: string;
  podcast_summary: string;
  thumbnail?: string; // Episode or show thumbnail image URL
}

// Analysis article interface
export interface AnalysisArticle {
  title: string;
  snippet: string;
  url: string;
  authors?: string;
  year?: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  videoId: string;
  duration?: string;
}

export interface RelatedBook {
  title: string;
  author: string;
  reason: string;
  thumbnail?: string;
  cover_url?: string;
  publish_year?: number;
  wikipedia_url?: string;
  google_books_url?: string;
  genre?: string;
  apple_rating?: number;
  apple_rating_count?: number;
}

export interface MusicLinks {
  spotify?: string;
  appleMusic?: string;
  youtubeMusic?: string;
  tidal?: string;
  deezer?: string;
  amazonMusic?: string;
}

export interface WatchLinks {
  netflix?: string;
  prime?: string;
  disney?: string;
  hulu?: string;
  apple?: string;
  hbo?: string;
  paramount?: string;
  peacock?: string;
  tmdb_url?: string;
}

export interface RelatedMovie {
  title: string;
  director: string;
  reason: string;
  type: 'movie' | 'show' | 'album';
  poster_url?: string;
  release_year?: number;
  genre?: string;
  wikipedia_url?: string;
  itunes_url?: string;
  itunes_artwork?: string;
  music_links?: MusicLinks;
  watch_links?: WatchLinks;
}

export interface ResearchContentItem {
  source_url: string;
  trivia_fact: string;
  deep_insight: string;
}

export interface ResearchPillar {
  pillar_name: string;
  content_items: ResearchContentItem[];
}

export interface BookResearch {
  book_title: string;
  author: string;
  pillars: ResearchPillar[];
}

export interface DomainInsights {
  label: string;
  facts: string[];
}

// Did You Know insight item (3 notes that tell a mini-story)
export interface DidYouKnowItem {
  rank: number;
  notes: [string, string, string]; // Note 1 = fact, Note 2 = background, Note 3 = why it matters
  source_url?: string; // Web source URL for the insight
}

// Did You Know response from Grok
export interface DidYouKnowResponse {
  book: string;
  author: string;
  did_you_know_top10: DidYouKnowItem[];
}

// Book Summary (cheat sheet)
export interface BookSummaryCard {
  step: string;
  name: string;
  iconName: string;
  desc: string;
}

export interface BookSummaryTask {
  text: string;
}

export interface BookSummaryGlossary {
  term: string;
  def: string;
}

export interface BookSummary {
  title: string;
  author: string;
  readTime: string;
  category: string;
  gradient: string;
  quote: string;
  summary: string;
  cardsTitle: string;
  cards: BookSummaryCard[];
  actionTitle: string;
  tasks: BookSummaryTask[];
  glossaryTitle: string;
  glossary: BookSummaryGlossary[];
}

// Book Infographic types (orientation guide)
export interface InfographicCharacter {
  name: string;
  role: string;
  short_identity: string;
  personality: string;
  main_goal: string;
  key_connections: string[];
  why_reader_should_track: string;
}

export interface InfographicCharacterBrief {
  name: string;
  short_identity: string;
  group_or_side: string;
  importance: 'major' | 'supporting' | 'minor';
}

export interface InfographicPlotEvent {
  order: number;
  phase: 'opening' | 'early_setup' | 'early_story' | 'mid_story';
  event_label: string;
  what_happens: string;
  characters_involved: string[];
  why_it_helps_orientation: string;
  icon?: string; // Lucide icon name
}

export interface BookInfographic {
  book: string;
  author: string;
  core_cast: InfographicCharacter[];
  full_character_list: InfographicCharacterBrief[];
  plot_timeline: InfographicPlotEvent[];
}

// Feed item interface for community/following feed
export interface FeedItem {
  id: string;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  ratings: { writing: number | null; insights: number | null; flow: number | null; world: number | null; characters: number | null };
  updated_at: string;
}

// Personalized feed item from feed_items table
export interface PersonalizedFeedItem {
  id: string;
  user_id: string;
  source_book_id: string;
  source_book_title: string;
  source_book_author: string;
  source_book_cover_url: string | null;
  type: 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know' | 'related_work' | 'user_post';
  content: Record<string, any>;
  content_hash: string | null;
  reading_status: string | null;
  base_score: number;
  times_shown: number;
  last_shown_at: string | null;
  created_at: string;
  read: boolean;
  source_book_created_at: string | null;
  computed_score?: number;
}

// Supabase database schema interface
export type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;

export interface Book {
  id: string;
  user_id: string;
  canonical_book_id?: string; // Normalized identifier for deduplication
  title: string;
  author: string;
  publish_year?: number | null;
  first_issue_year?: number | null;
  genre?: string | null;
  isbn?: string | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  summary?: string | null; // Book synopsis/summary from Apple Books or Wikipedia
  apple_rating?: number | null; // Average user rating from Apple Books (0-5)
  apple_rating_count?: number | null; // Number of ratings on Apple Books
  rating_writing?: number | null;
  rating_insights?: number | null;
  rating_flow?: number | null;
  rating_world?: number | null;
  rating_characters?: number | null;
  reading_status?: ReadingStatus; // Reading status: 'read_it', 'reading', 'want_to_read', or null
  author_facts?: string[] | null; // JSON array of author facts
  podcast_episodes?: PodcastEpisode[] | null; // JSON array of podcast episodes (deprecated - use source-specific columns)
  podcast_episodes_grok?: PodcastEpisode[] | null; // JSON array of podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[] | null; // JSON array of podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[] | null; // JSON array of podcast episodes from curated source
  notes?: string | null; // User notes for the book
  lists?: string[] | null; // Custom user lists this book belongs to
  created_at: string;
  updated_at: string;
}

// Local app interface (for easier manipulation)
export interface BookWithRatings extends Omit<Book, 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> {
  ratings: {
    writing: number | null;
    insights: number | null;
    flow: number | null;
    world: number | null;
    characters: number | null;
  };
  reading_status?: ReadingStatus; // Reading status
  author_facts?: string[]; // Fun facts about the author
  podcast_episodes?: PodcastEpisode[]; // Podcast episodes about the book (deprecated - use source-specific)
  podcast_episodes_grok?: PodcastEpisode[]; // Podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[]; // Podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[]; // Podcast episodes from curated source
  notes?: string | null; // User notes for the book
  lists?: string[] | null; // Custom user lists this book belongs to
}

// Discussion questions interface
export interface DiscussionQuestion {
  id: number;
  question: string;
  category: 'themes' | 'characters' | 'writing style' | 'ethics' | 'personal reflection' | 'real world';
}

// Grok API usage logging
export interface GrokUsageLog {
  timestamp: string;
  function: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface GrokUsageInput {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  web_search_calls?: number;  // Number of web search calls made
}

export interface AuthorFactsResult {
  facts: string[];
  first_issue_year?: number | null;
}

// Get "Did You Know?" insights using Grok with web search (AI SDK)
export interface DidYouKnowWithSourcesResult {
  insights: DidYouKnowItem[];
  sources: any[]; // Sources from AI SDK (LanguageModelV3Source[])
}

// Type for the RPC function return value
export interface CuratedEpisodeResult {
  id: string;
  collection_id: number;
  podcast_name: string;
  episode_title: string;
  episode_url: string;
  audio_url: string | null;
  episode_summary: string;
  podcast_summary: string;
  length_minutes: number | null;
  air_date: string | null;
  book_title: string | null;
  book_author: string | null;
  relevance_score: number;
}

export type FeedItemType = 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know' | 'related_work';

export interface FeedItemContent {
  [key: string]: any;
}

export interface TriviaNote {
  fact: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
}
