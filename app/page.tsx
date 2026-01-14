'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Loader2,
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { supabase } from '@/lib/supabase';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

// --- Types & Constants ---
const RATING_DIMENSIONS = ['writing', 'insight', 'flow'] as const;
const grokApiKey = process.env.NEXT_PUBLIC_GROK_API_KEY || "";

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

// Supabase database schema interface
interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string;
  publish_year?: number | null;
  cover_url?: string | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  rating_writing?: number | null;
  rating_insight?: number | null;
  rating_flow?: number | null;
  author_facts?: string[] | null; // JSON array of author facts
  podcast_episodes?: PodcastEpisode[] | null; // JSON array of podcast episodes (deprecated - use source-specific columns)
  podcast_episodes_grok?: PodcastEpisode[] | null; // JSON array of podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[] | null; // JSON array of podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[] | null; // JSON array of podcast episodes from curated source
  created_at: string;
  updated_at: string;
}

// Local app interface (for easier manipulation)
interface BookWithRatings extends Omit<Book, 'rating_writing' | 'rating_insight' | 'rating_flow'> {
  ratings: {
    writing: number | null;
    insight: number | null;
    flow: number | null;
  };
  author_facts?: string[]; // Fun facts about the author
  podcast_episodes?: PodcastEpisode[]; // Podcast episodes about the book (deprecated - use source-specific)
  podcast_episodes_grok?: PodcastEpisode[]; // Podcast episodes from Grok
  podcast_episodes_apple?: PodcastEpisode[]; // Podcast episodes from Apple Podcasts
  podcast_episodes_curated?: PodcastEpisode[]; // Podcast episodes from curated source
}

// --- API Helpers ---

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      
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
      
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        if (i === retries - 1) throw new Error(`HTTP ${res.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
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
        "Authorization": `Bearer ${grokApiKey}`
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
        "Authorization": `Bearer ${grokApiKey}`
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
    // Don't silently fail - show the error
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
        "Authorization": `Bearer ${grokApiKey}`
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

async function getPodcastEpisodes(bookTitle: string, author: string, source: 'apple' | 'curated' = 'curated'): Promise<PodcastEpisode[]> {
  console.log(`[getPodcastEpisodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${author} from ${source}`);
  if (source === 'curated') {
    return getCuratedPodcastEpisodes(bookTitle, author);
  }
  if (source === 'apple') {
    return getApplePodcastEpisodes(bookTitle, author);
  }
  return getGrokPodcastEpisodes(bookTitle, author);
}

// --- Apple Books API (iTunes Search) ---
async function lookupBooksOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>[]> {
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
async function lookupBookOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'> | null> {
  const books = await lookupBooksOnAppleBooks(query);
  return books.length > 0 ? books[0] : null;
}

// --- Grok Book Search ---
async function lookupBooksOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>[]> {
  // For now, Grok returns a single result, so we'll wrap it in an array
  const result = await lookupBookOnGrok(query);
  return result ? [result] : [];
}

async function lookupBookOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'> | null> {
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

async function getAuthorAndYearFromWikidata(qid: string, lang = 'en'): Promise<{ author: string; publishYear?: number }> {
  const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&ids=${encodeURIComponent(qid)}&props=claims`;
  const entityData = await fetchWithRetry(entityUrl);
  const ent = entityData?.entities?.[qid];
  const claims = ent?.claims ?? {};

  const authorClaims = claims?.P50 ?? [];
  const authorIds = authorClaims.map((c: any) => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);

  const dateClaim = (claims?.P577?.[0] ?? claims?.P571?.[0]);
  const timeStr = dateClaim?.mainsnak?.datavalue?.value?.time; 
  const publishYear = first4DigitYear(timeStr);

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
  return { author, publishYear };
}

async function lookupBooksOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>[]> {
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
      const { author, publishYear } = qid ? await getAuthorAndYearFromWikidata(qid, lang) : { author: summaryData.extract?.split('(')[0]?.trim() || 'Unknown Author', publishYear: undefined };
      
      return {
        title: summaryData.title || pageTitle,
        author: author,
        publish_year: publishYear,
        cover_url: summaryData.thumbnail?.source?.replace('http://', 'https://') || null,
        wikipedia_url: summaryData.content_urls?.desktop?.page || null,
        google_books_url: null,
      };
    })
  );
  
  return books;
}

