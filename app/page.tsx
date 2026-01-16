'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Trash2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Library,
  Info,
  Sparkles,
  LogOut,
  Headphones,
  Play,
  FileText,
  Pencil,
  Grid3x3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { BookLoading } from '@/components/BookLoading';
import { supabase } from '@/lib/supabase';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

// Helper function to get the correct path for static assets (handles basePath)
function getAssetPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) return path;
  // Check if pathname starts with /book_review (GitHub Pages basePath)
  const pathname = window.location.pathname;
  if (pathname.startsWith('/book_review')) {
    return `/book_review${path}`;
  }
  return path;
}

// --- Types & Constants ---
const RATING_DIMENSIONS = ['writing', 'insights', 'flow', 'world', 'characters'] as const;
const grokApiKey = process.env.NEXT_PUBLIC_GROK_API_KEY || "";
const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";

const GRADIENTS = [
  'from-rose-500 to-pink-600',
  'from-indigo-600 to-blue-700',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-600 to-fuchsia-600',
  'from-cyan-500 to-blue-500',
] as const;

// Podcast episode interface
interface PodcastEpisode {
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
interface AnalysisArticle {
  title: string;
  snippet: string;
  url: string;
  authors?: string;
  year?: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  videoId: string;
}

interface RelatedBook {
  title: string;
  author: string;
  reason: string;
  thumbnail?: string;
  cover_url?: string;
  publish_year?: number;
  wikipedia_url?: string;
  google_books_url?: string;
  genre?: string;
}

// Supabase database schema interface
type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;

interface Book {
  id: string;
  user_id: string;
  canonical_book_id?: string; // Normalized identifier for deduplication
  title: string;
  author: string;
  publish_year?: number | null;
  genre?: string | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
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
  created_at: string;
  updated_at: string;
}

// Local app interface (for easier manipulation)
interface BookWithRatings extends Omit<Book, 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> {
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
}

// --- API Helpers ---

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      
      // CRITICAL: Log the actual error response body - this will tell us why mobile fails
      let errorBody = '';
      try {
        errorBody = await res.text();
        console.error(`[fetchWithRetry] HTTP ${res.status} error response:`, errorBody);
        // Try to parse as JSON if possible
        try {
          const errorJson = JSON.parse(errorBody);
          console.error(`[fetchWithRetry] Parsed error JSON:`, errorJson);
        } catch (e) {
          // Not JSON, that's fine
        }
      } catch (e) {
        console.error(`[fetchWithRetry] Could not read error response body:`, e);
      }
      
      // Handle rate limiting (429) with exponential backoff
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * Math.pow(2, i);
        
        if (i === retries - 1) {
          console.warn('Rate limit exceeded. Please try again later.');
          throw new Error('Rate limit exceeded');
        }
        
        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For 400 errors, log and throw immediately (don't retry bad requests)
      if (res.status === 400) {
        console.error(`[fetchWithRetry] ❌ Bad Request (400) - This often indicates a mobile browser issue`);
        console.error(`[fetchWithRetry] Error response:`, errorBody);
        throw new Error(`HTTP 400: ${errorBody || 'Bad Request'}`);
      }
      
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        if (i === retries - 1) throw new Error(`HTTP ${res.status}: ${errorBody || ''}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${errorBody || ''}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

function first4DigitYear(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

// --- AI Functions (using Grok) ---
async function getGrokSuggestions(query: string): Promise<string[]> {
  if (!grokApiKey) return [];
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.book_suggestions.prompt, { query });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };

  console.log('[getGrokSuggestions] 🔵 RAW GROK REQUEST URL:', url);
  console.log('[getGrokSuggestions] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    });
    console.log('[getGrokSuggestions] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));
    const content = data.choices?.[0]?.message?.content || '{"suggestions":[]}';
    console.log('[getGrokSuggestions] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    console.log('[getGrokSuggestions] 🔵 PARSED JSON:', parsed);
    return parsed.suggestions || [];
  } catch (err: any) {
    console.error('Grok suggestions error:', err);
    console.error('Error details:', err.message, err.stack);
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    return [];
  }
}

async function getGrokAuthorFacts(bookTitle: string, author: string): Promise<string[]> {
  console.log('[getGrokAuthorFacts] Called for:', bookTitle, 'by', author);
  
  if (!grokApiKey) {
    console.warn('[getGrokAuthorFacts] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return [];
  }
  
  console.log('[getGrokAuthorFacts] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.author_facts.prompt, { author, bookTitle });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };

  console.log('[getGrokAuthorFacts] 🔵 RAW GROK REQUEST URL:', url);
  console.log('[getGrokAuthorFacts] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));
  console.log('[getGrokAuthorFacts] 🔵 FORMATTED PROMPT:', prompt);

  try {
    console.log('[getGrokAuthorFacts] Making request to Grok API...');
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    console.log('[getGrokAuthorFacts] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    console.log('[getGrokAuthorFacts] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokAuthorFacts] 🔵 PARSED JSON:', result);
    console.log('[getGrokAuthorFacts] Parsed facts:', result.facts?.length || 0, 'facts');
    return result.facts || [];
  } catch (err: any) {
    console.error('[getGrokAuthorFacts] Error:', err);
    console.error('[getGrokAuthorFacts] Error details:', err.message, err.stack);
    
    // Enhanced error logging for mobile debugging
    if (err.message?.includes('400')) {
      console.error('[getGrokAuthorFacts] ❌ Bad Request (400) - Mobile browser issue detected');
      console.error('[getGrokAuthorFacts] Model used:', payload.model);
      console.error('[getGrokAuthorFacts] Request URL:', url);
      console.error('[getGrokAuthorFacts] Full error message:', err.message);
      console.error('[getGrokAuthorFacts] Payload size:', JSON.stringify(payload).length, 'bytes');
    }
    
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    
    return [];
  }
}

// AI functions (using Grok)
async function getAISuggestions(query: string): Promise<string[]> {
  return getGrokSuggestions(query);
}

async function getAuthorFacts(bookTitle: string, author: string): Promise<string[]> {
  console.log(`[getAuthorFacts] 🔄 Fetching from Grok API for "${bookTitle}" by ${author}`);
  return getGrokAuthorFacts(bookTitle, author);
}

// Get podcast episodes from Grok
async function getGrokPodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
  if (!grokApiKey) {
    console.warn('[getGrokPodcastEpisodes] API key is missing!');
    return [];
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.podcast_episodes.prompt, { bookTitle, author });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.7
  };

  console.log('[getGrokPodcastEpisodes] 🔵 RAW GROK REQUEST URL:', url);
  console.log('[getGrokPodcastEpisodes] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));
  console.log('[getGrokPodcastEpisodes] 🔵 FORMATTED PROMPT:', prompt);

  try {
    console.log(`[getGrokPodcastEpisodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${author}...`);
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    console.log('[getGrokPodcastEpisodes] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));
    const content = data.choices?.[0]?.message?.content || '{"episodes":[]}';
    console.log('[getGrokPodcastEpisodes] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokPodcastEpisodes] 🔵 PARSED JSON:', result);
    const episodes = result.episodes || [];
    
    // Log URLs to check for truncation
    episodes.forEach((ep: PodcastEpisode, idx: number) => {
      console.log(`[getGrokPodcastEpisodes] Episode ${idx + 1} URL (length: ${ep.url?.length}):`, ep.url);
      if (ep.url && ep.url.length < 20) {
        console.warn(`[getGrokPodcastEpisodes] ⚠️ Episode ${idx + 1} URL seems truncated:`, ep.url);
      }
    });
    
    console.log(`[getGrokPodcastEpisodes] ✅ Received ${episodes.length} podcast episodes for "${bookTitle}"`);
    return episodes;
  } catch (err: any) {
    console.error('[getGrokPodcastEpisodes] ❌ Error:', err);
    console.error('[getGrokPodcastEpisodes] Error details:', err.message, err.stack);
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    return [];
  }
}

// --- Apple Podcasts API ---

// Prioritized book podcast shows (collectionId)
const PRIORITIZED_PODCAST_SHOWS: Record<string, number> = {
  "The Book Club Review": 1215730246,
  "The Book Review (by The New York Times)": 120315179,
  "Book Riot – The Podcast (All the Books!)": 993284374,
  "Overdue": 602003021,
  "Backlisted": 892817183,
  "If Books Could Kill": 1660908304,
  "World Book Club": 309595551,
  "Book Club with Michael Smerconish": 1522088009,
  "New Books Network": 150548015,
  "Reading Glasses": 1393888875,
};

// Create a Set of prioritized collectionIds for fast lookup
const PRIORITIZED_COLLECTION_IDS = new Set(Object.values(PRIORITIZED_PODCAST_SHOWS));

async function getApplePodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
  try {
    console.log(`[getApplePodcastEpisodes] 🔄 Searching Apple Podcasts for episodes about "${bookTitle}" by ${author}...`);
    
    // Search directly for podcast episodes - fetch top 20
    const searchTerm = `${bookTitle} ${author}`;
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=podcast&entity=podcastEpisode&limit=20`;
    
    const searchData = await fetchWithRetry(searchUrl);
    console.log('[getApplePodcastEpisodes] 🍎 RAW APPLE PODCASTS EPISODES SEARCH RESPONSE:', JSON.stringify(searchData, null, 2));
    const episodes = searchData?.results || [];
    
    if (episodes.length === 0) {
      console.log(`[getApplePodcastEpisodes] ⚠️ No episodes found for "${bookTitle}"`);
      return [];
    }
    
    const bookTitleLower = bookTitle.toLowerCase();
    const authorLower = author.toLowerCase();
    
    // Process episodes while preserving Apple's original order
    const prioritizedEpisodes: PodcastEpisode[] = [];
    const otherEpisodes: PodcastEpisode[] = [];
    
    for (const ep of episodes) {
      // Filter episodes that mention the book title or author in the title or description
      const episodeTitle = (ep.trackName || '').toLowerCase();
      const episodeDescription = (ep.description || '').toLowerCase();
      
      // Check if episode title or description mentions the book or author
      const mentionsBook = episodeTitle.includes(bookTitleLower) || episodeDescription.includes(bookTitleLower);
      const mentionsAuthor = episodeTitle.includes(authorLower) || episodeDescription.includes(authorLower);
      
      if (mentionsBook || mentionsAuthor) {
        // Convert duration from milliseconds to minutes
        const durationMs = ep.trackTimeMillis || 0;
        const durationMinutes = Math.round(durationMs / 60000);
        const length = durationMinutes > 0 ? `${durationMinutes} min` : undefined;
        
        // Format release date
        let airDate: string | undefined = undefined;
        if (ep.releaseDate) {
          try {
            const date = new Date(ep.releaseDate);
            airDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          } catch (e) {
            airDate = ep.releaseDate;
          }
        }
        
        // Get thumbnail - prefer episode artwork, fallback to collection (show) artwork
        // iTunes API provides: artworkUrl60, artworkUrl100, artworkUrl600 for episodes
        // Episodes may also have collection artwork if episode artwork is missing
        const thumbnail = ep.artworkUrl600 
          ? ep.artworkUrl600.replace('600x600bb', '300x300bb')
          : ep.artworkUrl100 
          ? ep.artworkUrl100.replace('100x100bb', '300x300bb')
          : ep.artworkUrl60
          ? ep.artworkUrl60.replace('60x60bb', '300x300bb')
          : undefined;
        
        const episode: PodcastEpisode = {
          title: ep.trackName || 'Untitled Episode',
          length: length,
          air_date: airDate,
          url: ep.trackViewUrl || ep.episodeUrl || '',
          audioUrl: ep.episodeUrl || undefined, // Direct audio URL for playback
          platform: 'Apple Podcasts',
          podcast_name: ep.collectionName || undefined,
          episode_summary: ep.description || `Episode about ${bookTitle} by ${author}`,
          podcast_summary: ep.collectionName || 'Podcast',
          thumbnail: thumbnail,
        };
        
        // Check if this episode is from a prioritized show
        const collectionId = ep.collectionId;
        const isPrioritized = collectionId && PRIORITIZED_COLLECTION_IDS.has(collectionId);
        
        if (isPrioritized) {
          prioritizedEpisodes.push(episode);
        } else {
          otherEpisodes.push(episode);
        }
      }
    }
    
    // Remove duplicates based on URL (preserving order)
    const seenUrls = new Set<string>();
    const uniquePrioritized = prioritizedEpisodes.filter(ep => {
      if (seenUrls.has(ep.url)) return false;
      seenUrls.add(ep.url);
      return true;
    });
    
    const uniqueOther = otherEpisodes.filter(ep => {
      if (seenUrls.has(ep.url)) return false;
      seenUrls.add(ep.url);
      return true;
    });
    
    // Combine: prioritized first (in Apple's original order), then others (in Apple's original order)
    const finalEpisodes = [...uniquePrioritized, ...uniqueOther].slice(0, 10);
    
    console.log(`[getApplePodcastEpisodes] ✅ Found ${finalEpisodes.length} episodes for "${bookTitle}" (${uniquePrioritized.length} from prioritized shows, ${uniqueOther.length} others)`);
    return finalEpisodes;
  } catch (err: any) {
    console.error('[getApplePodcastEpisodes] ❌ Error:', err);
    return [];
  }
}

// Type for the RPC function return value
interface CuratedEpisodeResult {
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

// --- Curated Podcast Episodes (from Supabase) ---
async function getCuratedPodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
  try {
    console.log(`[getCuratedPodcastEpisodes] 🔄 Searching curated episodes for "${bookTitle}" by ${author}...`);
    
    // Call the PostgreSQL function for fuzzy matching
    const { data, error } = await supabase.rpc('search_curated_episodes', {
      search_title: bookTitle,
      search_author: author
    }) as { data: CuratedEpisodeResult[] | null; error: any };

    if (error) {
      console.error('[getCuratedPodcastEpisodes] Supabase error:', error);
      // If function doesn't exist, fall back to simple search
      if (error.message?.includes('function') || error.code === '42883') {
        console.warn('[getCuratedPodcastEpisodes] Function not found, using fallback search');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('curated_podcast_episodes')
          .select('*')
          .or(`book_title.ilike.%${bookTitle}%,book_author.ilike.%${author}%,episode_title.ilike.%${bookTitle}%,episode_title.ilike.%${author}%`)
          .order('air_date', { ascending: false })
          .limit(10);
        
        if (fallbackError) throw fallbackError;
        if (!fallbackData || fallbackData.length === 0) {
          console.log(`[getCuratedPodcastEpisodes] ⚠️ No curated episodes found for "${bookTitle}"`);
          return [];
        }
        
        const episodes: PodcastEpisode[] = fallbackData.map((ep: any) => ({
          title: ep.episode_title || 'Untitled Episode',
          length: ep.length_minutes ? `${ep.length_minutes} min` : undefined,
          air_date: ep.air_date ? new Date(ep.air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : undefined,
          url: ep.episode_url || '',
          audioUrl: ep.audio_url || undefined,
          platform: 'Curated',
          podcast_name: ep.podcast_name || undefined,
          episode_summary: ep.episode_summary || `Episode about ${bookTitle} by ${author}`,
          podcast_summary: ep.podcast_summary || ep.podcast_name || 'Podcast',
        }));
        
        console.log(`[getCuratedPodcastEpisodes] ✅ Found ${episodes.length} curated episodes for "${bookTitle}" (fallback mode)`);
        return episodes;
      }
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`[getCuratedPodcastEpisodes] ⚠️ No curated episodes found for "${bookTitle}"`);
      return [];
    }

    const episodes: PodcastEpisode[] = data.map((ep: CuratedEpisodeResult) => ({
      title: ep.episode_title || 'Untitled Episode',
      length: ep.length_minutes ? `${ep.length_minutes} min` : undefined,
      air_date: ep.air_date ? new Date(ep.air_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : undefined,
      url: ep.episode_url || '',
      audioUrl: ep.audio_url || undefined,
      platform: 'Curated',
      podcast_name: ep.podcast_name || undefined,
      episode_summary: ep.episode_summary || `Episode about ${bookTitle} by ${author}`,
      podcast_summary: ep.podcast_summary || ep.podcast_name || 'Podcast',
    }));

    const topScore = data[0]?.relevance_score || 0;
    console.log(`[getCuratedPodcastEpisodes] ✅ Found ${episodes.length} curated episodes for "${bookTitle}" (top relevance score: ${topScore.toFixed(2)})`);
    return episodes;
  } catch (err: any) {
    console.error('[getCuratedPodcastEpisodes] ❌ Error:', err);
    return [];
  }
}

// --- Google Scholar API ---
async function getGoogleScholarAnalysis(bookTitle: string, author: string): Promise<AnalysisArticle[]> {
  console.log(`[getGoogleScholarAnalysis] 🔄 Searching Google Scholar for "${bookTitle}" by ${author}`);
  
  // Normalize for database lookup
  const normalizedTitle = bookTitle.trim().toLowerCase();
  const normalizedAuthor = author.trim().toLowerCase();
  
  // First, check if we have cached results in the database
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('google_scholar_articles')
      .select('articles')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.articles && Array.isArray(cachedData.articles) && cachedData.articles.length > 0) {
      // Check if it's not just the fallback search URL
      const firstArticle = cachedData.articles[0];
      if (firstArticle.url && !firstArticle.url.includes('scholar.google.com/scholar?q=')) {
        console.log(`[getGoogleScholarAnalysis] ✅ Found ${cachedData.articles.length} cached articles in database`);
        return cachedData.articles as AnalysisArticle[];
      } else if (firstArticle.title && firstArticle.title.includes('Search Google Scholar')) {
        // It's a fallback - we'll try to fetch again (maybe proxies will work this time)
        console.log(`[getGoogleScholarAnalysis] ⚠️ Found cached fallback, will try to fetch fresh results`);
      } else {
        console.log(`[getGoogleScholarAnalysis] ✅ Found ${cachedData.articles.length} cached articles in database`);
        return cachedData.articles as AnalysisArticle[];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getGoogleScholarAnalysis] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getGoogleScholarAnalysis] ⚠️ Error checking cache:', err);
    // Continue to fetch
  }
  
  // Construct search query: book title + author + (Analysis OR Review OR Criticism)
  const searchQuery = `"${bookTitle}" "${author}" (Analysis OR Review OR Criticism)`;
  const encodedQuery = encodeURIComponent(searchQuery);
  
  // Google Scholar search URL
  const searchUrl = `https://scholar.google.com/scholar?q=${encodedQuery}&hl=en&as_sdt=0,5`;
  
  // Try to fetch via proxy services (these are unreliable but worth trying)
  // If all fail, we'll return the search URL as fallback
  const proxyConfigs = [
    { 
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`,
      parser: async (response: Response) => {
        const data = await response.json();
        return data.contents;
      }
    },
    { 
      url: `https://corsproxy.io/?${encodeURIComponent(searchUrl)}`,
      parser: async (response: Response) => await response.text()
    },
    { 
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(searchUrl)}`,
      parser: async (response: Response) => await response.text()
    },
  ];
  
  // Try each proxy silently (don't log errors for 403/500 which are expected)
  for (let i = 0; i < proxyConfigs.length; i++) {
    const config = proxyConfigs[i];
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(config.url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Silently skip 403/500 errors (expected from proxies)
        continue;
      }
      
      const html = await config.parser(response);
      
      if (!html || typeof html !== 'string' || html.length < 100) {
        continue;
      }
      
      // Parse HTML to extract articles
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const articles: AnalysisArticle[] = [];
      
      // Try multiple selectors as Google Scholar HTML structure may vary
      let resultElements = doc.querySelectorAll('.gs_ri');
      if (resultElements.length === 0) {
        resultElements = doc.querySelectorAll('[data-rp]');
      }
      if (resultElements.length === 0) {
        resultElements = doc.querySelectorAll('.gs_r');
      }
      if (resultElements.length === 0) {
        resultElements = doc.querySelectorAll('div[class*="gs"]');
      }
      
      resultElements.forEach((element, index) => {
        if (index >= 10) return; // Limit to 10 results
        
        // Try multiple selectors for title and link
        let titleElement = element.querySelector('.gs_rt a') || 
                          element.querySelector('h3 a') ||
                          element.querySelector('h3.gs_rt a') ||
                          element.querySelector('a[data-clk]') ||
                          element.querySelector('a[href*="/scholar?"]');
        
        const title = titleElement?.textContent?.trim() || '';
        let url = titleElement?.getAttribute('href') || '';
        
        // Skip if no title or URL found
        if (!title || !url) return;
        
        // Fix relative URLs and extract actual article URLs
        if (url.startsWith('/url?q=')) {
          // Google Scholar redirect URL - extract the actual article URL
          const match = url.match(/url\?q=([^&]+)/);
          if (match) {
            url = decodeURIComponent(match[1]);
          }
        } else if (url.startsWith('/scholar?')) {
          // This is a Google Scholar link, not an article - skip it
          return;
        } else if (url.startsWith('/')) {
          url = `https://scholar.google.com${url}`;
        } else if (!url.startsWith('http')) {
          url = `https://scholar.google.com/${url}`;
        }
        
        // Only include if it's a real article URL (not a Google Scholar page)
        if (!url.startsWith('http') || url.includes('scholar.google.com/scholar')) {
          return;
        }
        
        // Try multiple selectors for snippet
        const snippetElement = element.querySelector('.gs_rs') || 
                              element.querySelector('.gs_rsb') ||
                              element.querySelector('.gs_s') ||
                              element.querySelector('[class*="snippet"]');
        const snippet = snippetElement?.textContent?.trim() || '';
        
        // Try multiple selectors for authors
        const authorsElement = element.querySelector('.gs_a') || 
                              element.querySelector('.gs_authors') ||
                              element.querySelector('[class*="author"]');
        const authorsText = authorsElement?.textContent?.trim() || '';
        const yearMatch = authorsText.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : undefined;
        
        articles.push({
          title,
          snippet: snippet ? (snippet.substring(0, 200) + (snippet.length > 200 ? '...' : '')) : 'No snippet available.',
          url,
          authors: authorsText || undefined,
          year,
        });
      });
      
      if (articles.length > 0) {
        console.log(`[getGoogleScholarAnalysis] ✅ Successfully fetched ${articles.length} articles from proxy ${i + 1}`);
        
        // Save to database
        await saveArticlesToDatabase(normalizedTitle, normalizedAuthor, articles);
        
        return articles;
      }
    } catch (err: any) {
      // Silently handle errors (proxies are unreliable)
      // Only log unexpected errors
      if (err.name !== 'AbortError' && !err.message?.includes('CORS') && !err.message?.includes('Failed to fetch') && !err.message?.includes('blocked')) {
        console.warn(`[getGoogleScholarAnalysis] ⚠️ Proxy ${i + 1} unexpected error:`, err.message);
      }
      // Continue to next proxy
    }
  }
  // All proxies failed - Google Scholar blocks scraping attempts
  // Don't save fallback URLs to database - only return for display
  console.log(`[getGoogleScholarAnalysis] ⚠️ Unable to fetch fresh results (proxies blocked). Returning search URL fallback (not saved to DB).`);
  
  const fallbackArticle: AnalysisArticle = {
    title: `Search Google Scholar for "${bookTitle}" by ${author}`,
    snippet: `Google Scholar blocks automated access. Click to view search results directly on Google Scholar.`,
    url: searchUrl,
  };
  
  // Return fallback for display, but don't save to database
  // Only real article results should be cached
  return [fallbackArticle];
}