async function lookupBookOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'> | null> {
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
  
  if (qid) {
    const wdData = await getAuthorAndYearFromWikidata(qid, lang);
    author = wdData.author || author;
    publishYear = wdData.publishYear;
  }

  return {
    title: summaryData.title || pageTitle,
    author: author,
    publish_year: publishYear,
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
  return {
    ...book,
    ratings: {
      writing: book.rating_writing ?? null,
      insight: book.rating_insight ?? null,
      flow: book.rating_flow ?? null,
    },
    author_facts: book.author_facts || undefined, // Load from database
    podcast_episodes: book.podcast_episodes || undefined, // Load from database (legacy)
    podcast_episodes_grok: book.podcast_episodes_grok || undefined, // Load from database
    podcast_episodes_apple: book.podcast_episodes_apple || undefined, // Load from database
    podcast_episodes_curated: book.podcast_episodes_curated || undefined, // Load from database
  };
}

function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    title: book.title,
    author: book.author,
    publish_year: book.publish_year,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
    google_books_url: book.google_books_url,
    rating_writing: book.ratings.writing,
    rating_insight: book.ratings.insight,
    rating_flow: book.ratings.flow,
  };
}

function calculateAvg(ratings: BookWithRatings['ratings']): string | null {
  const values = Object.values(ratings).filter(v => v != null) as number[];
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
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
            <p className="text-[10px] text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
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
          <div className="space-y-3">
            <div className="h-4 bg-slate-300/50 rounded animate-pulse" />
            <div className="h-3 bg-slate-300/50 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-slate-300/50 rounded w-2/3 animate-pulse" />
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
            <div className="text-[10px] text-slate-700 space-y-1 mb-2">
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
            <p className="text-[10px] font-medium text-slate-800 leading-relaxed mb-1">
              {currentEpisode.episode_summary}
            </p>
            {currentEpisode.podcast_summary && (
              <p className="text-[9px] text-slate-600 italic">
                {currentEpisode.podcast_summary}
              </p>
            )}
            <p className="text-[10px] text-slate-600 text-center mt-2 font-bold uppercase tracking-wider">
              Tap for next ({currentIndex + 1}/{episodes.length})
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RatingStarsProps {
  value: number | null;
  onRate: (dimension: string, value: number) => void;
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
    setTimeout(() => onRate(dimension, star), 450);
  }

  return (
    <div className="flex flex-col items-center gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 mb-1">{dimension}</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} onClick={() => handleTap(star)} className="p-1 focus:outline-none" whileTap={{ scale: 0.7 }}>
            <Star 
              size={32} 
              className={`transition-all duration-300 ease-out ${star <= localValue ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300 fill-transparent scale-100'}`}
              style={{ transitionDelay: star <= localValue ? `${star * 50}ms` : '0ms' }}
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
  onAdd: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>) => void;
}