// --- Related Books (Grok API) ---
async function getRelatedBooks(bookTitle: string, author: string): Promise<RelatedBook[]> {
  console.log(`[getRelatedBooks] 🔄 Fetching related books for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('related_books')
      .select('related_books')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.related_books && Array.isArray(cachedData.related_books) && cachedData.related_books.length > 0) {
      console.log(`[getRelatedBooks] ✅ Found ${cachedData.related_books.length} cached related books in database`);
      return cachedData.related_books as RelatedBook[];
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getRelatedBooks] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getRelatedBooks] ⚠️ Error checking cache:', err);
    // Continue to fetch from Grok
  }
  
  if (!grokApiKey || grokApiKey.trim() === '') {
    console.warn('[getRelatedBooks] ⚠️ Grok API key not found or empty');
    console.warn('[getRelatedBooks] Key length:', grokApiKey?.length || 0);
    console.warn('[getRelatedBooks] ⚠️ Cannot fetch related books without API key. Please check NEXT_PUBLIC_GROK_API_KEY in GitHub secrets.');
    return [];
  }
  
  // Validate API key format (should be a reasonable length)
  if (grokApiKey.length < 20) {
    console.warn('[getRelatedBooks] ⚠️ Grok API key appears to be invalid (too short)');
    console.warn('[getRelatedBooks] ⚠️ Please verify NEXT_PUBLIC_GROK_API_KEY in GitHub secrets is correct.');
    return [];
  }

  try {
    const prompts = await loadPrompts();
    
    // Safety check: ensure related_books prompt exists
    if (!prompts.related_books || !prompts.related_books.prompt) {
      console.error('[getRelatedBooks] ❌ related_books prompt not found in prompts config');
      console.error('[getRelatedBooks] Available prompts:', Object.keys(prompts));
      return [];
    }
    
    const prompt = formatPrompt(prompts.related_books.prompt, { bookTitle, author });

    const payload = {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: "grok-4-1-fast-non-reasoning",
      stream: false,
      temperature: 0.7
    };

    console.log('[getRelatedBooks] 🔵 Making request to Grok API...');
    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    const content = data.choices?.[0]?.message?.content || '[]';
    console.log('[getRelatedBooks] 🔵 RAW CONTENT:', content);
    
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    
    const relatedBooks: RelatedBook[] = Array.isArray(result) ? result : [];
    console.log('[getRelatedBooks] ✅ Received', relatedBooks.length, 'related books from Grok');
    
    // Enrich each book with Apple Books data (async, in parallel)
    const enrichedBooks = await Promise.all(
      relatedBooks.map(async (book) => {
        try {
          // Search Apple Books for this book
          const searchQuery = `${book.title} ${book.author}`;
          console.log(`[getRelatedBooks] 🔍 Searching Apple Books for: "${searchQuery}"`);
          
          const appleBooks = await lookupBooksOnAppleBooks(searchQuery);
          
          if (appleBooks.length > 0) {
            // Find best match (prefer exact title match)
            const bookTitleLower = book.title.toLowerCase();
            let bestMatch = appleBooks[0];
            
            for (const appleBook of appleBooks) {
              const appleTitleLower = (appleBook.title || '').toLowerCase();
              if (appleTitleLower === bookTitleLower) {
                bestMatch = appleBook;
                break;
              }
            }
            
            // Enrich with Apple Books data
            return {
              ...book,
              thumbnail: bestMatch.cover_url || undefined,
              cover_url: bestMatch.cover_url || undefined,
              publish_year: bestMatch.publish_year ?? undefined,
              google_books_url: bestMatch.google_books_url || undefined,
              genre: bestMatch.genre || undefined,
            };
          }
          
          return book;
        } catch (err) {
          console.error(`[getRelatedBooks] ⚠️ Error enriching book "${book.title}":`, err);
          return book; // Return original if enrichment fails
        }
      })
    );
    
    console.log('[getRelatedBooks] ✅ Enriched', enrichedBooks.length, 'related books');
    
    // Save to database cache
    await saveRelatedBooksToDatabase(bookTitle, author, enrichedBooks);
    
    return enrichedBooks;
  } catch (err: any) {
    console.error('[getRelatedBooks] ❌ Error:', err);
    return [];
  }
}

// Helper function to save related books to database
async function saveRelatedBooksToDatabase(bookTitle: string, bookAuthor: string, relatedBooks: RelatedBook[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('related_books')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveRelatedBooksToDatabase] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      related_books: relatedBooks,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('related_books')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('related_books')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveRelatedBooksToDatabase] ❌ Error saving related books:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        fullError: result.error
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveRelatedBooksToDatabase] ⚠️ Table "related_books" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveRelatedBooksToDatabase] ✅ Saved ${relatedBooks.length} related books to database`);
    }
  } catch (err: any) {
    console.error('[saveRelatedBooksToDatabase] ❌ Unexpected error:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
  }
}

// --- YouTube Data API ---
async function getYouTubeVideos(bookTitle: string, author: string): Promise<YouTubeVideo[]> {
  console.log(`[getYouTubeVideos] 🔄 Searching YouTube for "${bookTitle}" by ${author}`);
  
  if (!youtubeApiKey || youtubeApiKey.trim() === '') {
    console.warn('[getYouTubeVideos] ⚠️ YouTube API key not found or empty');
    console.warn('[getYouTubeVideos] Key length:', youtubeApiKey?.length || 0);
    console.warn('[getYouTubeVideos] ⚠️ Please check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets');
    return [];
  }
  
  // Validate API key format (YouTube API keys typically start with specific patterns)
  if (youtubeApiKey.length < 20) {
    console.warn('[getYouTubeVideos] ⚠️ YouTube API key appears to be invalid (too short)');
    console.warn('[getYouTubeVideos] ⚠️ Please verify NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets is correct');
    return [];
  }

  try {
    const videos: YouTubeVideo[] = [];
    
    // Query 1: Book title + author
    const query1 = `${bookTitle} ${author}`;
    const url1 = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query1)}&type=video&maxResults=5&key=${youtubeApiKey}`;
    
    console.log(`[getYouTubeVideos] 🔍 Query 1: "${query1}"`);
    const response1 = await fetch(url1);
    if (response1.ok) {
      const data1 = await response1.json();
      if (data1.items) {
        data1.items.forEach((item: any) => {
          videos.push({
            id: item.id.videoId,
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description || '',
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
          });
        });
      }
    } else {
      const errorData = await response1.json().catch(() => ({}));
      console.error(`[getYouTubeVideos] ❌ Query 1 failed: ${response1.status} ${response1.statusText}`, errorData);
    }
    
    // Query 2: Author + "interview"
    const query2 = `${author} interview`;
    const url2 = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query2)}&type=video&maxResults=5&key=${youtubeApiKey}`;
    
    console.log(`[getYouTubeVideos] 🔍 Query 2: "${query2}"`);
    const response2 = await fetch(url2);
    if (response2.ok) {
      const data2 = await response2.json();
      if (data2.items) {
        data2.items.forEach((item: any) => {
          // Avoid duplicates
          if (!videos.find(v => v.videoId === item.id.videoId)) {
            videos.push({
              id: item.id.videoId,
              videoId: item.id.videoId,
              title: item.snippet.title,
              description: item.snippet.description || '',
              thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || '',
              channelTitle: item.snippet.channelTitle,
              publishedAt: item.snippet.publishedAt,
            });
          }
        });
      }
    } else {
      const errorData = await response2.json().catch(() => ({}));
      console.error(`[getYouTubeVideos] ❌ Query 2 failed: ${response2.status} ${response2.statusText}`, errorData);
    }
    
    // Limit to top 10 videos
    const limitedVideos = videos.slice(0, 10);
    console.log(`[getYouTubeVideos] ✅ Found ${limitedVideos.length} videos`);
    return limitedVideos;
  } catch (err: any) {
    console.error('[getYouTubeVideos] ❌ Error:', err);
    console.error('[getYouTubeVideos] Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack
    });
    
    // Check for specific API errors
    if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
      console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 - check API key permissions and quota');
    } else if (err.message?.includes('400') || err.message?.includes('Bad Request')) {
      console.error('[getYouTubeVideos] ⚠️ YouTube API returned 400 - check API key validity');
    }
    
    return [];
  }
}

// Helper function to save articles to database
async function saveArticlesToDatabase(bookTitle: string, bookAuthor: string, articles: AnalysisArticle[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('google_scholar_articles')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveArticlesToDatabase] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      articles: articles,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('google_scholar_articles')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('google_scholar_articles')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveArticlesToDatabase] ❌ Error saving articles:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        fullError: result.error
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveArticlesToDatabase] ⚠️ Table "google_scholar_articles" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveArticlesToDatabase] ✅ Saved ${articles.length} articles to database`);
    }
  } catch (err: any) {
    console.error('[saveArticlesToDatabase] ❌ Unexpected error:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
  }
}

async function getPodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
  console.log(`[getPodcastEpisodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${author} from both sources`);
  
  // Fetch both sources in parallel
  const [curatedEpisodes, appleEpisodes] = await Promise.all([
    getCuratedPodcastEpisodes(bookTitle, author).catch(err => {
      console.error('[getPodcastEpisodes] ⚠️ Error fetching curated episodes:', err);
      return [];
    }),
    getApplePodcastEpisodes(bookTitle, author).catch(err => {
      console.error('[getPodcastEpisodes] ⚠️ Error fetching Apple episodes:', err);
      return [];
    })
  ]);
  
  // Combine: curated first, then Apple (avoid duplicates by URL)
  const seenUrls = new Set<string>();
  const combined: PodcastEpisode[] = [];
  
  // Add curated episodes first
  curatedEpisodes.forEach(ep => {
    if (ep.url && !seenUrls.has(ep.url)) {
      seenUrls.add(ep.url);
      combined.push(ep);
    }
  });
  
  // Add Apple episodes (excluding duplicates)
  appleEpisodes.forEach(ep => {
    if (ep.url && !seenUrls.has(ep.url)) {
      seenUrls.add(ep.url);
      combined.push(ep);
    }
  });
  
  console.log(`[getPodcastEpisodes] ✅ Combined ${combined.length} episodes (${curatedEpisodes.length} curated + ${appleEpisodes.length} Apple, ${curatedEpisodes.length + appleEpisodes.length - combined.length} duplicates removed)`);
  
  return combined;
}

// --- Apple Books API (iTunes Search) ---
async function lookupBooksOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
  try {
    // Use iTunes Search API to search for books (ebooks)
    const country = isHebrew(query) ? 'il' : 'us';
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=${country}&media=ebook&limit=10`;
    const data = await fetchWithRetry(searchUrl);
    
    if (!data.results || data.results.length === 0) {
      console.log(`[lookupBooksOnAppleBooks] No results found for: "${query}"`);
      return [];
    }
    
    // Sort results: exact matches first, then close matches, then others
    const queryLower = query.toLowerCase();
    const sortedResults = [...data.results].sort((a: any, b: any) => {
      const aTitle = a.trackName?.toLowerCase() || '';
      const bTitle = b.trackName?.toLowerCase() || '';
      const aExact = aTitle === queryLower ? 3 : aTitle.includes(queryLower) || queryLower.includes(aTitle) ? 2 : 1;
      const bExact = bTitle === queryLower ? 3 : bTitle.includes(queryLower) || queryLower.includes(bTitle) ? 2 : 1;
      return bExact - aExact;
    });
    
    // Take top 6 results
    const topResults = sortedResults.slice(0, 6);
    
    const books = topResults.map((item: any) => {
      const title = item.trackName || query;
      const author = item.artistName || 'Unknown Author';
      
      // Extract publish year from releaseDate
      let publishYear: number | undefined = undefined;
      if (item.releaseDate) {
        const yearMatch = item.releaseDate.match(/\d{4}/);
        if (yearMatch) {
          publishYear = parseInt(yearMatch[0]);
        }
      }
      
      // Extract genre - use primaryGenreName or first genre from genres array
      let genre: string | undefined = undefined;
      if (item.primaryGenreName) {
        // Take first word if genre has multiple words (e.g., "Fiction" from "Literary Fiction")
        genre = item.primaryGenreName.split(' ')[0];
      } else if (item.genres && Array.isArray(item.genres) && item.genres.length > 0) {
        genre = item.genres[0].split(' ')[0];
      }
      
      // Get cover image
      const coverUrl = item.artworkUrl100 
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : item.artworkUrl512 || null;
      
      // Get Apple Books URL
      const appleBooksUrl = item.trackViewUrl || null;

      return {
        title: title,
        author: author,
        publish_year: publishYear,
        genre: genre,
        cover_url: coverUrl,
        wikipedia_url: null,
        google_books_url: appleBooksUrl,
      };
    });

    console.log(`[lookupBooksOnAppleBooks] ✅ Found ${books.length} books`);
    return books;
  } catch (err) {
    console.error('[lookupBooksOnAppleBooks] ❌ Error searching Apple Books:', err);
    return [];
  }
}

// Legacy function for backward compatibility
async function lookupBookOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null> {
  const books = await lookupBooksOnAppleBooks(query);
  return books.length > 0 ? books[0] : null;
}

// --- Grok Book Search ---
async function lookupBooksOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
  // For now, Grok returns a single result, so we'll wrap it in an array
  const result = await lookupBookOnGrok(query);
  return result ? [result] : [];
}

async function lookupBookOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null> {
  if (!grokApiKey) {
    console.warn('[lookupBookOnGrok] API key is missing!');
    return null;
  }

  try {
    console.log(`[lookupBookOnGrok] 🔄 Searching for book: "${query}"`);
    
    const url = 'https://api.x.ai/v1/chat/completions';
    
    const prompts = await loadPrompts();
    if (!prompts.book_search || !prompts.book_search.prompt) {
      console.error('[lookupBookOnGrok] ❌ book_search prompt not found in prompts.yaml');
      return null;
    }
    const prompt = formatPrompt(prompts.book_search.prompt, { query });

    const payload = {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      model: "grok-4-1-fast-non-reasoning",
      stream: false,
      temperature: 0.7
    };

    console.log('[lookupBookOnGrok] 🔵 RAW GROK REQUEST URL:', url);
    console.log('[lookupBookOnGrok] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));
    console.log('[lookupBookOnGrok] 🔵 FORMATTED PROMPT:', prompt);

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('[lookupBookOnGrok] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[lookupBookOnGrok] ⚠️ No content in response');
      return null;
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let result;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error('[lookupBookOnGrok] ❌ Failed to parse JSON:', parseErr);
      console.error('[lookupBookOnGrok] Raw content:', content);
      return null;
    }

    console.log('[lookupBookOnGrok] 🔵 PARSED JSON:', result);

    // Check if result is null (book not found)
    if (result === null || !result.title) {
      console.log(`[lookupBookOnGrok] ⚠️ Book not found for query: "${query}"`);
      return null;
    }

    // Validate and return the book data
    const bookData = {
      title: result.title || query,
      author: result.author || 'Unknown Author',
      publish_year: result.publish_year || undefined,
      genre: result.genre || undefined,
      cover_url: result.cover_url || null,
      wikipedia_url: result.wikipedia_url || null,
      google_books_url: result.google_books_url || null,
    };

    console.log(`[lookupBookOnGrok] ✅ Found book: "${bookData.title}" by ${bookData.author}`);
    return bookData;
  } catch (err: any) {
    console.error('[lookupBookOnGrok] ❌ Error:', err);
    console.error('[lookupBookOnGrok] Error details:', err.message, err.stack);
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    return null;
  }
}

// --- Wikipedia/Wikidata Pipeline ---

async function getWikidataItemForTitle(pageTitle: string, lang = 'en'): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(pageTitle)}&prop=pageprops&ppprop=wikibase_item`;
  const data = await fetchWithRetry(url);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0] as any;
  return page?.pageprops?.wikibase_item ?? null;
}

async function getAuthorAndYearFromWikidata(qid: string, lang = 'en'): Promise<{ author: string; publishYear?: number; genre?: string }> {
  const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(qid)}&props=claims`;
  const entityData = await fetchWithRetry(entityUrl);
  const ent = entityData?.entities?.[qid];
  const claims = ent?.claims ?? {};

  const authorClaims = claims?.P50 ?? [];
  const authorIds = authorClaims.map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);

  const dateClaim = (claims?.P577?.[0] ?? claims?.P571?.[0]);
  const timeStr = dateClaim?.mainsnak?.datavalue?.value?.time; 
  const publishYear = first4DigitYear(timeStr);

  // Extract genre from P136 (genre property)
  let genre: string | undefined = undefined;
  const genreClaims = claims?.P136 ?? [];
  if (genreClaims.length > 0) {
    const genreId = genreClaims[0]?.mainsnak?.datavalue?.value?.id;
    if (genreId) {
      const genreUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(genreId)}&props=labels&languages=${lang}|en`;
      const genreData = await fetchWithRetry(genreUrl);
      const genreEntity = genreData?.entities?.[genreId];
      const genreLabel = genreEntity?.labels?.[lang]?.value || genreEntity?.labels?.en?.value;
      if (genreLabel) {
        // Take first word if genre has multiple words (e.g., "Fiction" from "Literary Fiction")
        genre = genreLabel.split(' ')[0];
      }
    }
  }

  let author = lang === 'he' ? "מחבר לא ידוע" : "Unknown Author";

  if (authorIds.length > 0) {
    const authorsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(authorIds.join("|"))}&props=labels&languages=${lang}|en`;
    const authorsData = await fetchWithRetry(authorsUrl);
    const labels = authorIds.map((id: string) => {
        const entity = authorsData?.entities?.[id];
        return entity?.labels?.[lang]?.value || entity?.labels?.en?.value;
    }).filter(Boolean);
    if (labels.length > 0) author = labels.join(", ");
  }
  return { author, publishYear, genre };
}