function AddBookSheet({ isOpen, onClose, onAdd }: AddBookSheetProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>[]>([]);
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
    
    let searchPromise: Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>[]>;
    
    if (searchSource === 'apple_books') {
      searchPromise = lookupBooksOnAppleBooks(titleToSearch);
    } else {
      searchPromise = lookupBooksOnWikipedia(titleToSearch);
    }
    
    const aiPromise = getAISuggestions(titleToSearch);

    try {
      const [results, aiSuggestions] = await Promise.all([searchPromise, aiPromise]);
      
      setSuggestions(aiSuggestions);
      setSearchResults(results);

      if (results.length === 0) {
        const sourceName = searchSource === 'apple_books' ? 'Apple Books' : 'Wikipedia';
        setError(`No results found on ${sourceName}.`);
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
  }
  
  function handleSelectBook(book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>) {
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
                <Loader2 className="animate-spin text-blue-500" size={20} />
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [loadingFactsForBookId, setLoadingFactsForBookId] = useState<string | null>(null);
  const [loadingPodcastsForBookId, setLoadingPodcastsForBookId] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [backgroundGradient, setBackgroundGradient] = useState<string>('241,245,249,226,232,240'); // Default slate colors as RGB
  const [podcastSource, setPodcastSource] = useState<'apple' | 'curated'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('podcastSource');
      // Migrate old 'grok' values to 'curated'
      if (saved === 'grok') {
        localStorage.setItem('podcastSource', 'curated');
        return 'curated';
      }
      return (saved as 'apple' | 'curated') || 'curated';
    }
    return 'curated';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('podcastSource', podcastSource);
    }
  }, [podcastSource]);

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
        if (!session) {
          console.error('No session found when loading books');
          setIsLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from('books')
          .select('*')
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
    setEditingDimension(null);
    
    setIsMetaExpanded(true);
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [selectedIndex]);

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
    if (currentBook.author_facts && currentBook.author_facts.length > 0) {
      // Show loading state briefly even when loading from DB for consistent UX
      const bookId = currentBook.id;
      const factsCount = currentBook.author_facts.length;
      setLoadingFactsForBookId(bookId);
      setTimeout(() => {
        console.log(`[Author Facts] ✅ Loaded from database for "${currentBook.title}" by ${currentBook.author}: ${factsCount} facts`);
        setLoadingFactsForBookId(null);
      }, 800); // Brief delay to show loading animation
      return;
    }

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
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({ author_facts: facts, updated_at: new Date().toISOString() })
              .eq('id', bookId);
            
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

    // Check if podcasts already exist in database for the selected source
    const sourceEpisodes = podcastSource === 'curated'
      ? currentBook.podcast_episodes_curated
      : currentBook.podcast_episodes_apple;
    
    // Fallback to legacy podcast_episodes if source-specific doesn't exist
    const episodes = sourceEpisodes || currentBook.podcast_episodes;
    
    if (episodes && episodes.length > 0) {
      // Show loading state briefly even when loading from DB for consistent UX
      setLoadingPodcastsForBookId(bookId);
      setTimeout(() => {
        const sourceName = podcastSource === 'curated' 
          ? 'Curated' 
          : 'Apple Podcasts';
        console.log(`[Podcast Episodes] ✅ Loaded ${episodes.length} episodes from database (${sourceName}) for "${currentBook.title}" by ${currentBook.author}`);
        setLoadingPodcastsForBookId(null);
        
        // Update local state with source-specific episodes if we used legacy data
        if (!sourceEpisodes && currentBook.podcast_episodes) {
          const updateField = podcastSource === 'curated'
            ? 'podcast_episodes_curated'
            : 'podcast_episodes_apple';
          setBooks(prev => prev.map(book => 
            book.id === currentBook.id 
              ? { ...book, [updateField]: currentBook.podcast_episodes }
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
      const sourceName = podcastSource === 'curated' 
        ? 'Curated' 
        : 'Apple Podcasts';
      
      console.log(`[Podcast Episodes] 🔄 Fetching from ${sourceName} for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor, podcastSource).then(async (episodes) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingPodcastsForBookId(null);
        
        if (episodes.length > 0) {
          const sourceName = podcastSource === 'curated' 
            ? 'Curated' 
            : 'Apple Podcasts';
          console.log(`[Podcast Episodes] ✅ Received ${episodes.length} episodes from ${sourceName} for "${bookTitle}"`);
          // Save to database with source-specific column
          const updateField = podcastSource === 'curated'
            ? 'podcast_episodes_curated'
            : 'podcast_episodes_apple';
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({ [updateField]: episodes, updated_at: new Date().toISOString() })
              .eq('id', bookId);
            
            if (updateError) throw updateError;
            
            console.log(`[Podcast Episodes] 💾 Saved ${episodes.length} episodes to database for "${bookTitle}"`);
            
            // Update local state with source-specific episodes
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { ...book, [updateField]: episodes }
                : book
            ));
          } catch (err: any) {
            console.error('[Podcast Episodes] ❌ Error saving to database:', err);
            console.error('[Podcast Episodes] Error details:', err.message, err.code, err.details);
            if (err.code === '42703' || err.message?.includes('column') || err.message?.includes('podcast_episodes')) {
              console.error('[Podcast Episodes] ⚠️ Database column "podcast_episodes" may not exist. Run this SQL in Supabase:');
              console.error('ALTER TABLE public.books ADD COLUMN IF NOT EXISTS podcast_episodes jsonb;');
            }
            // Still update local state even if DB save fails
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { ...book, [updateField]: episodes }
                : book
            ));
          }
        } else {
          console.log(`[Podcast Episodes] ⚠️ No episodes received from Grok API for "${bookTitle}"`);
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
  }, [selectedIndex, books, podcastSource]); // Depend on selectedIndex, books, and podcastSource

  async function handleAddBook(meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>) {
    if (!user) return;

    try {
      // Ensure all required fields are present and properly formatted
      const bookData = {
        title: meta.title || '',
        author: meta.author || 'Unknown Author',
        publish_year: meta.publish_year ?? null,
        cover_url: meta.cover_url ?? null,
        wikipedia_url: meta.wikipedia_url ?? null,
        google_books_url: meta.google_books_url ?? null,
        user_id: user.id,
        rating_writing: null,
        rating_insight: null,
        rating_flow: null,
      };

      console.log('Inserting book data:', JSON.stringify(bookData, null, 2));

      const { data, error } = await supabase
        .from('books')
        .insert(bookData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        console.error('Attempted to insert:', JSON.stringify({
          ...meta,
          user_id: user.id,
          rating_writing: null,
          rating_insight: null,
          rating_flow: null,
        }, null, 2));
        console.error('Meta object:', meta);
        console.error('Meta keys:', Object.keys(meta));
        throw error;
      }

      const newBook = convertBookToApp(data);
      const newBooks = [newBook, ...books];
      setBooks(newBooks);
      setSelectedIndex(0);
      // Automatically open rating overlay for new book
      setIsEditing(true);
      setEditingDimension(null); // Will default to first unrated dimension

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

        // Fetch podcast episodes
        const sourceName = podcastSource === 'curated' 
          ? 'Curated' 
          : 'Apple Podcasts';
        console.log(`[Podcast Episodes] 🔄 Fetching from ${sourceName} for new book "${meta.title}" by ${meta.author}...`);
        setLoadingPodcastsForBookId(newBook.id);
        getPodcastEpisodes(meta.title, meta.author, podcastSource).then(async (episodes) => {
          setLoadingPodcastsForBookId(null);
          if (episodes.length > 0) {
            console.log(`[Podcast Episodes] ✅ Received ${episodes.length} episodes from ${sourceName} for "${meta.title}"`);
            // Save to database with source-specific column
            const updateField = podcastSource === 'curated'
              ? 'podcast_episodes_curated'
              : 'podcast_episodes_apple';
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ [updateField]: episodes, updated_at: new Date().toISOString() })
                .eq('id', newBook.id);
              
              if (updateError) throw updateError;
              
              console.log(`[Podcast Episodes] 💾 Saved ${episodes.length} episodes to database (${podcastSource}) for "${meta.title}"`);
              
              // Update local state with source-specific episodes
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { ...book, [updateField]: episodes }
                  : book
              ));
            } catch (err: any) {
              console.error('[Podcast Episodes] ❌ Error saving to database:', err);
              console.error('[Podcast Episodes] Error details:', err.message, err.code, err.details);
              if (err.code === '42703' || err.message?.includes('column')) {
                console.error(`[Podcast Episodes] ⚠️ Database column "${updateField}" may not exist. Run this SQL in Supabase:`);
                console.error(`ALTER TABLE public.books ADD COLUMN IF NOT EXISTS ${updateField} jsonb;`);
              }
              // Still update local state even if DB save fails
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { ...book, [updateField]: episodes }
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
    const ratingField = `rating_${dimension}` as 'rating_writing' | 'rating_insight' | 'rating_flow';
    
    // Optimistic update
    setBooks(prev => prev.map(book => 
      book.id === id 
        ? { ...book, ratings: { ...book.ratings, [dimension]: value } }
        : book
    ));

    try {
      const { error } = await supabase
        .from('books')
        .update({ [ratingField]: value, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
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
      }
    } catch (err) {
      console.error('Error updating rating:', err);
      // Revert on error
      setBooks(prev => prev.map(book => 
        book.id === id 
          ? { ...book, ratings: { ...book.ratings, [dimension]: null } }
          : book
      ));
    }
  }

  async function handleDelete() {
    if (!activeBook) return;

    try {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', activeBook.id);

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

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  // Show loading spinner while loading books (only if user is authenticated)
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
      {/* Simple header - fades on scroll */}
      <motion.div 
        className="w-full z-40 fixed top-[50px] left-0 right-0 px-4 py-3 flex items-center justify-between"
        animate={{ 
          opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
          pointerEvents: scrollY > 60 ? 'none' : 'auto'
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* BOOKS text on left */}
        <h1 className="text-2xl font-bold text-slate-950 drop-shadow-sm">BOOKS</h1>
        
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

      <main 
        ref={(el) => {
          if (el) {
            // Enable rubber band bounce effect
            el.style.overscrollBehaviorY = 'auto';
            el.style.webkitOverflowScrolling = 'touch';
          }
        }}
        className="flex-1 flex flex-col items-center justify-start p-4 relative pt-28 overflow-y-auto pb-20 ios-scroll"
        onScroll={(e) => {
          const target = e.currentTarget;
          setScrollY(target.scrollTop);
        }}
        onTouchMove={(e) => {
          // Allow native bounce on touch devices
          const target = e.currentTarget;
          const { scrollTop, scrollHeight, clientHeight } = target;
          const isAtTop = scrollTop === 0;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
          
          // Let native bounce behavior work
          if (isAtTop || isAtBottom) {
            // Native iOS bounce will handle this
            return;
          }
        }}
      >
        {books.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <img src="/logo.png" alt="BOOK" className="object-contain mx-auto mb-4" />
          </div>
        ) : (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-6 pb-8">
            <div className="relative w-full aspect-[2/3] rounded-3xl shadow-2xl border border-white/30 overflow-hidden group">
              <AnimatePresence mode='wait'>
                <motion.div key={activeBook.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full h-full">
                  {activeBook.cover_url ? (
                    <img src={activeBook.cover_url} alt={activeBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br ${getGradient(activeBook.id)} text-white`}>
                      <BookOpen size={48} className="mb-4 opacity-30" />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {isConfirmingDelete && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white">
                    <AlertCircle size={48} className="mb-4" /><h3 className="text-xl font-bold mb-2">Delete this book?</h3>
                    <div className="flex flex-col w-full gap-2">
                      <button onClick={handleDelete} className="w-full py-3 bg-white text-red-600 rounded-xl font-black active:scale-95 transition-transform">Yes, Remove</button>
                      <button onClick={() => setIsConfirmingDelete(false)} className="w-full py-3 bg-red-700 text-white rounded-xl font-bold active:scale-95 transition-transform">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showRatingOverlay && !isConfirmingDelete && currentEditingDimension && (
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
                    {/* Navigation dots */}
                    <div className="flex gap-1.5 mt-3">
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

              <button onClick={() => setIsConfirmingDelete(true)} className="absolute bottom-4 right-4 z-30 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 p-2.5 rounded-full shadow-lg text-slate-600 hover:text-red-600 active:scale-90 transition-all border border-white/30">
                <Trash2 size={20} />
              </button>

              <button 
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
              </button>

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
                  // Get episodes for the selected source
                  const sourceEpisodes = podcastSource === 'curated'
                    ? activeBook.podcast_episodes_curated
                    : activeBook.podcast_episodes_apple;
                  // Fallback to legacy podcast_episodes if source-specific doesn't exist
                  const episodes = sourceEpisodes || activeBook.podcast_episodes || [];
                  const hasEpisodes = episodes.length > 0;
                  // Only show loading if we don't have episodes yet. Once loaded, always show.
                  const isLoading = loadingPodcastsForBookId === activeBook.id && !hasEpisodes;
                  
                  // Always show the podcast section
                  return (
                    <div className="w-full space-y-2">
                      {/* Podcast Source Toggle */}
                      <div className="flex items-center justify-center mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Toggle between: curated -> apple -> curated
                            setPodcastSource(podcastSource === 'curated' ? 'apple' : 'curated');
                            // Episodes will be loaded automatically via useEffect dependency on podcastSource
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-md hover:bg-white/85 active:scale-95 transition-all border border-white/30 shadow-sm"
                        >
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">PODCASTS:</span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className={`text-[10px] font-bold transition-colors ${podcastSource === 'curated' ? 'text-blue-700' : 'text-slate-600'}`}>
                            Curated
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">/</span>
                          <span className={`text-[10px] font-bold transition-colors ${podcastSource === 'apple' ? 'text-blue-700' : 'text-slate-600'}`}>
                            Apple
                          </span>
                        </button>
                      </div>
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-full bg-slate-50 rounded-2xl p-6 border border-slate-200"
                        >
                          <div className="text-center text-slate-600 text-sm">
                            Loading podcasts...
                          </div>
                        </motion.div>
                      ) : hasEpisodes ? (
                        // Show episodes - once loaded, always show
                        <PodcastEpisodes 
                          episodes={episodes} 
                          bookId={activeBook.id}
                          isLoading={false}
                        />
                      ) : (
                        // Show no results state
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white/30 shadow-lg"
                        >
                          <div className="text-center">
                            <Headphones size={24} className="mx-auto mb-2 text-slate-600" />
                            <p className="text-slate-800 text-sm font-medium mb-1">No podcasts found</p>
                            <p className="text-slate-600 text-xs">Try switching to {podcastSource === 'curated' ? 'Apple' : 'Curated'} or search for a different book</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-4 left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none">
        <div className="flex items-center gap-2 bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-2xl px-3 py-2.5 shadow-2xl border border-white/30 pointer-events-auto">
          {/* Books button - left (active, circular) */}
          <button
            onClick={() => {
              // Scroll to top to show books
              const main = document.querySelector('main');
              if (main) {
                main.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center"
          >
            <BookOpen size={18} className="text-slate-950" />
          </button>

          {/* Bookshelf button - middle (circular) */}
          <button
            onClick={() => {
              // TODO: Add bookshelf functionality
            }}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center"
          >
            <Library size={18} className="text-slate-950" />
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