async function lookupBooksOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
  const lang = isHebrew(query) ? 'he' : 'en';
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=6`;
  const searchData = await fetchWithRetry(searchUrl);
  const results = searchData.query?.search || [];
  
  if (results.length === 0) {
    return [];
  }
  
  // Process top 6 results
  const books = await Promise.all(
    results.slice(0, 6).map(async (result: any) => {
      const pageTitle = result.title;
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const summaryData = await fetchWithRetry(summaryUrl);
      
      const qid = await getWikidataItemForTitle(pageTitle, lang);
      const { author, publishYear, genre } = qid ? await getAuthorAndYearFromWikidata(qid, lang) : { author: summaryData.extract?.split('(')[0]?.trim() || 'Unknown Author', publishYear: undefined, genre: undefined };
      
      return {
        title: summaryData.title || pageTitle,
        author: author,
        publish_year: publishYear,
        genre: genre,
        cover_url: summaryData.thumbnail?.source?.replace('http://', 'https://') || null,
        wikipedia_url: summaryData.content_urls?.desktop?.page || null,
        google_books_url: null,
      };
    })
  );
  
  return books;
}

async function lookupBookOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null> {
  const lang = isHebrew(query) ? 'he' : 'en';
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const searchData = await fetchWithRetry(searchUrl);
  const results = searchData.query?.search || [];
  if (results.length === 0) return null;

  const keywords = lang === 'he' 
    ? ["ספר", "רומן", "נובלה", "ביוגרפיה", "סיפור"] 
    : ["novel", "memoir", "non-fiction", "book", "biography", "fiction"];

  let bestCandidate = results.find((r: any) => 
    r.title.toLowerCase().includes(lang === 'he' ? "(ספר)" : "(book)") || 
    r.title.toLowerCase().includes(lang === 'he' ? "(רומן)" : "(novel)")
  );

  if (!bestCandidate) {
    bestCandidate = results.find((r: any) => keywords.some(kw => r.snippet.toLowerCase().includes(kw)));
  }
  if (!bestCandidate) bestCandidate = results[0];
  
  const pageTitle = bestCandidate.title;
  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
  const summaryData = await fetchWithRetry(summaryUrl);

  const qid = await getWikidataItemForTitle(pageTitle, lang);
  let author = lang === 'he' ? "מחבר לא ידוע" : "Unknown Author";
  let publishYear: number | undefined = undefined;
  
  let genre: string | undefined = undefined;
  if (qid) {
    const wdData = await getAuthorAndYearFromWikidata(qid, lang);
    author = wdData.author || author;
    publishYear = wdData.publishYear;
    genre = wdData.genre;
  }

  return {
    title: summaryData.title || pageTitle,
    author: author,
    publish_year: publishYear,
    genre: genre,
    cover_url: summaryData.thumbnail?.source || summaryData.originalimage?.source || null,
    wikipedia_url: summaryData.content_urls?.desktop?.page || null,
  };
}

// --- Utilities ---

// Extract dominant colors from an image and create a gradient
function extractColorsFromImage(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve('241,245,249,226,232,240'); // Default slate colors as RGB
          return;
        }
        
        // Scale down for performance
        const scale = 0.15;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Sample colors from different regions (more samples for better accuracy)
        const samplePoints = [
          { x: canvas.width * 0.1, y: canvas.height * 0.1 }, // Top-left
          { x: canvas.width * 0.9, y: canvas.height * 0.1 }, // Top-right
          { x: canvas.width * 0.5, y: canvas.height * 0.3 }, // Upper center
          { x: canvas.width * 0.5, y: canvas.height * 0.7 }, // Lower center
          { x: canvas.width * 0.1, y: canvas.height * 0.9 }, // Bottom-left
          { x: canvas.width * 0.9, y: canvas.height * 0.9 }, // Bottom-right
        ];
        
        const colors: number[][] = [];
        samplePoints.forEach(point => {
          const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
          const [r, g, b] = pixel.data;
          colors.push([r, g, b]);
        });
        
        // Calculate average color
        const avgColor = colors.reduce(
          (acc, color) => [acc[0] + color[0], acc[1] + color[1], acc[2] + color[2]],
          [0, 0, 0]
        ).map(sum => Math.floor(sum / colors.length));
        
        // Create a slightly darker/lighter complementary color for gradient
        // Lighten one direction, darken the other
        const lighten = (color: number[]) => [
          Math.min(255, Math.floor(color[0] * 1.2)),
          Math.min(255, Math.floor(color[1] * 1.2)),
          Math.min(255, Math.floor(color[2] * 1.2)),
        ];
        
        const darken = (color: number[]) => [
          Math.max(0, Math.floor(color[0] * 0.7)),
          Math.max(0, Math.floor(color[1] * 0.7)),
          Math.max(0, Math.floor(color[2] * 0.7)),
        ];
        
        // Use lighter and darker versions for gradient
        const color1 = lighten(avgColor);
        const color2 = darken(avgColor);
        
        // Return as RGB values separated by commas: "r1,g1,b1,r2,g2,b2"
        resolve(`${color1[0]},${color1[1]},${color1[2]},${color2[0]},${color2[1]},${color2[2]}`);
      } catch (err) {
        console.error('Error extracting colors:', err);
        resolve('241,245,249,226,232,240'); // Default slate colors
      }
    };
    
    img.onerror = () => {
      resolve('241,245,249,226,232,240'); // Default slate colors
    };
    
    img.src = imageUrl;
  });
}

function convertBookToApp(book: Book): BookWithRatings {
  // Parse author_facts if it's a string (shouldn't happen with JSONB, but be safe)
  let authorFacts: string[] | undefined = undefined;
  if (book.author_facts) {
    if (typeof book.author_facts === 'string') {
      try {
        authorFacts = JSON.parse(book.author_facts);
      } catch (e) {
        console.warn('[convertBookToApp] Failed to parse author_facts as JSON:', e);
        authorFacts = undefined;
      }
    } else if (Array.isArray(book.author_facts)) {
      authorFacts = book.author_facts;
    }
  }
  
  return {
    ...book,
    ratings: {
      writing: book.rating_writing ?? null,
      insights: book.rating_insights ?? null,
      flow: book.rating_flow ?? null,
      world: book.rating_world ?? null,
      characters: book.rating_characters ?? null,
    },
    reading_status: book.reading_status || null, // Load reading status from database
    author_facts: authorFacts, // Load from database (properly parsed)
    podcast_episodes: book.podcast_episodes || undefined, // Load from database (legacy)
    podcast_episodes_grok: book.podcast_episodes_grok || undefined, // Load from database
    podcast_episodes_apple: book.podcast_episodes_apple || undefined, // Load from database
    podcast_episodes_curated: book.podcast_episodes_curated || undefined, // Load from database
    notes: book.notes || null, // Load notes from database
  };
}

function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    title: book.title,
    author: book.author,
    publish_year: book.publish_year,
    genre: book.genre,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
    google_books_url: book.google_books_url,
    rating_writing: book.ratings.writing,
    rating_insights: book.ratings.insights,
    rating_flow: book.ratings.flow,
    rating_world: book.ratings.world,
    rating_characters: book.ratings.characters,
    reading_status: book.reading_status || null,
  };
}

function calculateAvg(ratings: BookWithRatings['ratings']): string | null {
  const values = Object.values(ratings).filter(v => v != null) as number[];
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

function calculateScore(ratings: BookWithRatings['ratings']): number {
  const values = Object.values(ratings).filter(v => v != null) as number[];
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

// --- UI Components ---

interface AuthorFactsTooltipsProps {
  facts: string[];
  bookId: string; // To reset when book changes
  isLoading?: boolean;
}

function AuthorFactsTooltips({ facts, bookId, isLoading = false }: AuthorFactsTooltipsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (facts.length === 0) return;

    // Show first fact after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [facts, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % facts.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : facts.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
        >
            <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (facts.length === 0 || currentIndex >= facts.length) return null;

  const currentFact = facts[currentIndex];

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${currentFact}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
          >
            <p className="text-xs font-medium text-slate-950 leading-relaxed text-center">
              💡 {currentFact}
            </p>
            <p className="text-xs text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
              Tap for next ({currentIndex + 1}/{facts.length})
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PodcastEpisodesProps {
  episodes: PodcastEpisode[];
  bookId: string;
  isLoading?: boolean;
}

function PodcastEpisodes({ episodes, bookId, isLoading = false }: PodcastEpisodesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    // Pause any playing audio when book changes
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }
    
    if (episodes.length === 0) return;

    // Show first episode after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [episodes, bookId]);

  // Pause audio when switching to a different episode card
  useEffect(() => {
    if (audioRef.current && playingAudioUrl) {
      audioRef.current.pause();
      setPlayingAudioUrl(null);
    }
  }, [currentIndex]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : episodes.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  function handlePlay(e: React.MouseEvent, episode: PodcastEpisode) {
    e.stopPropagation(); // Prevent card tap navigation
    
    // Use audioUrl if available, otherwise try to use the URL directly if it's an audio file
    const audioUrl = episode.audioUrl || (episode.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);
    const playableUrl = audioUrl || episode.url;
    
    if (audioUrl) {
      // If we have a direct audio URL, use HTML5 audio player
      if (playingAudioUrl === audioUrl) {
        // If already playing, pause it
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
      } else {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        
        // Play new audio
        setPlayingAudioUrl(audioUrl);
        // Create new audio element for each episode
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => {
          setPlayingAudioUrl(null);
        });
        audioRef.current.addEventListener('error', () => {
          // If audio fails, fall back to opening URL
          console.error('[PodcastEpisodes] Audio playback failed, opening URL:', episode.url);
          window.open(episode.url, '_blank');
          setPlayingAudioUrl(null);
        });
        audioRef.current.play();
      }
    } else {
      // No direct audio URL (e.g., Grok podcasts with web page URLs)
      // Toggle: if already "playing" (opened), close it; otherwise open in new tab
      if (playingAudioUrl === episode.url) {
        // Already opened, just clear the state
        setPlayingAudioUrl(null);
      } else {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          setPlayingAudioUrl(null);
        }
        // Open URL in new tab and mark as "playing" so button shows pause state
        setPlayingAudioUrl(episode.url);
        window.open(episode.url, '_blank');
        // Clear after a short delay since we can't actually pause an opened tab
        setTimeout(() => {
          setPlayingAudioUrl(null);
        }, 1000);
      }
    }
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (episodes.length === 0 || currentIndex >= episodes.length) return null;

  const currentEpisode = episodes[currentIndex];

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${currentEpisode.url}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
          >
            <div className="flex items-start gap-3 mb-2">
              {/* Thumbnail - show for Apple Podcasts */}
              {currentEpisode.thumbnail ? (
                <img 
                  src={currentEpisode.thumbnail} 
                  alt={currentEpisode.podcast_name || currentEpisode.title}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Headphones size={20} className="text-slate-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <a 
                  href={currentEpisode.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline block"
                >
                  {currentEpisode.title}
                </a>
              </div>
              {/* Play button - show for all podcast episodes */}
              {(() => {
                const audioUrl = currentEpisode.audioUrl || (currentEpisode.url && currentEpisode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? currentEpisode.url : null);
                const isPlaying = playingAudioUrl === (audioUrl || currentEpisode.url);
                return (
                  <button
                    onClick={(e) => handlePlay(e, currentEpisode)}
                    className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all active:scale-95 shadow-lg"
                    aria-label="Play episode"
                  >
                    <Play 
                      size={14} 
                      className={isPlaying ? 'hidden' : 'block'} 
                      fill="currentColor"
                    />
                    {isPlaying && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    )}
                  </button>
                );
              })()}
            </div>
            <div className="text-xs text-slate-700 space-y-1 mb-2">
              {currentEpisode.podcast_name && (
                <div className="font-bold text-slate-900">{currentEpisode.podcast_name}</div>
              )}
              {currentEpisode.platform && (
                <div className="font-semibold">{currentEpisode.platform}</div>
              )}
              {(currentEpisode.length || currentEpisode.air_date) && (
                <div className="flex gap-2">
                  {currentEpisode.length && <span>{currentEpisode.length}</span>}
                  {currentEpisode.air_date && <span>• {currentEpisode.air_date}</span>}
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-slate-800 leading-relaxed mb-1">
              {currentEpisode.episode_summary}
            </p>
            {currentEpisode.podcast_summary && (
              <p className="text-xs text-slate-600 italic">
                {currentEpisode.podcast_summary}
              </p>
            )}
            <p className="text-xs text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
              Tap for next ({currentIndex + 1}/{episodes.length})
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface YouTubeVideosProps {
  videos: YouTubeVideo[];
  bookId: string;
  isLoading?: boolean;
}

function YouTubeVideos({ videos, bookId, isLoading = false }: YouTubeVideosProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (videos.length === 0) return;

    // Show first video after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [videos, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % videos.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : videos.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (videos.length === 0 || currentIndex >= videos.length) {
    return (
      <div className="w-full">
        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
          <p className="text-xs text-slate-600 text-center">No videos found</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideo.videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${currentVideo.videoId}`;

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${currentVideo.videoId}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md rounded-xl overflow-hidden shadow-xl border border-white/30"
          >
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={embedUrl}
                title={currentVideo.title}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="p-4">
              <a 
                href={videoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline block mb-2 line-clamp-2"
              >
                {currentVideo.title}
              </a>
              <div className="text-xs text-slate-600 mb-2">
                <span>{currentVideo.channelTitle}</span>
                {currentVideo.publishedAt && (
                  <span> • {new Date(currentVideo.publishedAt).getFullYear()}</span>
                )}
              </div>
              {currentVideo.description && (
                <p className="text-xs text-slate-500 line-clamp-2">
                  {currentVideo.description}
                </p>
              )}
            </div>
            {videos.length > 1 && (
              <p className="text-xs text-slate-600 text-center pb-2 font-bold uppercase tracking-wider">
                Tap for next ({currentIndex + 1}/{videos.length})
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnalysisArticlesProps {
  articles: AnalysisArticle[];
  bookId: string;
  isLoading?: boolean;
}

function AnalysisArticles({ articles, bookId, isLoading = false }: AnalysisArticlesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (articles.length === 0) return;

    // Show first article after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [articles, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % articles.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : articles.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (articles.length === 0 || currentIndex >= articles.length) return null;

  const currentArticle = articles[currentIndex];

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${currentArticle.url}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <a 
                  href={currentArticle.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline block mb-1 line-clamp-2"
                >
                  {currentArticle.title}
                </a>
                {(currentArticle.authors || currentArticle.year) && (
                  <div className="text-xs text-slate-600">
                    {currentArticle.authors && <span>{currentArticle.authors}</span>}
                    {currentArticle.year && <span> • {currentArticle.year}</span>}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs font-medium text-slate-800 leading-relaxed mb-1">
              {currentArticle.snippet}
            </p>
            <p className="text-xs text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
              Tap for next ({currentIndex + 1}/{articles.length})
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RelatedBooksProps {
  books: RelatedBook[];
  bookId: string;
  isLoading?: boolean;
  onAddBook?: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
}

function RelatedBooks({ books, bookId, isLoading = false, onAddBook }: RelatedBooksProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (books.length === 0) return;

    // Show first book after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [books, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % books.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : books.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext(); // Swipe left = next
      } else {
        handlePrev(); // Swipe right = prev
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (books.length === 0 || currentIndex >= books.length) {
    return (
      <div className="w-full">
        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
          <p className="text-xs text-slate-600 text-center">No related books found</p>
        </div>
      </div>
    );
  }

  const currentBook = books[currentIndex];

  async function handleAddBook(e: React.MouseEvent) {
    e.stopPropagation(); // Prevent card flip
    
    if (!onAddBook) return;
    
    // Convert RelatedBook to Book metadata format
    const bookMeta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> = {
      title: currentBook.title,
      author: currentBook.author,
      cover_url: currentBook.cover_url || currentBook.thumbnail || null,
      publish_year: currentBook.publish_year || null,
      wikipedia_url: currentBook.wikipedia_url || null,
      google_books_url: currentBook.google_books_url || null,
      genre: currentBook.genre || undefined,
    };
    
    onAddBook(bookMeta);
  }

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={handleSwipe}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${currentBook.title}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
          >
            <div className="flex items-start gap-3 mb-2">
              {/* Thumbnail or icon */}
              {(currentBook.thumbnail || currentBook.cover_url) ? (
                <img 
                  src={currentBook.thumbnail || currentBook.cover_url || ''} 
                  alt={currentBook.title}
                  className="w-16 h-20 object-cover rounded-lg flex-shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={24} className="text-slate-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-slate-800 mb-1 line-clamp-2">
                  {currentBook.title}
                </h3>
                <div className="text-xs text-slate-600 mb-2">
                  <span>{currentBook.author}</span>
                </div>
                {/* Add Book Button */}
                {onAddBook && (
                  <button
                    onClick={handleAddBook}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={10} />
                    Add Book
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs font-medium text-slate-800 leading-relaxed mb-3">
              {currentBook.reason}
            </p>
            {books.length > 1 && (
              <p className="text-xs text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
                Tap card for next ({currentIndex + 1}/{books.length})
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RatingStarsProps {
  value: number | null;
  onRate: (dimension: string, value: number | null) => void;
  dimension: string;
}

function RatingStars({ value, onRate, dimension }: RatingStarsProps) {
  const [localValue, setLocalValue] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    setLocalValue(value || 0);
    setIsLocked(false);
  }, [dimension, value]);

  function handleTap(star: number) {
    if (isLocked) return;
    setIsLocked(true);
    setLocalValue(star);
    // Call immediately for snappy response, then unlock after a brief delay
    onRate(dimension, star);
    setTimeout(() => setIsLocked(false), 100);
  }

  function handleSkip() {
    if (isLocked) return;
    setIsLocked(true);
    // Call immediately for snappy response, then unlock after a brief delay
    onRate(dimension, null);
    setTimeout(() => setIsLocked(false), 100);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 mb-1">{dimension}</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} onClick={() => handleTap(star)} className="p-1 focus:outline-none" whileTap={{ scale: 0.7 }}>
            <Star 
              size={32} 
              className={`transition-all duration-200 ease-out ${star <= localValue ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300 fill-transparent scale-100'}`}
              style={{ transitionDelay: star <= localValue ? `${star * 30}ms` : '0ms' }}
            />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface AddBookSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
}

function AddBookSheet({ isOpen, onClose, onAdd }: AddBookSheetProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]>([]);
  const [searchSource, setSearchSource] = useState<'wikipedia' | 'apple_books'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('searchSource');
      // Migrate old values
      if (saved === 'google_books' || saved === 'grok') {
        localStorage.setItem('searchSource', 'apple_books');
        return 'apple_books';
      }
      return (saved as 'wikipedia' | 'apple_books') || 'wikipedia';
    }
    return 'wikipedia';
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('searchSource', searchSource);
    }
  }, [searchSource]);

  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) return;
    setLoading(true);
    setError('');
    setSearchResults([]);
    setSuggestions([]); // Clear suggestions first
    
    let searchPromise: Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]>;
    
    if (searchSource === 'apple_books') {
      searchPromise = lookupBooksOnAppleBooks(titleToSearch);
    } else {
      searchPromise = lookupBooksOnWikipedia(titleToSearch);
    }

    try {
      // First, wait for search results
      const results = await searchPromise;
      setSearchResults(results);

      // Only call Grok for suggestions if no results came back
      if (results.length === 0) {
        const sourceName = searchSource === 'apple_books' ? 'Apple Books' : 'Wikipedia';
        setError(`No results found on ${sourceName}.`);
        
        // Fetch AI suggestions only when no results
        try {
          const aiSuggestions = await getAISuggestions(titleToSearch);
          setSuggestions(aiSuggestions);
        } catch (aiErr) {
          console.error('Error fetching AI suggestions:', aiErr);
          // Don't set error for AI suggestions failure, just leave suggestions empty
        }
      } else {
        // Clear suggestions if we have results
        setSuggestions([]);
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
  }
  
  function handleSelectBook(book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    onAdd(book);
    setQuery('');
    setSuggestions([]);
    setSearchResults([]);
    onClose();
  }

  function handleSuggestionClick(s: string) {
    // Extract just the book title (before the slash) for searching
    const bookTitle = s.split('/')[0].trim();
    setQuery(bookTitle);
    handleSearch(bookTitle);
  }

  // Focus input and scroll into view when sheet opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure the sheet animation has started
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // For mobile: scroll input into view so it's visible above keyboard
          // Use 'start' to position input at top of visible area
          setTimeout(() => {
            inputRef.current?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
            // Additional scroll adjustment for mobile keyboards
            if (window.visualViewport) {
              window.scrollTo({
                top: window.scrollY + 100,
                behavior: 'smooth'
              });
            }
          }, 150);
        }
      }, 350);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isQueryHebrew = isHebrew(query);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-400 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
            {/* Search input - matching the bottom search box style */}
            <div className="relative">
              <input 
                ref={inputRef}
                type="text" 
                inputMode="search"
                placeholder={isQueryHebrew ? "חפש ספר..." : "Search for a book..."}
                value={query} 
                onChange={e => setQuery(e.target.value)}
                className={`w-full h-12 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 border border-white/30 rounded-full focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm outline-none transition-all ${isQueryHebrew ? 'text-right pr-12 pl-4' : 'pl-12 pr-4'}`}
                dir={isQueryHebrew ? "rtl" : "ltr"}
              />
              <Search 
                size={16} 
                className={`absolute top-1/2 -translate-y-1/2 text-slate-600 ${isQueryHebrew ? 'left-4' : 'right-4'}`}
              />
            </div>

            {/* Search Source Toggle - simplified */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // Toggle between: wikipedia -> apple_books -> wikipedia
                  setSearchSource(prev => prev === 'wikipedia' ? 'apple_books' : 'wikipedia');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md hover:bg-white/85 active:scale-95 transition-all text-xs border border-white/30 shadow-sm"
              >
                <span className={`font-medium transition-colors ${searchSource === 'wikipedia' ? 'text-blue-700' : 'text-slate-700'}`}>
                  Wikipedia
                </span>
                <span className="text-slate-400">/</span>
                <span className={`font-medium transition-colors ${searchSource === 'apple_books' ? 'text-blue-700' : 'text-slate-700'}`}>
                  Apple Books
                </span>
              </button>
            </div>
            
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-2">
                <div className="scale-[0.3]">
                <BookLoading />
              </div>
              </div>
            )}

            {/* Search Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 max-h-[400px] overflow-y-auto ios-scroll"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    Select a book to add:
                  </div>
                  {searchResults.map((book, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleSelectBook(book)}
                      className="w-full flex items-center gap-3 p-3 bg-white/80 backdrop-blur-md hover:bg-white/85 rounded-xl border border-white/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img 
                          src={book.cover_url} 
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-slate-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        {book.publish_year && (
                          <p className="text-[10px] text-slate-600 mt-0.5">{book.publish_year}</p>
                        )}
                      </div>
                      {i === 0 && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                          Top
                        </span>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suggestions - only show if no search results */}
            <AnimatePresence>
              {suggestions.length > 0 && searchResults.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  <div className="w-full text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" /> 
                    <span>Did you mean?</span>
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
              <p className="text-red-500 text-sm text-center font-medium">{error}</p>
            )}
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [books, setBooks] = useState<BookWithRatings[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectingReadingStatus, setSelectingReadingStatus] = useState(false);
  const [pendingBookMeta, setPendingBookMeta] = useState<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null>(null);
  
  // Swipe detection state for book navigation
  const [bookTouchStart, setBookTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [bookTouchEnd, setBookTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;
  
  // Handle book navigation swipe
  const handleBookSwipe = () => {
    if (!bookTouchStart || !bookTouchEnd) return;
    
    const distanceX = bookTouchStart.x - bookTouchEnd.x;
    const distanceY = bookTouchStart.y - bookTouchEnd.y;
    
    // Only handle horizontal swipes (ignore if vertical scroll is more dominant)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // Swipe left = next book
        setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0));
      } else {
        // Swipe right = previous book
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1));
      }
    }
    
    // Reset touch state
    setBookTouchStart(null);
    setBookTouchEnd(null);
  };
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isShowingNotes, setIsShowingNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [loadingFactsForBookId, setLoadingFactsForBookId] = useState<string | null>(null);
  const [loadingPodcastsForBookId, setLoadingPodcastsForBookId] = useState<string | null>(null);
  const [loadingAnalysisForBookId, setLoadingAnalysisForBookId] = useState<string | null>(null);
  const [analysisArticles, setAnalysisArticles] = useState<Map<string, AnalysisArticle[]>>(new Map());
  const [loadingVideosForBookId, setLoadingVideosForBookId] = useState<string | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<Map<string, YouTubeVideo[]>>(new Map());
  const [loadingRelatedForBookId, setLoadingRelatedForBookId] = useState<string | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Map<string, RelatedBook[]>>(new Map());
  const [scrollY, setScrollY] = useState(0);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [showBookshelf, setShowBookshelf] = useState(false);
  const [showBookshelfCovers, setShowBookshelfCovers] = useState(false);
  const [showNotesView, setShowNotesView] = useState(false);
  const [editingNoteBookId, setEditingNoteBookId] = useState<string | null>(null);
  const [bookshelfGrouping, setBookshelfGrouping] = useState<'rating' | 'author' | 'title' | 'genre' | 'reading_status'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bookshelfGrouping');
      return (saved as 'rating' | 'author' | 'title' | 'genre' | 'reading_status') || 'rating';
    }
    return 'rating';
  });
  const [backgroundGradient, setBackgroundGradient] = useState<string>('241,245,249,226,232,240'); // Default slate colors as RGB
  // Podcast source selector removed - now always fetches from both sources

  // Load books from Supabase
  useEffect(() => {
    if (authLoading) return;

    // If no user, mark as loaded so we can show login screen
    if (!user) {
      setIsLoaded(true);
      return;
    }

    async function loadBooks() {
      try {
        // Verify we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !user) {
          console.error('No session or user found when loading books');
          setIsLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', user.id) // Explicitly filter by current user
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error loading books:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          throw error;
        }

        const appBooks = (data || []).map(convertBookToApp);
        setBooks(appBooks);
        if (appBooks.length > 0 && selectedIndex >= appBooks.length) {
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Error loading books:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    loadBooks();
  }, [user, authLoading]);

  // All hooks must be called before any conditional returns
  const activeBook = books[selectedIndex] || null;
  const [editingDimension, setEditingDimension] = useState<typeof RATING_DIMENSIONS[number] | null>(null);

  // Memoize combined podcast episodes to prevent recalculation on every render
  const combinedPodcastEpisodes = useMemo(() => {
    if (!activeBook) return [];
    
    const curatedEpisodes = activeBook.podcast_episodes_curated || [];
    const appleEpisodes = activeBook.podcast_episodes_apple || [];
    const legacyEpisodes = activeBook.podcast_episodes || [];
    
    // Combine episodes, avoiding duplicates by URL
    const seenUrls = new Set<string>();
    const episodes: PodcastEpisode[] = [];
    
    [...curatedEpisodes, ...appleEpisodes, ...legacyEpisodes].forEach(ep => {
      if (ep.url && !seenUrls.has(ep.url)) {
        seenUrls.add(ep.url);
        episodes.push(ep);
      }
    });
    
    return episodes;
  }, [
    activeBook?.id, 
    activeBook?.podcast_episodes_curated?.length || 0, 
    activeBook?.podcast_episodes_apple?.length || 0, 
    activeBook?.podcast_episodes?.length || 0,
    // Also include a stable reference check using episode URLs
    (activeBook?.podcast_episodes_curated || []).map(e => e.url).join(','),
    (activeBook?.podcast_episodes_apple || []).map(e => e.url).join(','),
    (activeBook?.podcast_episodes || []).map(e => e.url).join(',')
  ]);
  
  // Save bookshelf grouping preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookshelfGrouping', bookshelfGrouping);
    }
  }, [bookshelfGrouping]);

  // Helper function to get alphabetical range for a letter
  const getAlphabeticalRange = (letter: string): string => {
    const upper = letter.toUpperCase();
    if (upper >= 'A' && upper <= 'D') return 'A-D';
    if (upper >= 'E' && upper <= 'H') return 'E-H';
    if (upper >= 'I' && upper <= 'M') return 'I-M';
    if (upper >= 'N' && upper <= 'S') return 'N-S';
    return 'T-Z';
  };

  // Group books for bookshelf view based on selected grouping
  const groupedBooksForBookshelf = useMemo(() => {
    if (bookshelfGrouping === 'rating') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: '4-5 Stars', books: [] },
        { label: '3-4 Stars', books: [] },
        { label: '1-3 Stars', books: [] },
        { label: 'Not Rated', books: [] },
      ];
      
      books.forEach(book => {
        const score = calculateScore(book.ratings);
        if (score >= 4) {
          groups[0].books.push(book);
        } else if (score >= 3) {
          groups[1].books.push(book);
        } else if (score >= 1) {
          groups[2].books.push(book);
        } else {
          groups[3].books.push(book);
        }
      });
      
      // Sort each group by score descending
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA;
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'author') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'A-D', books: [] },
        { label: 'E-H', books: [] },
        { label: 'I-M', books: [] },
        { label: 'N-S', books: [] },
        { label: 'T-Z', books: [] },
      ];
      
      books.forEach(book => {
        const firstLetter = book.author?.[0]?.toUpperCase() || 'Z';
        const range = getAlphabeticalRange(firstLetter);
        const groupIndex = groups.findIndex(g => g.label === range);
        if (groupIndex !== -1) {
          groups[groupIndex].books.push(book);
        }
      });
      
      // Sort each group by author name
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const authorA = (a.author || '').toUpperCase();
          const authorB = (b.author || '').toUpperCase();
          return authorA.localeCompare(authorB);
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'title') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'A-D', books: [] },
        { label: 'E-H', books: [] },
        { label: 'I-M', books: [] },
        { label: 'N-S', books: [] },
        { label: 'T-Z', books: [] },
      ];
      
      books.forEach(book => {
        const firstLetter = book.title?.[0]?.toUpperCase() || 'Z';
        const range = getAlphabeticalRange(firstLetter);
        const groupIndex = groups.findIndex(g => g.label === range);
        if (groupIndex !== -1) {
          groups[groupIndex].books.push(book);
        }
      });
      
      // Sort each group by title
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const titleA = (a.title || '').toUpperCase();
          const titleB = (b.title || '').toUpperCase();
          return titleA.localeCompare(titleB);
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'genre') {
      // Group by actual genre name
      const genreMap = new Map<string, BookWithRatings[]>();
      
      books.forEach(book => {
        const genre = book.genre || 'No Genre';
        if (!genreMap.has(genre)) {
          genreMap.set(genre, []);
        }
        genreMap.get(genre)!.push(book);
      });
      
      // Convert to groups array and sort by genre name
      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(genreMap.entries())
        .map(([genre, books]) => ({
          label: genre,
          books: books.sort((a, b) => {
            // Sort books within each genre by title
            const titleA = (a.title || '').toUpperCase();
            const titleB = (b.title || '').toUpperCase();
            return titleA.localeCompare(titleB);
          })
        }))
        .sort((a, b) => {
          // Sort groups by genre name (put "No Genre" at the end)
          if (a.label === 'No Genre') return 1;
          if (b.label === 'No Genre') return -1;
          return a.label.localeCompare(b.label);
        });
      
      return groups;
    } else if (bookshelfGrouping === 'reading_status') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'Read it', books: [] },
        { label: 'Reading', books: [] },
        { label: 'Want to read', books: [] },
      ];
      
      books.forEach(book => {
        const status = book.reading_status;
        if (status === 'read_it') {
          groups[0].books.push(book);
        } else if (status === 'reading') {
          groups[1].books.push(book);
        } else if (status === 'want_to_read') {
          groups[2].books.push(book);
        }
      });
      
      // Sort each group by rating descending
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA;
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    }
    // Default fallback (should never happen)
    return [];
  }, [books, bookshelfGrouping]);
  
  // When editing, show the first dimension that needs rating, or first dimension if all are rated
  const currentEditingDimension = useMemo((): typeof RATING_DIMENSIONS[number] | null => {
    if (!activeBook || !isEditing) return null;
    if (editingDimension) return editingDimension;
    // Find first unrated dimension, or default to first dimension
    return RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) || RATING_DIMENSIONS[0];
  }, [activeBook, isEditing, editingDimension]);
  
  const showRatingOverlay = activeBook && isEditing;

  useEffect(() => {
    setIsEditing(false);
    setIsConfirmingDelete(false);
    setIsShowingNotes(false);
    setEditingDimension(null);
    
    setIsMetaExpanded(true);
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  // Load note text when book changes
  useEffect(() => {
    if (activeBook) {
      setNoteText(activeBook.notes || '');
    }
    // Cleanup timeout on book change
    return () => {
      if (noteSaveTimeoutRef.current) {
        clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
    };
  }, [activeBook?.id, activeBook?.notes]);

  // Update background gradient when book changes
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (currentBook?.cover_url) {
      extractColorsFromImage(currentBook.cover_url).then(gradient => {
        setBackgroundGradient(gradient);
      });
    } else {
      setBackgroundGradient('241,245,249,226,232,240'); // Default slate colors
    }
  }, [selectedIndex, books]);

  // Fetch author facts for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingFactsForBookId(null);
      return;
    }

    // Check if facts already exist in database
    // Be more robust: check for array with length > 0, or try to parse if it's a string
    const authorFacts = currentBook.author_facts;
    const hasFacts = authorFacts && 
                     Array.isArray(authorFacts) && 
                     authorFacts.length > 0;
    
    if (hasFacts && authorFacts) {
      // Show loading state briefly even when loading from DB for consistent UX
      const bookId = currentBook.id;
      const factsCount = authorFacts.length;
      console.log(`[Author Facts] ✅ Found ${factsCount} facts in database for "${currentBook.title}" by ${currentBook.author} - skipping Grok fetch`);
      setLoadingFactsForBookId(bookId);
      setTimeout(() => {
        console.log(`[Author Facts] ✅ Loaded from database for "${currentBook.title}" by ${currentBook.author}: ${factsCount} facts`);
        setLoadingFactsForBookId(null);
      }, 800); // Brief delay to show loading animation
      return;
    }
    
    // Log when we're about to fetch (for debugging mobile issue)
    console.log(`[Author Facts] 🔍 Checking facts for "${currentBook.title}" by ${currentBook.author}:`, {
      hasAuthorFacts: !!currentBook.author_facts,
      isArray: Array.isArray(currentBook.author_facts),
      length: currentBook.author_facts?.length,
      type: typeof currentBook.author_facts,
      value: currentBook.author_facts
    });

    let cancelled = false;
    const bookId = currentBook.id;

    // Set loading state
    setLoadingFactsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Author Facts] 🔄 Fetching from Grok API for "${bookTitle}" by ${bookAuthor}...`);
      getAuthorFacts(bookTitle, bookAuthor).then(async (facts) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingFactsForBookId(null);
        
        if (facts.length > 0) {
          console.log(`[Author Facts] ✅ Received ${facts.length} facts from Grok API for "${bookTitle}"`);
          // Save to database
          if (!user) return; // Safety check
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({ author_facts: facts, updated_at: new Date().toISOString() })
              .eq('id', bookId)
              .eq('user_id', user.id); // Ensure user can only update their own books
            
            if (updateError) throw updateError;
            
            console.log(`[Author Facts] 💾 Saved ${facts.length} facts to database for "${bookTitle}"`);
            
            // Update local state
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { ...book, author_facts: facts }
                : book
            ));
          } catch (err) {
            console.error('Error saving author facts to database:', err);
            // Still update local state even if DB save fails
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { ...book, author_facts: facts }
                : book
            ));
          }
        } else {
          console.log(`[Author Facts] ⚠️ No facts received from Grok API for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingFactsForBookId(null);
          console.error('Error fetching author facts:', err);
        }
      });
    }, 1500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingFactsForBookId(null);
      clearTimeout(fetchTimer);
    };
  }, [selectedIndex, books]); // Depend on selectedIndex and books

  // Fetch podcast episodes for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingPodcastsForBookId(null);
      return;
    }

    const bookId = currentBook.id; // Define bookId early

    // Check if podcasts already exist in database (both sources)
    const curatedEpisodes = currentBook.podcast_episodes_curated || [];
    const appleEpisodes = currentBook.podcast_episodes_apple || [];
    const legacyEpisodes = currentBook.podcast_episodes || [];
    
    // Combine episodes: curated first, then Apple, then legacy
    const seenUrls = new Set<string>();
    const combinedEpisodes: PodcastEpisode[] = [];
    
    [...curatedEpisodes, ...appleEpisodes, ...legacyEpisodes].forEach(ep => {
      if (ep.url && !seenUrls.has(ep.url)) {
        seenUrls.add(ep.url);
        combinedEpisodes.push(ep);
      }
    });
    
    if (combinedEpisodes.length > 0) {
      // Show loading state briefly even when loading from DB for consistent UX
      setLoadingPodcastsForBookId(bookId);
      setTimeout(() => {
        console.log(`[Podcast Episodes] ✅ Loaded ${combinedEpisodes.length} episodes from database (${curatedEpisodes.length} curated + ${appleEpisodes.length} Apple) for "${currentBook.title}" by ${currentBook.author}`);
        setLoadingPodcastsForBookId(null);
        
        // Update local state with source-specific episodes if we used legacy data
        if (legacyEpisodes.length > 0 && (!curatedEpisodes.length && !appleEpisodes.length)) {
          // Migrate legacy data to curated
          setBooks(prev => prev.map(book => 
            book.id === currentBook.id 
              ? { 
                  ...book, 
                  podcast_episodes_curated: legacyEpisodes,
                  podcast_episodes_apple: []
                }
              : book
          ));
        }
      }, 800); // Brief delay to show loading animation
      return;
    }

    let cancelled = false;

    // Set loading state
    setLoadingPodcastsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Podcast Episodes] 🔄 Fetching from both sources (Curated + Apple) for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor).then(async (allEpisodes) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingPodcastsForBookId(null);
        
        if (allEpisodes.length > 0) {
          console.log(`[Podcast Episodes] ✅ Received ${allEpisodes.length} combined episodes for "${bookTitle}"`);
          
          // Separate episodes by source
          const curated: PodcastEpisode[] = [];
          const apple: PodcastEpisode[] = [];
          
          allEpisodes.forEach(ep => {
            if (ep.platform === 'Curated') {
              curated.push(ep);
            } else {
              apple.push(ep);
            }
          });
          
          // Save to database with both source-specific columns
          if (!user) return; // Safety check
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({ 
                podcast_episodes_curated: curated,
                podcast_episodes_apple: apple,
                updated_at: new Date().toISOString() 
              })
              .eq('id', bookId)
              .eq('user_id', user.id); // Ensure user can only update their own books
            
            if (updateError) throw updateError;
            
            console.log(`[Podcast Episodes] 💾 Saved ${curated.length} curated + ${apple.length} Apple episodes to database for "${bookTitle}"`);
            
            // Update local state with both source-specific episodes
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { 
                    ...book, 
                    podcast_episodes_curated: curated,
                    podcast_episodes_apple: apple
                  }
                : book
            ));
          } catch (err: any) {
            console.error('[Podcast Episodes] ❌ Error saving to database:', err);
            console.error('[Podcast Episodes] Error details:', err.message, err.code, err.details);
            // Still update local state even if DB save fails
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { 
                    ...book, 
                    podcast_episodes_curated: curated,
                    podcast_episodes_apple: apple
                  }
                : book
            ));
          }
        } else {
          console.log(`[Podcast Episodes] ⚠️ No episodes found for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingPodcastsForBookId(null);
          console.error('Error fetching podcast episodes:', err);
        }
      });
    }, 2000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingPodcastsForBookId(null);
      clearTimeout(fetchTimer);
    };
  }, [selectedIndex, books]); // Removed podcastSource dependency

  // Load analysis articles from Google Scholar
  useEffect(() => {
    if (!activeBook) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    const currentBook = activeBook;
    let cancelled = false;

    if (!currentBook.title || !currentBook.author) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    const bookId = currentBook.id;

    // Check if analysis already exists in state
    if (analysisArticles.has(bookId)) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    setLoadingAnalysisForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Analysis Articles] 🔄 Fetching from Google Scholar for "${bookTitle}" by ${bookAuthor}...`);
      getGoogleScholarAnalysis(bookTitle, bookAuthor).then((articles) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingAnalysisForBookId(null);
        
        if (articles.length > 0) {
          console.log(`[Analysis Articles] ✅ Received ${articles.length} articles for "${bookTitle}"`);
          // Store in state
          setAnalysisArticles(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, articles);
            return newMap;
          });
        } else {
          console.log(`[Analysis Articles] ⚠️ No articles found for "${bookTitle}"`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingAnalysisForBookId(null);
        console.error('Error fetching analysis articles:', err);
      });
    }, 2000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingAnalysisForBookId(null);
      clearTimeout(fetchTimer);
    };
  }, [selectedIndex, books, analysisArticles]); // Depend on selectedIndex, books, and analysisArticles

  // Fetch YouTube videos for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingVideosForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const videos = youtubeVideos.get(bookId);
    
    // If videos already exist, don't fetch again
    if (videos && videos.length > 0) {
      return;
    }

    let cancelled = false;

    // Set loading state
    setLoadingVideosForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[YouTube Videos] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getYouTubeVideos(bookTitle, bookAuthor).then((videos) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingVideosForBookId(null);
        
        if (videos.length > 0) {
          console.log(`[YouTube Videos] ✅ Received ${videos.length} videos for "${bookTitle}"`);
          // Store in state
          setYoutubeVideos(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, videos);
            return newMap;
          });
        } else {
          console.log(`[YouTube Videos] ⚠️ No videos found for "${bookTitle}"`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingVideosForBookId(null);
        console.error('Error fetching YouTube videos:', err);
      });
    }, 2500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingVideosForBookId(null);
      clearTimeout(fetchTimer);
    };
  }, [selectedIndex, books, youtubeVideos]); // Depend on selectedIndex, books, and youtubeVideos

  // Fetch related books when activeBook changes
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingRelatedForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const related = relatedBooks.get(bookId);
    
    // If related books already exist, don't fetch again
    if (related && related.length > 0) {
      return;
    }

    let cancelled = false;

    // Set loading state
    setLoadingRelatedForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Related Books] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getRelatedBooks(bookTitle, bookAuthor).then((books) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingRelatedForBookId(null);
        
        if (books.length > 0) {
          console.log(`[Related Books] ✅ Received ${books.length} related books for "${bookTitle}"`);
          // Store in state
          setRelatedBooks(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, books);
            return newMap;
          });
        } else {
          console.log(`[Related Books] ⚠️ No related books found for "${bookTitle}"`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingRelatedForBookId(null);
        console.error('Error fetching related books:', err);
      });
    }, 3000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingRelatedForBookId(null);
      clearTimeout(fetchTimer);
    };
  }, [selectedIndex, books, relatedBooks]); // Depend on selectedIndex, books, and relatedBooks

  // Helper function to generate canonical book ID (matches database function)
  function generateCanonicalBookId(title: string, author: string): string {
    const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedAuthor = (author || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return `${normalizedTitle}|${normalizedAuthor}`;
  }

  async function handleAddBook(meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    if (!user) return;

    // Store the book metadata and show reading status selection
    setPendingBookMeta(meta);
    setSelectingReadingStatus(true);
    setIsAdding(false);
  }

  async function handleUpdateReadingStatus(id: string, readingStatus: ReadingStatus) {
    if (!user) return;
    
    // Optimistic update
    setBooks(prev => prev.map(book => 
      book.id === id 
        ? { ...book, reading_status: readingStatus }
        : book
    ));

    try {
      const { data, error } = await supabase
        .from('books')
        .update({ 
          reading_status: readingStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) {
        // Log error in multiple ways to catch all possible error formats
        console.error('[handleUpdateReadingStatus] Supabase error object:', error);
        console.error('[handleUpdateReadingStatus] Error stringified:', JSON.stringify(error, null, 2));
        console.error('[handleUpdateReadingStatus] Error details:', {
          message: error?.message || 'No message',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          fullError: error
        });
        
        // Check if column doesn't exist (common error codes)
        const errorMessage = error?.message || '';
        const errorCode = error?.code || '';
        
        if (errorCode === '42703' || errorMessage.includes('column') || errorMessage.includes('reading_status') || errorMessage.includes('does not exist')) {
          console.warn('[handleUpdateReadingStatus] ⚠️ reading_status column may not exist. Please run the migration in Supabase SQL Editor.');
          console.warn('[handleUpdateReadingStatus] Migration SQL: See migrations/add_reading_status.sql');
        }
        
        // Revert on error
        setBooks(prev => prev.map(book => 
          book.id === id 
            ? { ...book, reading_status: activeBook?.reading_status || null }
            : book
        ));
      } else {
        console.log(`[handleUpdateReadingStatus] ✅ Successfully updated reading_status to ${readingStatus}`, data);
      }
    } catch (err: any) {
      console.error('[handleUpdateReadingStatus] ❌ Error updating reading status:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        fullError: err
      });
      // Revert on error
      setBooks(prev => prev.map(book => 
        book.id === id 
          ? { ...book, reading_status: activeBook?.reading_status || null }
          : book
      ));
    }
  }

  async function handleAddBookWithStatus(readingStatus: ReadingStatus) {
    if (!user || !pendingBookMeta) return;

    setSelectingReadingStatus(false);
    const meta = pendingBookMeta;

    try {
      // Generate canonical book ID
      const canonicalBookId = generateCanonicalBookId(meta.title || '', meta.author || '');
      
      // Check if user already has this book
      const { data: existingBook, error: checkError } = await supabase
        .from('books')
        .select('id, title, author')
        .eq('user_id', user.id)
        .eq('canonical_book_id', canonicalBookId)
        .maybeSingle();
      
      if (existingBook) {
        // Find the book in the current books array and navigate to it
        const existingBookIndex = books.findIndex(book => book.id === existingBook.id);
        if (existingBookIndex !== -1) {
          // Book is already loaded, just navigate to it
          setSelectedIndex(existingBookIndex);
          setPendingBookMeta(null);
          // Make sure we're on the books view (not bookshelf/notes)
          setShowBookshelf(false);
          setShowNotesView(false);
        } else {
          // Book exists in DB but not loaded yet - reload books to include it
          const { data: allBooks } = await supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (allBooks) {
            const appBooks = allBooks.map(convertBookToApp);
            setBooks(appBooks);
            const foundIndex = appBooks.findIndex(book => book.id === existingBook.id);
            if (foundIndex !== -1) {
              setSelectedIndex(foundIndex);
            }
          }
          setPendingBookMeta(null);
          setShowBookshelf(false);
          setShowNotesView(false);
        }
        return;
      }
      
      // Check how many other users have this book (for future feature)
      const { count: sharedCount } = await supabase
        .from('books')
        .select('*', { count: 'exact', head: true })
        .eq('canonical_book_id', canonicalBookId)
        .neq('user_id', user.id);
      
      if (sharedCount && sharedCount > 0) {
        console.log(`[handleAddBook] 📚 ${sharedCount} other user(s) also have this book`);
      }

      // Build bookData
      const bookData: any = {
        title: meta.title || '',
        author: meta.author || 'Unknown Author',
        canonical_book_id: canonicalBookId,
        publish_year: meta.publish_year ?? null,
        cover_url: meta.cover_url ?? null,
        wikipedia_url: meta.wikipedia_url ?? null,
        google_books_url: meta.google_books_url ?? null,
        user_id: user.id,
        rating_writing: null,
        rating_insights: null,
        rating_flow: null,
        rating_world: null,
        rating_characters: null,
        reading_status: readingStatus,
      };
      
      // Only include genre if it exists (column may not exist in database yet)
      if (meta.genre) {
        bookData.genre = meta.genre;
      }

      console.log('Inserting book data:', JSON.stringify(bookData, null, 2));

      const { data, error } = await supabase
        .from('books')
        .insert(bookData)
        .select()
        .single();

      if (error) {
        console.error('[handleAddBook] Supabase error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Handle unique constraint violation (duplicate book)
        if (error.code === '23505') { // Unique violation
          alert(`You already have this book in your library.`);
          return;
        }
        
        // Check if genre column doesn't exist
        if (error.code === '42703' || (error.message && (error.message.includes('column') || error.message.includes('genre')))) {
          console.warn('[handleAddBook] ⚠️ Genre column may not exist. Retrying without genre...');
          // Retry without genre
          const bookDataWithoutGenre = { ...bookData };
          delete bookDataWithoutGenre.genre;
          
          const { data: retryData, error: retryError } = await supabase
            .from('books')
            .insert(bookDataWithoutGenre)
            .select()
            .single();
            
          if (retryError) {
            console.error('[handleAddBook] Supabase error (retry):', {
              message: retryError.message,
              code: retryError.code,
              details: retryError.details,
              hint: retryError.hint,
            });
            const errorMessage = retryError?.message || retryError?.code || 'Unknown error';
            alert(`Failed to add book: ${errorMessage}`);
            return;
          }
          
          // Success on retry - continue with retryData
          const newBook = convertBookToApp(retryData);
          setBooks(prev => [newBook, ...prev]);
          setSelectedIndex(0);
          setIsAdding(false);
          setPendingBookMeta(null);
          // Switch to books view (in case we're on bookshelf/notes screen)
          setShowBookshelf(false);
          setShowNotesView(false);
          // Automatically open rating overlay for new book only if status is "read_it"
          if (readingStatus === 'read_it') {
            setTimeout(() => {
              setIsEditing(true);
              setEditingDimension(null); // Will default to first unrated dimension
            }, 100);
          }
          return;
        }
        
        // Show user-friendly error message for other errors
        const errorMessage = error?.message || error?.code || 'Unknown error';
        alert(`Failed to add book: ${errorMessage}`);
        return;
      }

      const newBook = convertBookToApp(data);
      setBooks(prev => [newBook, ...prev]);
      setSelectedIndex(0);
      setIsAdding(false);
      setPendingBookMeta(null);
      // Switch to books view (in case we're on bookshelf/notes screen)
      setShowBookshelf(false);
      setShowNotesView(false);
      // Automatically open rating overlay for new book only if status is "read_it"
      if (readingStatus === 'read_it') {
        setTimeout(() => {
          setIsEditing(true);
          setEditingDimension(null); // Will default to first unrated dimension
        }, 100);
      }

      // Fetch author facts and podcast episodes asynchronously after book is added and save to DB
      if (meta.title && meta.author) {
        // Fetch author facts
        console.log(`[Author Facts] 🔄 Fetching from Grok API for new book "${meta.title}" by ${meta.author}...`);
        setLoadingFactsForBookId(newBook.id);
        getAuthorFacts(meta.title, meta.author).then(async (facts) => {
          setLoadingFactsForBookId(null);
          if (facts.length > 0) {
            console.log(`[Author Facts] ✅ Received ${facts.length} facts from Grok API for "${meta.title}"`);
            // Save to database
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ author_facts: facts, updated_at: new Date().toISOString() })
                .eq('id', newBook.id);
              
              if (updateError) throw updateError;
              
              console.log(`[Author Facts] 💾 Saved ${facts.length} facts to database for "${meta.title}"`);
              
              // Update local state
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { ...book, author_facts: facts }
                  : book
              ));
            } catch (err) {
              console.error('Error saving author facts to database:', err);
              // Still update local state even if DB save fails
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { ...book, author_facts: facts }
                  : book
              ));
            }
          } else {
            console.log(`[Author Facts] ⚠️ No facts received from Grok API for "${meta.title}"`);
          }
        }).catch(err => {
          setLoadingFactsForBookId(null);
          console.error(`[Author Facts] ❌ Error fetching from Grok API for "${meta.title}":`, err);
        });

        // Fetch podcast episodes from both sources
        console.log(`[Podcast Episodes] 🔄 Fetching from both sources (Curated + Apple) for new book "${meta.title}" by ${meta.author}...`);
        setLoadingPodcastsForBookId(newBook.id);
        getPodcastEpisodes(meta.title, meta.author).then(async (allEpisodes) => {
          setLoadingPodcastsForBookId(null);
          if (allEpisodes.length > 0) {
            console.log(`[Podcast Episodes] ✅ Received ${allEpisodes.length} combined episodes for "${meta.title}"`);
            
            // Separate episodes by source
            const curated: PodcastEpisode[] = [];
            const apple: PodcastEpisode[] = [];
            
            allEpisodes.forEach(ep => {
              if (ep.platform === 'Curated') {
                curated.push(ep);
              } else {
                apple.push(ep);
              }
            });
            
            // Save to database with both source-specific columns
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ 
                  podcast_episodes_curated: curated,
                  podcast_episodes_apple: apple,
                  updated_at: new Date().toISOString() 
                })
                .eq('id', newBook.id)
                .eq('user_id', user.id);
              
              if (updateError) throw updateError;
              
              console.log(`[Podcast Episodes] 💾 Saved ${curated.length} curated + ${apple.length} Apple episodes to database for "${meta.title}"`);
              
              // Update local state with both source-specific episodes
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { 
                      ...book, 
                      podcast_episodes_curated: curated,
                      podcast_episodes_apple: apple
                    }
                  : book
              ));
            } catch (err: any) {
              console.error('[Podcast Episodes] ❌ Error saving to database:', err);
              console.error('[Podcast Episodes] Error details:', err.message, err.code, err.details);
              // Still update local state even if DB save fails
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { 
                      ...book, 
                      podcast_episodes_curated: curated,
                      podcast_episodes_apple: apple
                    }
                  : book
              ));
            }
          } else {
            console.log(`[Podcast Episodes] ⚠️ No episodes received from Grok API for "${meta.title}"`);
          }
        }).catch(err => {
          setLoadingPodcastsForBookId(null);
          console.error(`[Podcast Episodes] ❌ Error fetching from Grok API for "${meta.title}":`, err);
        });
      }
    } catch (err: any) {
      console.error('Error adding book:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack,
      });
      console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      // Show user-friendly error message
      const errorMessage = err?.message || err?.code || 'Unknown error';
      alert(`Failed to add book: ${errorMessage}`);
    }
  }

  async function handleRate(id: string, dimension: string, value: number | null) {
    if (!user) return; // Safety check
    
    const ratingField = `rating_${dimension}` as 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters';
    
    console.log(`[handleRate] Updating ${ratingField} to ${value} for book ${id}`);
    
    // Store original value for revert
    const originalValue = activeBook?.ratings[dimension as keyof typeof activeBook.ratings] ?? null;
    
    // Optimistic update
    setBooks(prev => prev.map(book => 
      book.id === id 
        ? { ...book, ratings: { ...book.ratings, [dimension]: value } }
        : book
    ));

    try {
      const updateData: Record<string, any> = {
        [ratingField]: value,
        updated_at: new Date().toISOString()
      };
      
      const { error, data } = await supabase
        .from('books')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user can only update their own books
        .select();

      if (error) {
        console.error('[handleRate] Supabase error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Check if column doesn't exist
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.error(`[handleRate] ⚠️ Column "${ratingField}" may not exist. Please run the migration in Supabase SQL Editor.`);
          console.error(`[handleRate] Migration SQL: ALTER TABLE public.books ADD COLUMN IF NOT EXISTS ${ratingField} int CHECK (${ratingField} between 1 and 5);`);
        }
        
        throw error;
      }
      
      console.log(`[handleRate] ✅ Successfully updated ${ratingField} to ${value}`);
      
      // After rating, move to next dimension or close if all done
      if (value !== null && activeBook) {
        const currentIndex = RATING_DIMENSIONS.indexOf(dimension as typeof RATING_DIMENSIONS[number]);
        const nextIndex = currentIndex + 1;
        if (nextIndex < RATING_DIMENSIONS.length) {
          setEditingDimension(RATING_DIMENSIONS[nextIndex]);
        } else {
          // All dimensions rated, close after a brief moment
          setTimeout(() => {
            setIsEditing(false);
            setEditingDimension(null);
          }, 500);
        }
      } else if (value === null) {
        // If skipped, move to next dimension
        const currentIndex = RATING_DIMENSIONS.indexOf(dimension as typeof RATING_DIMENSIONS[number]);
        const nextIndex = currentIndex + 1;
        if (nextIndex < RATING_DIMENSIONS.length) {
          setEditingDimension(RATING_DIMENSIONS[nextIndex]);
        } else {
          // All dimensions processed, close after a brief moment
          setTimeout(() => {
            setIsEditing(false);
            setEditingDimension(null);
          }, 500);
        }
      }
    } catch (err: any) {
      console.error('[handleRate] ❌ Error updating rating:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        fullError: err
      });
      
      // Revert on error
      setBooks(prev => prev.map(book => 
        book.id === id 
          ? { ...book, ratings: { ...book.ratings, [dimension]: originalValue } }
          : book
      ));
    }
  }

  async function handleDelete() {
    if (!activeBook || !user) return;

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', activeBook.id)
        .eq('user_id', user.id); // Ensure user can only delete their own books

      if (error) throw error;

      const newBooks = books.filter(b => b.id !== activeBook.id);
      const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
      setIsConfirmingDelete(false);
      setSelectedIndex(newBooks.length > 0 ? nextIndex : 0);
      setBooks(newBooks);
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  }

  async function handleSaveNote(text?: string, bookId?: string) {
    const targetBookId = bookId || activeBook?.id;
    if (!targetBookId || !user) return;
    
    const textToSave = text !== undefined ? text : noteText;

    try {
      const { error } = await supabase
        .from('books')
        .update({ 
          notes: textToSave.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetBookId)
        .eq('user_id', user.id); // Ensure user can only update their own books

      if (error) throw error;

      // Update local state
      setBooks(prev => prev.map(book => 
        book.id === targetBookId 
          ? { ...book, notes: textToSave.trim() || null }
          : book
      ));
    } catch (err) {
      console.error('Error saving note:', err);
      alert('Failed to save note. Please try again.');
    }
  }

  // Show book loading animation during initial auth check
  if (authLoading) {
    return <BookLoading />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Show book loading animation while loading books (only if user is authenticated)
  if (!isLoaded) {
    return <BookLoading />;
  }

  const userEmail = user?.email || user?.user_metadata?.email || 'User';
  const userName = user?.user_metadata?.full_name || userEmail.split('@')[0];
  // Get user avatar from Google account
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  // Parse gradient for inline style (format: "r1,g1,b1,r2,g2,b2")
  const [r1, g1, b1, r2, g2, b2] = backgroundGradient.split(',').map(Number);
  const gradientStyle = {
    background: `linear-gradient(to bottom right, rgb(${r1}, ${g1}, ${b1}), rgb(${r2}, ${g2}, ${b2}))`,
  };
  
  // Calculate gradient opacity based on scroll (fade in when header fades out)
  // More responsive: starts fading at 20px, fully visible at 60px
  const gradientOpacity = Math.min(1, Math.max(0, (scrollY - 20) / 40));

  return (
    <div className="fixed inset-0 bg-slate-50 text-slate-900 font-sans select-none overflow-hidden flex flex-col">
      {/* Gradient background that fades in on scroll */}
      <motion.div
        key={`gradient-${books[selectedIndex]?.id || 'default'}`}
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          ...gradientStyle,
          opacity: gradientOpacity,
        }}
        animate={{
          opacity: gradientOpacity,
        }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      />
      {/* Simple header - fades on scroll and during transitions */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={showNotesView ? 'notes-header' : showBookshelf ? 'bookshelf-header' : 'books-header'}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
            pointerEvents: scrollY > 60 ? 'none' : 'auto'
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full z-40 fixed top-[50px] left-0 right-0 px-4 py-3 flex items-center justify-between"
          style={{
            background: showNotesView || showBookshelf
              ? scrollY > 20
                ? `linear-gradient(to bottom, rgba(245, 245, 241, ${Math.max(0, 1 - (scrollY - 20) / 40)}), rgba(245, 245, 241, ${Math.max(0, 1 - (scrollY - 20) / 40)}))`
                : 'linear-gradient(to bottom, rgba(245, 245, 241, 1), rgba(245, 245, 241, 0))'
              : scrollY > 20
                ? `linear-gradient(to bottom, rgba(248, 250, 252, ${Math.max(0, 1 - (scrollY - 20) / 40)}), rgba(248, 250, 252, ${Math.max(0, 1 - (scrollY - 20) / 40)}))`
                : 'linear-gradient(to bottom, rgba(248, 250, 252, 1), rgba(248, 250, 252, 0))'
          }}
        >
          {/* BOOKS/BOOKSHELF/NOTES text on left with icon */}
          <div className="flex items-center gap-3">
            {isShowingNotes && activeBook ? (
              <Pencil size={24} className="text-slate-950" />
            ) : showNotesView ? (
              <Pencil size={24} className="text-slate-950" />
            ) : showBookshelfCovers ? (
              <Grid3x3 size={24} className="text-slate-950" />
            ) : showBookshelf ? (
              <Library size={24} className="text-slate-950" />
            ) : (
              <BookOpen size={24} className="text-slate-950" />
            )}
            <h1 className="text-2xl font-bold text-slate-950 drop-shadow-sm">
              {isShowingNotes && activeBook 
                ? `${activeBook.title} notes` 
                : showNotesView 
                  ? 'NOTES' 
                  : showBookshelfCovers
                    ? 'BOOKSHELF'
                    : showBookshelf 
                    ? 'BOOKSHELF' 
                    : 'BOOKS'}
            </h1>
          </div>
        
        {/* User avatar on right */}
        <div className="relative">
          {userAvatar ? (
            <button
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
              className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 cursor-pointer active:scale-95 transition-transform"
            >
              <img 
                src={userAvatar} 
                alt={userName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-slate-300"><span class="text-xs font-bold text-slate-600">${userName.charAt(0).toUpperCase()}</span></div>`;
                  }
                }}
                referrerPolicy="no-referrer"
              />
            </button>
          ) : (
            <button
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
              className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            >
              <span className="text-xs font-bold text-slate-600">
                {userName.charAt(0).toUpperCase()}
              </span>
            </button>
          )}
          
          {/* Logout menu */}
          <AnimatePresence>
            {showLogoutMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowLogoutMenu(false)}
                />
                {/* Menu */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-10 right-0 z-40 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-lg shadow-xl border border-white/30 min-w-[120px] overflow-hidden"
                >
                  <button
                    onClick={async () => {
                      await signOut();
                      setShowLogoutMenu(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-white/20 active:bg-white/30 transition-colors"
                  >
                    <LogOut size={16} className="text-slate-600" />
                    <span>Logout</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showNotesView ? (
          <motion.main
            key="notes"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: '#f5f5f1', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Notes View */}
            <div className="w-full max-w-[600px] flex flex-col gap-4 px-4 py-8">
              <h1 className="text-2xl font-bold text-slate-950 mb-2">My Notes</h1>
              {(() => {
                // Filter books with notes and sort by title
                const booksWithNotes = books
                  .filter(book => book.notes && book.notes.trim().length > 0)
                  .sort((a, b) => a.title.localeCompare(b.title));

                if (booksWithNotes.length === 0) {
                  return (
                    <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-lg text-center">
                      <Pencil size={32} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-800 text-sm font-medium">No notes yet</p>
                      <p className="text-slate-600 text-xs mt-1">Add notes to your books to see them here</p>
                    </div>
                  );
                }

                return booksWithNotes.map((book) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/30 shadow-lg"
                  >
                    <div className="flex gap-4">
                      {/* Book Cover */}
                      <div className="flex-shrink-0">
                        {book.cover_url ? (
                          <img 
                            src={book.cover_url} 
                            alt={book.title}
                            className="w-16 h-24 object-cover rounded-lg shadow-md"
                          />
                        ) : (
                          <div className={`w-16 h-24 rounded-lg flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                            <BookOpen size={24} className="text-white opacity-50" />
                          </div>
                        )}
                      </div>
                      
                      {/* Book Info and Notes */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-slate-950 mb-1 line-clamp-1">{book.title}</h2>
                        <p className="text-xs text-slate-600 mb-2">{book.author}</p>
                        
                        {editingNoteBookId === book.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={book.notes || ''}
                              onChange={(e) => {
                                const newText = e.target.value;
                                // Update local state immediately
                                setBooks(prev => prev.map(b => 
                                  b.id === book.id ? { ...b, notes: newText } : b
                                ));
                                // Clear existing timeout
                                if (noteSaveTimeoutRef.current) {
                                  clearTimeout(noteSaveTimeoutRef.current);
                                }
                                // Debounced auto-save
                                noteSaveTimeoutRef.current = setTimeout(() => {
                                  handleSaveNote(newText, book.id);
                                }, 1000);
                              }}
                              onBlur={() => {
                                handleSaveNote(book.notes || '', book.id);
                                setEditingNoteBookId(null);
                              }}
                              placeholder="Write your notes here..."
                              className="w-full text-xs text-slate-800 bg-transparent border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-blue-500"
                              rows={4}
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                handleSaveNote(book.notes || '', book.id);
                                setEditingNoteBookId(null);
                              }}
                              className="text-xs text-blue-600 font-medium hover:text-blue-700"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-slate-700 leading-relaxed line-clamp-3 mb-2">
                              {book.notes}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  // Find book index and navigate to it, then open notes
                                  const bookIndex = books.findIndex(b => b.id === book.id);
                                  if (bookIndex !== -1) {
                                    setSelectedIndex(bookIndex);
                                    setShowNotesView(false);
                                    setTimeout(() => {
                                      setIsShowingNotes(true);
                                    }, 300);
                                  }
                                }}
                                className="text-xs text-blue-600 font-medium hover:text-blue-700"
                              >
                                View Book
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ));
              })()}
            </div>
          </motion.main>
        ) : showBookshelfCovers ? (
          <motion.main
            key="bookshelf-covers"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: '#f5f5f1', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Bookshelf Covers View */}
            <div 
              className="w-full flex flex-col items-center px-4"
            >
              <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                {/* Grouping Selector */}
                <div className="flex items-center justify-center gap-2 px-4 mb-1.5">
                  <button
                    onClick={() => setBookshelfGrouping('rating')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'rating'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Rating
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('author')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'author'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Author
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('title')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'title'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Title
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('genre')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'genre'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Genre
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('reading_status')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'reading_status'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Status
                  </button>
                </div>

                {/* Summary Section */}
                <div className="flex items-center justify-center gap-4 px-4 mb-2.5">
                  {(() => {
                    // Calculate KPIs
                    const totalBooks = books.length;
                    const booksWithRatings = books.filter(book => {
                      const values = Object.values(book.ratings).filter(v => v != null) as number[];
                      return values.length > 0;
                    });
                    const totalUnrated = totalBooks - booksWithRatings.length;
                    
                    // Calculate average score across all books
                    let avgScore = 0;
                    if (booksWithRatings.length > 0) {
                      const totalScore = booksWithRatings.reduce((sum, book) => {
                        return sum + calculateScore(book.ratings);
                      }, 0);
                      avgScore = totalScore / booksWithRatings.length;
                    }

                    return (
                      <>
                        {/* Total Books KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {totalBooks}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Total</span>
                        </div>

                        {/* Average Score KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {avgScore > 0 ? avgScore.toFixed(1) : '—'}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Rating</span>
                        </div>

                        {/* Unrated KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {totalUnrated}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Unrated</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {groupedBooksForBookshelf.map((group, groupIdx) => (
                  <div 
                    key={group.label} 
                    className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(to bottom, #FEFEFE, #F0F0F0)',
                      padding: '2rem 0',
                    }}
                  >
                    {/* Shelf Label */}
                    <h2 className="text-xl font-bold text-slate-950 px-[10vw]">{group.label}</h2>
                    
                    {/* Covers Grid */}
                    <div className="px-[10vw] grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                      {group.books.map((book, idx) => {
                        const bookIndex = books.findIndex(b => b.id === book.id);
                        const avgScore = calculateAvg(book.ratings);
                        
                        return (
                          <motion.div
                            key={book.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ 
                              delay: (groupIdx * 0.05) + (idx * 0.02), 
                              duration: 0.3,
                            }}
                            className="flex flex-col items-center cursor-pointer group"
                            onClick={() => {
                              if (bookIndex !== -1) {
                                setScrollY(0);
                                setSelectedIndex(bookIndex);
                                setShowBookshelfCovers(false);
                                setTimeout(() => {
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }, 100);
                              }
                            }}
                          >
                            {/* Book Cover */}
                            <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-2 group-hover:scale-105 transition-transform">
                              {book.cover_url ? (
                                <img 
                                  src={book.cover_url} 
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                  <BookOpen size={32} className="text-white opacity-30" />
                                </div>
                              )}
                              {/* Rating Badge */}
                              {avgScore && (
                                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                                  <Star size={12} className="fill-amber-400 text-amber-400" />
                                  <span className="text-xs font-bold text-white">{avgScore}</span>
                                </div>
                              )}
                            </div>
                            {/* Book Title */}
                            <p className="text-xs font-medium text-slate-800 text-center line-clamp-2 px-1">
                              {book.title}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.main>
        ) : showBookshelf ? (
          <motion.main
            key="bookshelf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: '#f5f5f1', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Bookshelf View */}
            <div 
              className="w-full flex flex-col items-center px-4"
            >
              <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                {/* Grouping Selector */}
                <div className="flex items-center justify-center gap-2 px-4 mb-1.5">
                  <button
                    onClick={() => setBookshelfGrouping('rating')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'rating'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Rating
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('author')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'author'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Author
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('title')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'title'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Title
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('genre')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'genre'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Genre
                  </button>
                  <button
                    onClick={() => setBookshelfGrouping('reading_status')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all bg-white bg-clip-padding backdrop-filter backdrop-blur-xl backdrop-saturate-150 backdrop-contrast-75 border border-white/30 ${
                      bookshelfGrouping === 'reading_status'
                        ? 'bg-opacity-20 text-slate-950'
                        : 'bg-opacity-10 text-slate-700 hover:bg-opacity-15'
                    }`}
                  >
                    Status
                  </button>
                </div>

                {/* Summary Section */}
                <div className="flex items-center justify-center gap-4 px-4 mb-2.5">
                  {(() => {
                    // Calculate KPIs
                    const totalBooks = books.length;
                    const booksWithRatings = books.filter(book => {
                      const values = Object.values(book.ratings).filter(v => v != null) as number[];
                      return values.length > 0;
                    });
                    const totalUnrated = totalBooks - booksWithRatings.length;
                    
                    // Calculate average score across all books
                    let avgScore = 0;
                    if (booksWithRatings.length > 0) {
                      const totalScore = booksWithRatings.reduce((sum, book) => {
                        return sum + calculateScore(book.ratings);
                      }, 0);
                      avgScore = totalScore / booksWithRatings.length;
                    }

                    return (
                      <>
                        {/* Total Books KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {totalBooks}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Total</span>
                        </div>

                        {/* Average Score KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <div className="flex items-center gap-1 mb-1">
                            <Star size={16} className="fill-amber-400 text-amber-400" />
                            <span className="text-lg font-bold text-slate-950">
                              {avgScore > 0 ? avgScore.toFixed(1) : '—'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">Avg Score</span>
                        </div>

                        {/* Total Unrated KPI */}
                        <div className="bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-lg flex flex-col items-center min-w-[100px]">
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {totalUnrated}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Unrated</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {groupedBooksForBookshelf.map((group, groupIdx) => (
                  <div 
                    key={group.label} 
                    className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(to bottom, #FEFEFE, #F0F0F0)',
                      padding: '2rem 0',
                    }}
                  >
                    {/* Shelf Label */}
                    <h2 className="text-xl font-bold text-slate-950 px-[10vw]">{group.label}</h2>
                    
                    {/* Shelf Container */}
                    <div 
                      className="bookshelf-scroll scrollbar-hide flex items-end justify-start overflow-x-auto overflow-y-hidden px-[10vw] ios-horizontal-scroll"
                      style={{
                        scrollSnapType: 'x proximity',
                        cursor: 'grab',
                      } as React.CSSProperties}
                      onMouseDown={(e) => {
                        const shelf = e.currentTarget;
                        const startX = e.pageX - shelf.offsetLeft;
                        const scrollLeft = shelf.scrollLeft;
                        let isDown = true;

                        const handleMouseMove = (e: MouseEvent) => {
                          if (!isDown) return;
                          e.preventDefault();
                          const x = e.pageX - shelf.offsetLeft;
                          const walk = (x - startX) * 2;
                          shelf.scrollLeft = scrollLeft - walk;
                        };

                        const handleMouseUp = () => {
                          isDown = false;
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <div className="flex items-end gap-1 min-h-[400px]">
                        {group.books.map((book, idx) => {
                      const score = calculateScore(book.ratings);
                      const avgScore = calculateAvg(book.ratings);
                      
                      // Generate consistent colors and fonts based on book ID
                      const hash = book.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      const colorSets = [
                        { main: "#5199fc", accent: "#afd7fb" },
                        { main: "#ff9868", accent: "#d06061" },
                        { main: "#ff5068", accent: "#d93368" },
                        { main: "#A1D821", accent: "#7ca81a" },
                        { main: "#FCCF47", accent: "#d4af3b" },
                        { main: "#5856d6", accent: "#4543a8" },
                        { main: "#1c1c1e", accent: "#48484a" }
                      ];
                      const fonts = ["'Bebas Neue'", "'Oswald'", "'Antonio'", "'Archivo Narrow'"];
                      const styleSet = colorSets[hash % colorSets.length];
                      const bookFont = fonts[hash % fonts.length];
                      
                      // Calculate text color for THIS specific book's color: 50% darker or brighter based on background luminance
                      const bookColorHex = styleSet.main; // This book's specific color
                      const r = parseInt(bookColorHex.slice(1, 3), 16);
                      const g = parseInt(bookColorHex.slice(3, 5), 16);
                      const b = parseInt(bookColorHex.slice(5, 7), 16);
                      
                      // Calculate relative luminance (0-1) for this book's color
                      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                      
                      // If this book's background is light (luminance > 0.5), make text 50% darker
                      // If this book's background is dark (luminance <= 0.5), make text 50% brighter
                      const factor = luminance > 0.5 ? -0.5 : 0.5;
                      
                      const textR = Math.max(0, Math.min(255, Math.round(r * (1 + factor))));
                      const textG = Math.max(0, Math.min(255, Math.round(g * (1 + factor))));
                      const textB = Math.max(0, Math.min(255, Math.round(b * (1 + factor))));
                      
                      const textColor = `rgb(${textR}, ${textG}, ${textB})`;
                      
                      // Height based on score (224-336px range, 20% smaller)
                      const height = score > 0 ? (280 + (score * 28)) * 0.8 : 280 * 0.8;
                      // Width varies (44-68px, 20% smaller)
                      const width = (55 + (hash % 30)) * 0.8;
                      
                      // Font sizing logic - Maximal sizing for vertical text
                      const availableHeight = height - 80; // 40px buffer for decoration and margin
                      const availableWidth = width - 10; // 5px padding on each side
                      let fontSize = availableWidth;
                      
                      // If showing author, account for both title and author height
                      if (bookshelfGrouping === 'author' && book.author) {
                        const titleHeight = book.title.length * (fontSize * 0.55);
                        const authorHeight = book.author.length * (fontSize * 0.5 * 0.55); // 50% size
                        const gap = fontSize * 0.1; // Small gap between title and author
                        const totalHeight = titleHeight + authorHeight + gap;
                        
                        if (totalHeight > availableHeight) {
                          // Scale down to fit both
                          fontSize = (availableHeight / (book.title.length * 0.55 + book.author.length * 0.5 * 0.55 + 0.1));
                        }
                      } else {
                        // Only title, use original logic
                        const estimatedTextLength = book.title.length * (fontSize * 0.55);
                        if (estimatedTextLength > availableHeight) {
                          fontSize = (availableHeight / book.title.length) / 0.55;
                        }
                      }
                      
                      fontSize = Math.max(fontSize, 20);
                      
                      // Find book index in original array for navigation
                      const bookIndex = books.findIndex(b => b.id === book.id);
                      
                      return (
                        <motion.div
                          key={book.id}
                          initial={{ opacity: 0, y: 200 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            delay: (groupIdx * 0.1) + (idx * 0.05), 
                            duration: 0.6,
                            type: "spring",
                            stiffness: 100,
                            damping: 15
                          }}
                          className="flex flex-col items-center"
                        >
                          {/* Rating - Above the book */}
                          {avgScore && (
                            <div className="flex items-center gap-1 mb-3">
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              <span className="font-black text-sm text-slate-950">
                                {avgScore}
                              </span>
                            </div>
                          )}
                          
                          {/* Book Spine */}
                          <div
                            className="book-spine relative flex-shrink-0 cursor-pointer group"
                            style={{
                              height: `${height}px`,
                              width: `${width}px`,
                              backgroundColor: styleSet.main,
                              color: textColor,
                            } as React.CSSProperties}
                            onClick={() => {
                              if (bookIndex !== -1) {
                                setScrollY(0); // Reset scroll when switching views
                                setSelectedIndex(bookIndex);
                                setShowBookshelf(false);
                                setTimeout(() => {
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }, 100);
                              }
                            }}
                          >
                            {/* Tooltip */}
                            {avgScore && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50"
                                style={{
                                  top: '-65px',
                                  background: '#1d1d1f',
                                  color: '#fff',
                                  padding: '8px 14px',
                                  borderRadius: '10px',
                                  fontSize: '0.8rem',
                                  fontWeight: '700',
                                  boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                                }}
                              >
                                <span className="text-[#ffd60a] mr-1">
                                  {'★'.repeat(Math.floor(parseFloat(avgScore)))}
                                  {'☆'.repeat(5 - Math.floor(parseFloat(avgScore)))}
                                </span>
                                {avgScore}
                              </div>
                            )}
                            
                            {/* Decoration Stripes */}
                            <div
                              className="absolute top-[15px] left-1/2 -translate-x-1/2 flex flex-col gap-1 opacity-30 z-10"
                              style={{ width: '60%', color: styleSet.accent }}
                            >
                              <div className="h-[3px] w-full rounded-sm" style={{ background: 'currentColor' }} />
                              <div className="h-[3px] w-full rounded-sm" style={{ background: 'currentColor' }} />
                            </div>
                            
                            {/* Spine Content */}
                            <div
                              className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none z-0"
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                                fontFamily: bookFont,
                              }}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className="text-center leading-[0.85] whitespace-nowrap"
                                  style={{
                                    fontSize: `${fontSize}px`,
                                  }}
                                >
                                  {book.title.toUpperCase()}
                                </div>
                                {bookshelfGrouping === 'author' && book.author && (
                                  <div
                                    className="text-center leading-[0.85] whitespace-nowrap opacity-80"
                                    style={{
                                      fontSize: `${fontSize * 0.5}px`,
                                    }}
                                  >
                                    {book.author.toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Bottom Shadow */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-0"
                              style={{
                                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.15), transparent)',
                                filter: 'blur(10px)',
                                transform: 'translateY(50%)',
                              }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.main>
        ) : (
          <motion.main
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            ref={(el) => {
              if (el) {
                // Enable rubber band bounce effect
                el.style.overscrollBehaviorY = 'auto';
                (el.style as any).webkitOverflowScrolling = 'touch';
              }
            }}
            className="flex-1 flex flex-col items-center justify-start p-4 relative pt-28 overflow-y-auto pb-20 ios-scroll"
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
            onTouchStart={(e) => {
              // Track touch start for book navigation swipe
              const touch = e.touches[0];
              setBookTouchStart({ x: touch.clientX, y: touch.clientY });
            }}
            onTouchMove={(e) => {
              // Allow native bounce on touch devices
              const target = e.currentTarget;
              const { scrollTop, scrollHeight, clientHeight } = target;
              const isAtTop = scrollTop === 0;
              const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
              
              // Track touch end for swipe detection (only at top/bottom to avoid scroll interference)
              if ((isAtTop || isAtBottom) && bookTouchStart) {
                const touch = e.touches[0];
                setBookTouchEnd({ x: touch.clientX, y: touch.clientY });
              }
              
              // Let native bounce behavior work
              if (isAtTop || isAtBottom) {
                // Native iOS bounce will handle this
                return;
              }
            }}
            onTouchEnd={() => {
              if (bookTouchStart && bookTouchEnd) {
                handleBookSwipe();
              }
            }}
          >
        {books.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto mb-4" />
          </div>
        ) : (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-6 pb-8">
            <div 
              className="relative w-full aspect-[2/3] overflow-hidden group rounded-lg"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Front side - Book cover */}
              <AnimatePresence mode="wait">
                {!isShowingNotes && (
                  <motion.div
                    key="cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <AnimatePresence mode='wait'>
                      <motion.div key={activeBook.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="relative w-full h-full rounded-lg overflow-hidden">
                        {activeBook.cover_url ? (
                          <>
                            <img src={activeBook.cover_url} alt={activeBook.title} className="w-full h-full object-cover" />
                            {/* Skeuomorphic book effect overlay */}
                            <div 
                              className="absolute inset-0 pointer-events-none rounded-lg"
                              style={{
                                background: `linear-gradient(to right,
                                  rgba(0,0,0,0.02) 0%,
                                  rgba(0,0,0,0.05) 0.75%,
                                  rgba(255,255,255,0.5) 1.0%,
                                  rgba(255,255,255,0.6) 1.3%,
                                  rgba(255,255,255,0.5) 1.4%,
                                  rgba(255,255,255,0.3) 1.5%,
                                  rgba(255,255,255,0.3) 2.4%,
                                  rgba(0,0,0,0.05) 2.7%,
                                  rgba(0,0,0,0.05) 3.5%,
                                  rgba(255,255,255,0.3) 4%,
                                  rgba(255,255,255,0.3) 4.5%,
                                  rgba(244,244,244,0.1) 5.4%,
                                  rgba(244,244,244,0.1) 99%,
                                  rgba(144,144,144,0.2) 100%)`
                              }}
                            />
                          </>
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${getGradient(activeBook.id)} text-white rounded-lg`}>
                            <BookOpen size={48} className="mb-4 opacity-30" />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Back side - Notes */}
              <AnimatePresence mode="wait">
                {isShowingNotes && (
                  <motion.div
                    key="notes"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full bg-white rounded-3xl p-4 flex flex-col"
                  >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-950">Notes</h3>
                    <button
                      onClick={() => setIsShowingNotes(false)}
                      className="p-1.5 text-slate-600 hover:text-slate-800 active:scale-95 transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setNoteText(newText);
                      // Clear existing timeout
                      if (noteSaveTimeoutRef.current) {
                        clearTimeout(noteSaveTimeoutRef.current);
                      }
                      // Debounced auto-save after 1 second of no typing
                      noteSaveTimeoutRef.current = setTimeout(() => {
                        handleSaveNote(newText);
                      }, 1000);
                    }}
                    onBlur={() => handleSaveNote()}
                    placeholder="Write your notes here..."
                    className="flex-1 w-full resize-none border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 bg-transparent"
                    style={{ minHeight: 0 }}
                  />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isConfirmingDelete && !isShowingNotes && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-red-600/20 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
                    <AlertCircle size={48} className="mb-4" /><h3 className="text-xl font-bold mb-2">Delete this book?</h3>
                    <div className="flex flex-col w-full gap-2">
                      <button onClick={handleDelete} className="w-full py-3 bg-white text-red-600 rounded-xl font-black active:scale-95 transition-transform">Yes, Remove</button>
                      <button onClick={() => setIsConfirmingDelete(false)} className="w-full py-3 bg-red-700 text-white rounded-xl font-bold active:scale-95 transition-transform">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showRatingOverlay && !isConfirmingDelete && !isShowingNotes && currentEditingDimension && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 20 }} 
                    className="absolute bottom-16 left-4 right-4 z-40 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 flex flex-col items-center justify-center p-4 rounded-2xl border border-white/30 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.div 
                      key={currentEditingDimension} 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.9 }} 
                      className="w-full"
                    >
                      <RatingStars 
                        dimension={currentEditingDimension} 
                        value={activeBook.ratings[currentEditingDimension]} 
                        onRate={(dim, val) => handleRate(activeBook.id, dim, val)} 
                      />
                    </motion.div>
                    {/* Navigation dots and Skip button */}
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <div className="flex gap-1.5">
                        {RATING_DIMENSIONS.map((dim, idx) => (
                          <button
                            key={dim}
                            onClick={() => setEditingDimension(dim)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              dim === currentEditingDimension 
                                ? 'bg-blue-600 w-6' 
                                : 'bg-slate-400'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          if (activeBook && currentEditingDimension) {
                            handleRate(activeBook.id, currentEditingDimension, null);
                          }
                        }}
                        className="px-3 py-1 text-xs font-medium text-black hover:text-slate-800 active:scale-95 transition-all"
                      >
                        Skip
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Click outside to close rating overlay */}
              {showRatingOverlay && (
                <div 
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingDimension(null);
                  }}
                />
              )}

              {/* Reading Status Selection Overlay */}
              <AnimatePresence>
                {selectingReadingStatus && pendingBookMeta && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                      onClick={() => {
                        setSelectingReadingStatus(false);
                        setPendingBookMeta(null);
                      }}
                    >
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.9, y: 20 }} 
                        className="bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-2xl border border-white/30 shadow-2xl p-6 max-w-sm w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="text-lg font-bold text-slate-950 mb-4 text-center">How would you like to categorize this book?</h3>
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => handleAddBookWithStatus('read_it')}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold active:scale-95 transition-all"
                          >
                            Read it
                          </button>
                          <button
                            onClick={() => handleAddBookWithStatus('reading')}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold active:scale-95 transition-all"
                          >
                            Reading
                          </button>
                          <button
                            onClick={() => handleAddBookWithStatus('want_to_read')}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold active:scale-95 transition-all"
                          >
                            Want to read
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Reading Status Indicator Button - top left */}
              <AnimatePresence>
                {!isShowingNotes && activeBook && (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() => {
                      // Cycle through reading statuses
                      const statuses: ReadingStatus[] = ['read_it', 'reading', 'want_to_read', null];
                      const currentIndex = statuses.indexOf(activeBook.reading_status || null);
                      const nextIndex = (currentIndex + 1) % statuses.length;
                      const newStatus = statuses[nextIndex];
                      handleUpdateReadingStatus(activeBook.id, newStatus);
                    }}
                    className="absolute top-4 left-4 z-30 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 px-3 py-1.5 rounded-full shadow-lg text-black hover:text-blue-600 active:scale-90 transition-all border border-white/30"
                  >
                    <span className="text-xs font-bold">
                      {activeBook.reading_status === 'read_it' ? '✓ Read it' :
                       activeBook.reading_status === 'reading' ? '📖 Reading' :
                       activeBook.reading_status === 'want_to_read' ? '📚 Want to read' :
                       '📖'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Pencil button - top right */}
              <AnimatePresence>
                {!isShowingNotes && (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() => setIsShowingNotes(true)}
                    className="absolute top-4 right-4 z-30 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 p-2.5 rounded-full shadow-lg text-black hover:text-blue-600 active:scale-90 transition-all border border-white/30"
                  >
                    <Pencil size={20} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Delete button - bottom right */}
              <AnimatePresence>
                {!isShowingNotes && (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() => setIsConfirmingDelete(true)} 
                    className="absolute bottom-4 right-4 z-30 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 p-2.5 rounded-full shadow-lg text-black hover:text-red-600 active:scale-90 transition-all border border-white/30"
                  >
                    <Trash2 size={20} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Rating button - bottom left */}
              <AnimatePresence>
                {!isShowingNotes && (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() => {
                      setIsEditing(true);
                      setEditingDimension(null); // Will default to first unrated or first dimension
                    }} 
                    className="absolute bottom-4 left-4 z-30 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 active:scale-90 transition-transform border border-white/30"
                  >
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span className="font-black text-sm text-slate-950">
                      {calculateAvg(activeBook.ratings) || 'Rate'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>

              {books.length > 1 && (
                <>
                  <button onClick={() => setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1))} className="absolute left-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={36} /></button>
                  <button onClick={() => setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0))} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={36} /></button>
                </>
              )}
            </div>
            
            {/* Info box - always open, below cover and above facts */}
            {!showRatingOverlay && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mt-2"
              >
                <div className="bg-white/80 backdrop-blur-md shadow-xl border border-white/30 rounded-2xl px-4 py-3 mx-auto">
                  {/* Line 1: Title */}
                  <h2 className="text-sm font-black text-slate-950 leading-tight line-clamp-2 mb-2">{activeBook.title}</h2>
                  {/* Line 2: Author, Year, Source */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-800">{activeBook.author}</p>
                    {activeBook.publish_year && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800">
                          {activeBook.publish_year}
                        </span>
                      </>
                    )}
                    {activeBook.genre && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800">
                          {activeBook.genre}
                        </span>
                      </>
                    )}
                    {(activeBook.wikipedia_url || activeBook.google_books_url) && (
                      <>
                        <span className="text-slate-300">•</span>
                        <a 
                          href={activeBook.google_books_url || activeBook.wikipedia_url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] text-blue-700 flex items-center gap-0.5 uppercase font-bold tracking-widest hover:underline"
                        >
                          Source <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Author Facts Tooltips - Show below cover with spacing */}
            {!showRatingOverlay && (
              <>
                {/* Facts: Only show loading if we don't have facts yet. Once loaded, always show. */}
                {(() => {
                  const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
                  const isLoadingFacts = loadingFactsForBookId === activeBook.id && !hasFacts;
                  
                  // Always render the component - it will handle showing loading or facts
                  return (
                    <AuthorFactsTooltips 
                      facts={activeBook.author_facts || []} 
                      bookId={activeBook.id}
                      isLoading={isLoadingFacts}
                    />
                  );
                })()}
                
                {/* Podcast Episodes - Show below author facts */}
                {(() => {
                  const episodes = combinedPodcastEpisodes;
                  const hasEpisodes = episodes.length > 0;
                  // Only show loading if we don't have episodes yet. Once loaded, always show.
                  const isLoading = activeBook && loadingPodcastsForBookId === activeBook.id && !hasEpisodes;
                  
                  // Always show the podcast section
                  return (
                    <div className="w-full space-y-2">
                      {/* Podcast Header */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md border border-white/30 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">PODCASTS:</span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className="text-[10px] font-bold text-blue-700">Curated + Apple</span>
                        </div>
                      </div>
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
                        >
                          <div className="h-12 flex items-center justify-center">
                            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                          </div>
                        </motion.div>
                      ) : hasEpisodes ? (
                        // Show episodes - once loaded, always show
                        <PodcastEpisodes 
                          episodes={episodes} 
                          bookId={activeBook?.id || ''}
                          isLoading={false}
                        />
                      ) : (
                        // Show no results state
                        <div className="w-full bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
                          <p className="text-xs text-slate-600 text-center">No podcasts found</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* Analysis Articles - Show below podcasts */}
                {(() => {
                  const articles = analysisArticles.get(activeBook.id) || [];
                  // Check if we have real articles (not just the fallback search URL)
                  // A fallback article has a title that starts with "Search Google Scholar" and URL contains "scholar.google.com/scholar?q="
                  const hasRealArticles = articles.length > 0 && articles.some(article => {
                    const isFallback = article.title?.includes('Search Google Scholar') || 
                                       (article.url && article.url.includes('scholar.google.com/scholar?q='));
                    return !isFallback;
                  });
                  const hasOnlyFallback = articles.length > 0 && !hasRealArticles;
                  const hasArticles = hasRealArticles;
                  const isLoading = loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;
                  
                  // Always show the analysis section
                  return (
                    <div className="w-full space-y-2">
                      {/* Analysis Header */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md border border-white/30 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">ANALYSIS:</span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className="text-[10px] font-bold text-blue-700">Google Scholar</span>
                        </div>
                      </div>
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
                        >
                          <div className="h-12 flex items-center justify-center">
                            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                          </div>
                        </motion.div>
                      ) : hasArticles ? (
                        // Show articles - once loaded, always show
                        <AnalysisArticles 
                          articles={articles} 
                          bookId={activeBook.id}
                          isLoading={false}
                        />
                      ) : (
                        // Show no results state (either no articles or only fallback)
                        <div className="w-full bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
                          <p className="text-xs text-slate-600 text-center">No analysis found</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* YouTube Videos - Show below analysis */}
                {(() => {
                  const videos = youtubeVideos.get(activeBook.id) || [];
                  const hasVideos = videos.length > 0;
                  const isLoading = loadingVideosForBookId === activeBook.id && !hasVideos;
                  
                  // Always show the videos section
                  return (
                    <div className="w-full space-y-2">
                      {/* Videos Header */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md border border-white/30 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">VIDEOS:</span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className="text-[10px] font-bold text-blue-700">YouTube</span>
                        </div>
                      </div>
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
                        >
                          <div className="h-12 flex items-center justify-center">
                            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                          </div>
                        </motion.div>
                      ) : hasVideos ? (
                        <YouTubeVideos 
                          videos={videos} 
                          bookId={activeBook.id}
                          isLoading={false}
                        />
                      ) : (
                        // Show no results state
                        <div className="w-full bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
                          <p className="text-xs text-slate-600 text-center">No videos found</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Related Books - Show below videos */}
                {(() => {
                  const related = relatedBooks.get(activeBook.id) || [];
                  const hasRelated = related.length > 0;
                  const isLoading = loadingRelatedForBookId === activeBook.id && !hasRelated;
                  
                  // Always show the related books section
                  return (
                    <div className="w-full space-y-2">
                      {/* Related Books Header */}
                      <div className="flex items-center justify-center mb-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md border border-white/30 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">RELATED:</span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className="text-[10px] font-bold text-blue-700">Grok</span>
                        </div>
                      </div>
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30"
                        >
                          <div className="h-12 flex items-center justify-center">
                            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                          </div>
                        </motion.div>
                      ) : hasRelated ? (
                        <RelatedBooks 
                          books={related} 
                          bookId={activeBook.id}
                          isLoading={false}
                          onAddBook={handleAddBook}
                        />
                      ) : (
                        // Show no results state
                        <div className="w-full bg-white/80 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/30">
                          <p className="text-xs text-slate-600 text-center">No related books found</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
          </motion.main>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-4 left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none">
        <div className="flex items-center gap-2 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-2xl px-3 py-2.5 shadow-2xl border border-white/30 pointer-events-auto">
          {/* Books button - left (active, circular) */}
          <button
            onClick={() => {
              setScrollY(0); // Reset scroll when switching views
              setShowBookshelf(false);
              setShowBookshelfCovers(false);
              setShowNotesView(false);
              // Scroll to top to show books
              const main = document.querySelector('main');
              if (main) {
                main.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              !showBookshelf && !showNotesView
                ? 'bg-white/40 hover:bg-white/50' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            <BookOpen size={18} className="text-slate-950" />
          </button>

          {/* Bookshelf button - middle (circular) */}
          <button
            onClick={() => {
              setScrollY(0); // Reset scroll when switching views
              setShowBookshelf(!showBookshelf);
              setShowBookshelfCovers(false);
              setShowNotesView(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showBookshelf 
                ? 'bg-white/40 hover:bg-white/50' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            <Library size={18} className="text-slate-950" />
          </button>

          {/* Bookshelf Covers button - between bookshelf and notes */}
          <button
            onClick={() => {
              setScrollY(0); // Reset scroll when switching views
              setShowBookshelfCovers(!showBookshelfCovers);
              setShowBookshelf(false);
              setShowNotesView(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showBookshelfCovers 
                ? 'bg-white/40 hover:bg-white/50' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            <Grid3x3 size={18} className="text-slate-950" />
          </button>

          {/* Notes button - between bookshelf covers and search */}
          <button
            onClick={() => {
              setScrollY(0); // Reset scroll when switching views
              setShowNotesView(!showNotesView);
              setShowBookshelf(false);
              setShowBookshelfCovers(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showNotesView 
                ? 'bg-white/40 hover:bg-white/50' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            <Pencil size={18} className="text-slate-950" />
          </button>

          {/* Search button - right (circular) */}
          <button
            onClick={() => setIsAdding(true)}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center ml-auto"
          >
            <Search size={18} className="text-slate-950" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <AddBookSheet 
            isOpen={isAdding} 
            onClose={() => setIsAdding(false)} 
            onAdd={handleAddBook}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
