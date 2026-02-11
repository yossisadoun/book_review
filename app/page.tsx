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
  Circle,
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
  BookMarked,
  ChevronDown,
  User,
  Users,
  MessageSquareQuote,
  MessagesSquare,
  GripVertical,
  Microscope,
  Trophy,
  Volume2,
  VolumeX,
  Rss,
  Birdhouse,
  X,
  MessageCircle,
  Lightbulb,
  ShieldUser,
  PlusCircle,
  Plus,
  Bot,
  Map as MapIcon,
  UserCircle,
  Clock,
  Network,
  Target,
  Sunrise,
  Sunset,
  UserPlus,
  MapPin,
  Compass,
  Swords,
  Shield,
  Heart,
  Eye,
  AlertTriangle,
  Home,
  Building,
  Skull,
  Gift,
  Lock,
  Unlock,
  Flag,
  Crown,
  Flame,
  Footprints,
  Handshake,
  Hammer,
  Key,
  Mountain,
  Ship,
  Tent,
  TreePine,
  Wind,
  Workflow,
  Megaphone,
  ScrollText,
  Feather,
  Scale,
  Bomb,
  Ghost,
  Wand2,
  Anchor,
  BellRing,
  Bird,
  Briefcase,
  Car,
  Coffee,
  Drama,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import arrowAnimation from '@/public/arrow_anim.json';
import lightbulbAnimation from '@/public/lightbulb_anim.json';
import spinnerAnimation from '@/public/spinner.json';
import heartAnimation from '@/public/heart_anim.json';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { BookLoading } from '@/components/BookLoading';
import { CachedImage } from '@/components/CachedImage';
import { supabase } from '@/lib/supabase';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { triggerLightHaptic, triggerMediumHaptic, triggerHeavyHaptic, triggerSuccessHaptic, triggerErrorHaptic, openSystemBrowser, isNativePlatform, storageSet, storageGet, listenForAppStateChange } from '@/lib/capacitor';
import { featureFlags } from '@/lib/feature-flags';

// Helper function to get the correct path for static assets (handles basePath)
function getAssetPath(path: string): string {
  if (typeof window === 'undefined') return path;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  if (isLocalhost || isCapacitor) return path;
  // Check if pathname starts with /book_review (GitHub Pages basePath)
  const pathname = window.location.pathname;
  if (pathname.startsWith('/book_review')) {
    return `/book_review${path}`;
  }
  return path;
}

// Helper function for relative time display
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Helper function to decode HTML entities (e.g., &#39; -> ')
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
  if (textarea) {
    textarea.innerHTML = text;
    return textarea.value;
  }
  // Fallback for SSR - decode common entities manually
  return text
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// Feed card glassmorphism style
const feedCardStyle = {
  background: 'rgba(255, 255, 255, 0.45)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
};

// --- Types & Constants ---
const RATING_DIMENSIONS = ['writing'] as const;
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

interface ResearchContentItem {
  source_url: string;
  trivia_fact: string;
  deep_insight: string;
}

interface ResearchPillar {
  pillar_name: string;
  content_items: ResearchContentItem[];
}

interface BookResearch {
  book_title: string;
  author: string;
  pillars: ResearchPillar[];
}

interface DomainInsights {
  label: string;
  facts: string[];
}

// Did You Know insight item (3 notes that tell a mini-story)
interface DidYouKnowItem {
  rank: number;
  notes: [string, string, string]; // Note 1 = fact, Note 2 = background, Note 3 = why it matters
}

// Did You Know response from Grok
interface DidYouKnowResponse {
  book: string;
  author: string;
  did_you_know_top10: DidYouKnowItem[];
}

// Book Infographic types (orientation guide)
interface InfographicCharacter {
  name: string;
  role: string;
  short_identity: string;
  personality: string;
  main_goal: string;
  key_connections: string[];
  why_reader_should_track: string;
}

interface InfographicCharacterBrief {
  name: string;
  short_identity: string;
  group_or_side: string;
  importance: 'major' | 'supporting' | 'minor';
}

interface InfographicPlotEvent {
  order: number;
  phase: 'opening' | 'early_setup' | 'early_story' | 'mid_story';
  event_label: string;
  what_happens: string;
  characters_involved: string[];
  why_it_helps_orientation: string;
  icon?: string; // Lucide icon name
}

interface BookInfographic {
  book: string;
  author: string;
  core_cast: InfographicCharacter[];
  full_character_list: InfographicCharacterBrief[];
  plot_timeline: InfographicPlotEvent[];
}

// Feed item interface for community/following feed
interface FeedItem {
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
interface PersonalizedFeedItem {
  id: string;
  user_id: string;
  source_book_id: string;
  source_book_title: string;
  source_book_author: string;
  source_book_cover_url: string | null;
  type: 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know';
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
type ReadingStatus = 'read_it' | 'reading' | 'want_to_read' | null;

interface Book {
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

// Grok API usage logging
interface GrokUsageLog {
  timestamp: string;
  function: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Grok pricing (per million tokens) - update these based on current xAI pricing
// Using approximate rates for grok-4-1-fast-non-reasoning
const GROK_INPUT_PRICE_PER_M = 0.20;  // $0.20 per million input tokens
const GROK_OUTPUT_PRICE_PER_M = 0.50;  // $0.50 per million output tokens
const GROK_WEB_SEARCH_PRICE_PER_CALL = 0.005;  // $0.005 per web search call (estimate)

interface GrokUsageInput {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  web_search_calls?: number;  // Number of web search calls made
}

async function logGrokUsage(functionName: string, usage: GrokUsageInput | undefined, webSearchCalls?: number): Promise<void> {
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    return;
  }

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
  const searchCalls = webSearchCalls || usage.web_search_calls || 0;

  // Calculate cost
  const inputCost = (promptTokens / 1_000_000) * GROK_INPUT_PRICE_PER_M;
  const outputCost = (completionTokens / 1_000_000) * GROK_OUTPUT_PRICE_PER_M;
  const webSearchCost = searchCalls * GROK_WEB_SEARCH_PRICE_PER_CALL;
  const estimatedCost = inputCost + outputCost + webSearchCost;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[logGrokUsage] No user logged in, skipping log');
    return;
  }

  // Save to Supabase
  try {
    const { error } = await supabase
      .from('grok_usage_logs')
      .insert({
        user_id: user.id,
        function_name: functionName,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        ...(searchCalls > 0 ? { web_search_calls: searchCalls } : {}),
      });

    if (error) {
      console.error('[logGrokUsage] Error saving to Supabase:', error);
    }
  } catch (err) {
    console.error('[logGrokUsage] Error saving to Supabase:', err);
  }
}

async function getGrokUsageLogs(userId: string): Promise<GrokUsageLog[]> {
  try {
    const { data, error } = await supabase
      .from('grok_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[getGrokUsageLogs] Error fetching from Supabase:', error);
      return [];
    }

    return (data || []).map(row => ({
      timestamp: row.created_at,
      function: row.function_name,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
      estimatedCost: parseFloat(row.estimated_cost),
    }));
  } catch (err) {
    console.error('[getGrokUsageLogs] Error fetching from Supabase:', err);
    return [];
  }
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
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokSuggestions', data.usage);
    }
    
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

interface AuthorFactsResult {
  facts: string[];
  first_issue_year?: number | null;
}

async function getGrokAuthorFacts(bookTitle: string, author: string): Promise<AuthorFactsResult> {
  console.log('[getGrokAuthorFacts] Called for:', bookTitle, 'by', author);
  
  if (!grokApiKey) {
    console.warn('[getGrokAuthorFacts] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return { facts: [] };
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
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokAuthorFacts', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    console.log('[getGrokAuthorFacts] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokAuthorFacts] 🔵 PARSED JSON:', result);
    console.log('[getGrokAuthorFacts] Parsed facts:', result.facts?.length || 0, 'facts');
    console.log('[getGrokAuthorFacts] Parsed first_issue_year:', result.first_issue_year);
    return {
      facts: result.facts || [],
      first_issue_year: result.first_issue_year || null
    };
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
    
    return { facts: [] };
  }
}

// AI functions (using Grok)
async function getAISuggestions(query: string): Promise<string[]> {
  return getGrokSuggestions(query);
}

async function getAuthorFacts(bookTitle: string, author: string): Promise<AuthorFactsResult> {
  console.log(`[getAuthorFacts] 🔄 Fetching author facts for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('author_facts_cache')
      .select('author_facts')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.author_facts && Array.isArray(cachedData.author_facts)) {
      if (cachedData.author_facts.length > 0) {
        console.log(`[getAuthorFacts] ✅ Found ${cachedData.author_facts.length} cached facts in database`);
        return { facts: cachedData.author_facts as string[] };
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getAuthorFacts] ✅ Found cached "no results" - skipping Grok API call`);
        return { facts: [] };
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getAuthorFacts] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getAuthorFacts] ⚠️ Error checking cache:', err);
    // Continue to fetch from Grok
  }
  
  // Fetch from Grok API
  const result = await getGrokAuthorFacts(bookTitle, author);
  
  // Save to cache if we got facts
  if (result.facts.length > 0) {
    await saveAuthorFactsToCache(bookTitle, author, result.facts);
  }
  
  return result;
}

// Get book influences from Grok (literary archaeology)
async function getGrokBookInfluences(bookTitle: string, author: string): Promise<string[]> {
  console.log('[getGrokBookInfluences] Called for:', bookTitle, 'by', author);
  
  if (!grokApiKey) {
    console.warn('[getGrokBookInfluences] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return [];
  }
  
  console.log('[getGrokBookInfluences] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  if (!prompts.book_influences || !prompts.book_influences.prompt) {
    console.error('[getGrokBookInfluences] ❌ book_influences prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.book_influences.prompt, { bookTitle, author });

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

  console.log('[getGrokBookInfluences] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokBookInfluences', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokBookInfluences] ✅ Parsed', result.facts?.length || 0, 'influences');
    return result.facts || [];
  } catch (err: any) {
    console.error('[getGrokBookInfluences] Error:', err);
    return [];
  }
}

async function getBookInfluences(bookTitle: string, author: string): Promise<string[]> {
  console.log(`[getBookInfluences] 🔄 Fetching book influences for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('book_influences_cache')
      .select('influences')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.influences && Array.isArray(cachedData.influences)) {
      if (cachedData.influences.length > 0) {
        console.log(`[getBookInfluences] ✅ Found ${cachedData.influences.length} cached influences in database`);
        return cachedData.influences as string[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookInfluences] ✅ Found cached "no results" - skipping Grok API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookInfluences] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookInfluences] ⚠️ Error checking cache:', err);
  }
  
  // Fetch from Grok API
  const influences = await getGrokBookInfluences(bookTitle, author);
  
  // Save to cache if we got influences
  if (influences.length > 0) {
    await saveBookInfluencesToCache(bookTitle, author, influences);
  }
  
  return influences;
}

// Get book domain insights from Grok (hidden domain analysis)
async function getGrokBookDomain(bookTitle: string, author: string): Promise<DomainInsights | null> {
  console.log('[getGrokBookDomain] Called for:', bookTitle, 'by', author);
  
  if (!grokApiKey) {
    console.warn('[getGrokBookDomain] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return null;
  }
  
  console.log('[getGrokBookDomain] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  if (!prompts.book_domain || !prompts.book_domain.prompt) {
    console.error('[getGrokBookDomain] ❌ book_domain prompt not found in prompts config');
    return null;
  }
  const prompt = formatPrompt(prompts.book_domain.prompt, { bookTitle, author });

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

  console.log('[getGrokBookDomain] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokBookDomain', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{"label":"Domain","facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    const label = result.label || 'Domain';
    const facts = result.facts || [];
    console.log('[getGrokBookDomain] ✅ Parsed', facts.length, 'domain insights with label:', label);
    return { label, facts };
  } catch (err: any) {
    console.error('[getGrokBookDomain] Error:', err);
    return null;
  }
}

async function getBookDomain(bookTitle: string, author: string): Promise<DomainInsights | null> {
  console.log(`[getBookDomain] 🔄 Fetching book domain insights for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('book_domain_cache')
      .select('domain_label, domain_insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.domain_insights && Array.isArray(cachedData.domain_insights)) {
      if (cachedData.domain_insights.length > 0) {
        const label = cachedData.domain_label || 'Domain';
        console.log(`[getBookDomain] ✅ Found ${cachedData.domain_insights.length} cached domain insights in database with label: ${label}`);
        return {
          label,
          facts: cachedData.domain_insights as string[]
        };
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookDomain] ✅ Found cached "no results" - skipping Grok API call`);
        return { label: 'Domain', facts: [] };
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookDomain] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookDomain] ⚠️ Error checking cache:', err);
  }
  
  // Fetch from Grok API
  const domainData = await getGrokBookDomain(bookTitle, author);
  
  // Save to cache if we got insights
  if (domainData && domainData.facts.length > 0) {
    await saveBookDomainToCache(bookTitle, author, domainData);
  }
  
  return domainData;
}

// Helper function to save book domain insights to cache table
async function saveBookDomainToCache(bookTitle: string, bookAuthor: string, domainData: DomainInsights): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_domain_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookDomainToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      domain_label: domainData.label,
      domain_insights: domainData.facts,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      result = await supabase
        .from('book_domain_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_domain_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveBookDomainToCache] ❌ Error saving domain insights:', result.error);
    } else {
      console.log(`[saveBookDomainToCache] ✅ Saved ${domainData.facts.length} domain insights to cache with label: ${domainData.label}`);
    }
  } catch (err: any) {
    console.error('[saveBookDomainToCache] ❌ Error:', err);
  }
}

// Get book context insights from Grok (external context analysis)
async function getGrokBookContext(bookTitle: string, author: string): Promise<string[]> {
  console.log('[getGrokBookContext] Called for:', bookTitle, 'by', author);
  
  if (!grokApiKey) {
    console.warn('[getGrokBookContext] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return [];
  }
  
  console.log('[getGrokBookContext] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  
  const prompts = await loadPrompts();
  if (!prompts.book_context || !prompts.book_context.prompt) {
    console.error('[getGrokBookContext] ❌ book_context prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.book_context.prompt, { bookTitle, author });

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

  console.log('[getGrokBookContext] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokBookContext', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokBookContext] ✅ Parsed', result.facts?.length || 0, 'context insights');
    return result.facts || [];
  } catch (err: any) {
    console.error('[getGrokBookContext] Error:', err);
    return [];
  }
}

async function getBookContext(bookTitle: string, author: string): Promise<string[]> {
  console.log(`[getBookContext] 🔄 Fetching book context insights for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('book_context_cache')
      .select('context_insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.context_insights && Array.isArray(cachedData.context_insights)) {
      if (cachedData.context_insights.length > 0) {
        console.log(`[getBookContext] ✅ Found ${cachedData.context_insights.length} cached context insights in database`);
        return cachedData.context_insights as string[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookContext] ✅ Found cached "no results" - skipping Grok API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookContext] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookContext] ⚠️ Error checking cache:', err);
  }
  
  // Fetch from Grok API
  const contextInsights = await getGrokBookContext(bookTitle, author);
  
  // Save to cache if we got insights
  if (contextInsights.length > 0) {
    await saveBookContextToCache(bookTitle, author, contextInsights);
  }
  
  return contextInsights;
}

// Helper function to save book context insights to cache table
async function saveBookContextToCache(bookTitle: string, bookAuthor: string, contextInsights: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_context_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookContextToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      context_insights: contextInsights,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      result = await supabase
        .from('book_context_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_context_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveBookContextToCache] ❌ Error saving context insights:', result.error);
    } else {
      console.log(`[saveBookContextToCache] ✅ Saved ${contextInsights.length} context insights to cache`);
    }
  } catch (err: any) {
    console.error('[saveBookContextToCache] ❌ Error:', err);
  }
}

// "Did You Know?" insights from Grok
async function getGrokDidYouKnow(bookTitle: string, author: string): Promise<DidYouKnowItem[]> {
  console.log('[getGrokDidYouKnow] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokDidYouKnow] API key is missing!');
    return [];
  }

  console.log('[getGrokDidYouKnow] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  if (!prompts.did_you_know || !prompts.did_you_know.prompt) {
    console.error('[getGrokDidYouKnow] ❌ did_you_know prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.did_you_know.prompt, { bookTitle, author });

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

  console.log('[getGrokDidYouKnow] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokDidYouKnow', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"did_you_know_top10":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result: DidYouKnowResponse = JSON.parse(jsonStr);
    console.log('[getGrokDidYouKnow] ✅ Parsed', result.did_you_know_top10?.length || 0, '"Did You Know?" insights');
    return result.did_you_know_top10 || [];
  } catch (err: any) {
    console.error('[getGrokDidYouKnow] Error:', err);
    return [];
  }
}

// Get "Did You Know?" insights with caching
async function getDidYouKnow(bookTitle: string, author: string): Promise<DidYouKnowItem[]> {
  console.log(`[getDidYouKnow] 🔄 Fetching "Did You Know?" insights for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('did_you_know_cache')
      .select('insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.insights && Array.isArray(cachedData.insights) && cachedData.insights.length > 0) {
      console.log(`[getDidYouKnow] ✅ Found ${cachedData.insights.length} cached insights in database`);
      return cachedData.insights as DidYouKnowItem[];
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getDidYouKnow] ⚠️ Error checking cache:', cacheError);
    }
    // If cache is empty or has no results, proceed to fetch from Grok
  } catch (err) {
    console.warn('[getDidYouKnow] ⚠️ Error checking cache:', err);
    // Continue to fetch from Grok
  }

  // Fetch from Grok API
  const insights = await getGrokDidYouKnow(bookTitle, author);

  // Save to cache
  await saveDidYouKnowToCache(bookTitle, author, insights);

  return insights;
}

// Helper function to save "Did You Know?" insights to cache table
async function saveDidYouKnowToCache(bookTitle: string, bookAuthor: string, insights: DidYouKnowItem[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // Check if record exists
    const { data: existingData, error: checkError } = await supabase
      .from('did_you_know_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveDidYouKnowToCache] ❌ Error checking existing record:', checkError);
      return;
    }

    let result;
    if (existingData) {
      // Update existing record
      result = await supabase
        .from('did_you_know_cache')
        .update({
          insights,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
    } else {
      // Insert new record
      result = await supabase
        .from('did_you_know_cache')
        .insert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          insights
        });
    }

    if (result.error) {
      console.error('[saveDidYouKnowToCache] ❌ Error saving insights:', result.error);
    } else {
      console.log(`[saveDidYouKnowToCache] ✅ Saved ${insights.length} "Did You Know?" insights to cache`);
    }
  } catch (err: any) {
    console.error('[saveDidYouKnowToCache] ❌ Error:', err);
  }
}

// Get book infographic (orientation guide) from Grok
async function getGrokBookInfographic(bookTitle: string, author: string): Promise<BookInfographic | null> {
  console.log('[getGrokBookInfographic] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookInfographic] API key is missing!');
    return null;
  }

  console.log('[getGrokBookInfographic] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  // Load prompt from yaml
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.book_infographic.prompt, {
    book_title: bookTitle,
    author_name: author
  });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.5
  };

  console.log('[getGrokBookInfographic] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 5000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokBookInfographic', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';

    // Log raw Grok response
    console.log('[getGrokBookInfographic] 📦 RAW GROK RESPONSE:', content);

    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[0] : content;

    // Sanitize common JSON issues from LLM responses
    // Remove trailing commas before ] or }
    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');

    try {
      const result: BookInfographic = JSON.parse(jsonStr);
      console.log('[getGrokBookInfographic] ✅ Parsed infographic with', result.core_cast?.length || 0, 'core characters,', result.full_character_list?.length || 0, 'total characters,', result.plot_timeline?.length || 0, 'plot events');
      return result;
    } catch (parseErr: any) {
      console.error('[getGrokBookInfographic] ❌ JSON Parse Error:', parseErr.message);
      console.error('[getGrokBookInfographic] 📄 Attempted to parse:', jsonStr.substring(0, 500) + '...');
      // Try to find the error location
      const errorMatch = parseErr.message.match(/position (\d+)/);
      if (errorMatch) {
        const pos = parseInt(errorMatch[1]);
        console.error('[getGrokBookInfographic] 🔍 Error context:', jsonStr.substring(Math.max(0, pos - 50), pos + 50));
      }
      return null;
    }
  } catch (err: any) {
    console.error('[getGrokBookInfographic] Error:', err);
    return null;
  }
}

// Discussion questions interface and functions
interface DiscussionQuestion {
  id: number;
  question: string;
  category: 'themes' | 'characters' | 'writing style' | 'ethics' | 'personal reflection' | 'real world';
}

async function getGrokDiscussionQuestions(bookTitle: string, author: string): Promise<DiscussionQuestion[]> {
  console.log('[getGrokDiscussionQuestions] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokDiscussionQuestions] API key is missing!');
    return [];
  }

  console.log('[getGrokDiscussionQuestions] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  // Load prompt from yaml
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.discussion_questions.prompt, {
    book_title: bookTitle,
    author_name: author
  });

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

  console.log('[getGrokDiscussionQuestions] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokDiscussionQuestions', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '[]';
    // Try to extract JSON array from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log('[getGrokDiscussionQuestions] ✅ Parsed', result.length, 'discussion questions');
    return result || [];
  } catch (err: any) {
    console.error('[getGrokDiscussionQuestions] Error:', err);
    return [];
  }
}

async function getDiscussionQuestions(bookTitle: string, author: string, canonicalBookId: string): Promise<DiscussionQuestion[]> {
  console.log(`[getDiscussionQuestions] 🔄 Fetching discussion questions for "${bookTitle}" by ${author}`);

  // Check database cache first using canonical_book_id
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('discussion_questions_cache')
      .select('questions')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.questions && Array.isArray(cachedData.questions)) {
      if (cachedData.questions.length > 0) {
        console.log(`[getDiscussionQuestions] ✅ Found ${cachedData.questions.length} cached questions in database`);
        return cachedData.questions as DiscussionQuestion[];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getDiscussionQuestions] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getDiscussionQuestions] ⚠️ Error checking cache:', err);
  }

  // Fetch from Grok API
  const questions = await getGrokDiscussionQuestions(bookTitle, author);

  // Save to cache if we got questions
  if (questions.length > 0) {
    await saveDiscussionQuestionsToCache(bookTitle, author, canonicalBookId, questions);
  }

  return questions;
}

async function saveDiscussionQuestionsToCache(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  questions: DiscussionQuestion[]
): Promise<void> {
  try {
    const recordData = {
      canonical_book_id: canonicalBookId,
      book_title: bookTitle,
      book_author: bookAuthor,
      questions: questions,
      updated_at: new Date().toISOString(),
    };

    // Upsert based on canonical_book_id
    const { error } = await supabase
      .from('discussion_questions_cache')
      .upsert(recordData, { onConflict: 'canonical_book_id' });

    if (error) {
      console.error('[saveDiscussionQuestionsToCache] ❌ Error saving questions:', error);
    } else {
      console.log(`[saveDiscussionQuestionsToCache] ✅ Saved ${questions.length} questions to cache`);
    }
  } catch (err: any) {
    console.error('[saveDiscussionQuestionsToCache] ❌ Error:', err);
  }
}

// Check if a Telegram topic exists for this book
async function getTelegramTopic(canonicalBookId: string): Promise<{ topicId: number; inviteLink: string } | null> {
  try {
    const { data, error } = await supabase
      .from('telegram_topics')
      .select('telegram_topic_id, invite_link')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (error) {
      console.error('[getTelegramTopic] Error:', error);
      return null;
    }

    if (data) {
      return {
        topicId: data.telegram_topic_id,
        inviteLink: data.invite_link,
      };
    }

    return null;
  } catch (err) {
    console.error('[getTelegramTopic] Error:', err);
    return null;
  }
}

// Create a new Telegram topic for a book
async function createTelegramTopic(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  discussionQuestions?: DiscussionQuestion[],
  coverUrl?: string,
  genre?: string
): Promise<{ topicId: number; inviteLink: string } | null> {
  try {
    // Call the Supabase edge function to create the topic
    const { data, error } = await supabase.functions.invoke('create-telegram-topic', {
      body: { bookTitle, bookAuthor, canonicalBookId, discussionQuestions, coverUrl, genre },
    });

    if (error) {
      console.error('[createTelegramTopic] Edge Function Error:', error);
      return null;
    }

    if (!data?.success) {
      console.error('[createTelegramTopic] API Error:', data?.error);
      return null;
    }

    // Save to Supabase
    const { error: insertError } = await supabase
      .from('telegram_topics')
      .insert({
        canonical_book_id: canonicalBookId,
        book_title: bookTitle,
        book_author: bookAuthor,
        telegram_topic_id: data.topicId,
        invite_link: data.inviteLink,
      });

    if (insertError) {
      console.error('[createTelegramTopic] DB Insert Error:', insertError);
      // Still return the data even if DB save fails
    }

    return {
      topicId: data.topicId,
      inviteLink: data.inviteLink,
    };
  } catch (err) {
    console.error('[createTelegramTopic] Error:', err);
    return null;
  }
}

// Get or create Telegram topic for a book
async function getOrCreateTelegramTopic(
  bookTitle: string,
  bookAuthor: string,
  canonicalBookId: string,
  coverUrl?: string,
  genre?: string
): Promise<{ topicId: number; inviteLink: string } | null> {
  // First check if topic already exists
  const existing = await getTelegramTopic(canonicalBookId);
  if (existing) {
    return existing;
  }

  // Fetch discussion questions from cache to include in the topic
  let discussionQuestions: DiscussionQuestion[] = [];
  try {
    const { data } = await supabase
      .from('discussion_questions_cache')
      .select('questions')
      .eq('canonical_book_id', canonicalBookId)
      .maybeSingle();

    if (data?.questions) {
      discussionQuestions = data.questions as DiscussionQuestion[];
    }
  } catch (err) {
    console.error('[getOrCreateTelegramTopic] Error fetching questions:', err);
  }

  // Create new topic with discussion questions, cover, and genre
  return await createTelegramTopic(bookTitle, bookAuthor, canonicalBookId, discussionQuestions, coverUrl, genre);
}

// Helper function to save book influences to cache table
async function saveBookInfluencesToCache(bookTitle: string, bookAuthor: string, influences: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_influences_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookInfluencesToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      influences: influences,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      result = await supabase
        .from('book_influences_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_influences_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveBookInfluencesToCache] ❌ Error saving influences:', result.error);
    } else {
      console.log(`[saveBookInfluencesToCache] ✅ Saved ${influences.length} influences to cache`);
    }
  } catch (err: any) {
    console.error('[saveBookInfluencesToCache] ❌ Error:', err);
  }
}

// Helper function to save author facts to cache table
async function saveAuthorFactsToCache(bookTitle: string, bookAuthor: string, facts: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('author_facts_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveAuthorFactsToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      author_facts: facts,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('author_facts_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('author_facts_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveAuthorFactsToCache] ❌ Error saving author facts:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveAuthorFactsToCache] ⚠️ Table "author_facts_cache" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveAuthorFactsToCache] ✅ Saved ${facts.length} author facts to cache`);
      
      // Generate trivia questions for this book (fire and forget - don't wait)
      // Note: We can't pass a callback here since this is a global function
      // The useEffect will pick up changes when books.length changes
      if (facts.length > 0) {
        generateTriviaQuestionsForBook(bookTitle, bookAuthor, facts)
          .then(questions => {
            if (questions.length > 0) {
              return saveTriviaQuestionsToCache(bookTitle, bookAuthor, questions);
            }
          })
          .catch(err => {
            console.error('[saveAuthorFactsToCache] ⚠️ Error generating trivia questions:', err);
          });
      }
    }
  } catch (err: any) {
    console.error('[saveAuthorFactsToCache] ❌ Error:', err);
  }
}

// ============================================
// FEED ITEM GENERATION
// ============================================

type FeedItemType = 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know';

interface FeedItemContent {
  [key: string]: any;
}

// Generate a hash for content deduplication (browser-compatible djb2)
function generateFeedContentHash(type: string, content: any): string {
  const str = JSON.stringify({ type, content });
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// Create a friend_book feed item when user adds a book
async function createFriendBookFeedItem(
  userId: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  bookCoverUrl: string | null,
  readingStatus: string | null,
  description?: string | null
): Promise<void> {
  const content: Record<string, any> = {
    action: 'added',
    book_title: bookTitle,
    book_author: bookAuthor,
    book_cover_url: bookCoverUrl,
  };
  if (description) {
    content.description = description;
  }

  const feedItem = {
    user_id: userId,
    source_book_id: bookId,
    source_book_title: bookTitle,
    source_book_author: bookAuthor || '',
    source_book_cover_url: bookCoverUrl,
    type: 'friend_book' as FeedItemType,
    content,
    content_hash: generateFeedContentHash('friend_book', content),
    reading_status: readingStatus,
    base_score: 1.0,
    times_shown: 0,
    last_shown_at: null,
  };

  const { error } = await supabase.from('feed_items').upsert(feedItem, {
    onConflict: 'user_id,type,content_hash',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[createFriendBookFeedItem] ❌ Error:', error.message);
  } else {
    console.log('[createFriendBookFeedItem] ✅ Created friend_book feed item');
  }
}

// Generate feed items from cached content for a book
async function generateFeedItemsForBook(
  userId: string,
  bookId: string,
  bookTitle: string,
  bookAuthor: string,
  bookCoverUrl: string | null,
  readingStatus: string | null,
  bookCreatedAt: string
): Promise<{ created: number; errors: string[]; skipped?: boolean }> {
  const generatedTypes: FeedItemType[] = ['fact', 'context', 'drilldown', 'influence', 'podcast', 'article', 'related_book', 'video', 'did_you_know'];

  // Note: We no longer skip based on existing items - the upsert with ignoreDuplicates handles deduplication.
  // This allows new content types to be added to books that already have some feed items.

  const errors: string[] = [];
  let created = 0;

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = (bookAuthor || '').toLowerCase().trim();

  // Helper to create and insert feed item
  async function insertFeedItem(type: FeedItemType, content: FeedItemContent): Promise<boolean> {
    const feedItem = {
      user_id: userId,
      source_book_id: bookId,
      source_book_title: bookTitle,
      source_book_author: bookAuthor || '',
      source_book_cover_url: bookCoverUrl,
      type,
      content,
      content_hash: generateFeedContentHash(type, content),
      reading_status: readingStatus,
      base_score: 1.0,
      times_shown: 0,
      last_shown_at: null,
      source_book_created_at: bookCreatedAt,
    };

    const { error } = await supabase.from('feed_items').upsert(feedItem, {
      onConflict: 'user_id,type,content_hash',
      ignoreDuplicates: true,
    });

    if (error) {
      console.error(`[insertFeedItem] ❌ Error inserting ${type}:`, error.message, error.code, error.details);
      errors.push(`${type}: ${error.message}`);
      return false;
    }
    return true;
  }

  // Fetch all cached content in parallel
  const [
    authorFactsData,
    bookContextData,
    bookDomainData,
    bookInfluencesData,
    podcastsData,
    articlesData,
    relatedBooksData,
    youtubeVideosData,
    didYouKnowData,
  ] = await Promise.all([
    supabase.from('author_facts_cache').select('author_facts').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_context_cache').select('context_insights').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_domain_cache').select('domain_insights, domain_label').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('book_influences_cache').select('influences').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('podcast_episodes_cache').select('podcast_episodes_curated, podcast_episodes_apple').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('google_scholar_articles').select('articles').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('related_books').select('related_books').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('youtube_videos').select('videos').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
    supabase.from('did_you_know_cache').select('insights').eq('book_title', normalizedTitle).eq('book_author', normalizedAuthor).maybeSingle(),
  ]);

  // Debug: Log what we found in cache tables
  console.log(`[generateFeedItemsForBook] 📊 Cache data for "${normalizedTitle}" by "${normalizedAuthor}":`);
  console.log(`  - author_facts: ${authorFactsData.data?.author_facts?.length || 0} items, error: ${authorFactsData.error?.message || 'none'}`);
  console.log(`  - context: ${bookContextData.data?.context_insights?.length || 0} items, error: ${bookContextData.error?.message || 'none'}`);
  console.log(`  - domain: ${bookDomainData.data?.domain_insights?.length || 0} items, error: ${bookDomainData.error?.message || 'none'}`);
  console.log(`  - influences: ${bookInfluencesData.data?.influences?.length || 0} items, error: ${bookInfluencesData.error?.message || 'none'}`);
  console.log(`  - did_you_know: ${didYouKnowData.data?.insights?.length || 0} items, error: ${didYouKnowData.error?.message || 'none'}`);

  // Process author facts (only if feature flag enabled)
  if (featureFlags.insights.author_facts) {
    const authorFacts = authorFactsData.data?.author_facts;
    if (authorFacts && Array.isArray(authorFacts)) {
      for (const fact of authorFacts) {
        if (await insertFeedItem('fact', { fact })) created++;
      }
    }
  }

  // Process context insights (only if feature flag enabled)
  if (featureFlags.insights.book_context) {
    const contextInsights = bookContextData.data?.context_insights;
    if (contextInsights && Array.isArray(contextInsights)) {
      for (const insight of contextInsights) {
        if (await insertFeedItem('context', { insight })) created++;
      }
    }
  }

  // Process domain/drilldown insights (only if feature flag enabled)
  if (featureFlags.insights.book_domain) {
    const domainInsights = bookDomainData.data?.domain_insights;
    const domainLabel = bookDomainData.data?.domain_label || 'Domain';
    if (domainInsights && Array.isArray(domainInsights)) {
      for (const insight of domainInsights) {
        if (await insertFeedItem('drilldown', { insight, domain_label: domainLabel })) created++;
      }
    }
  }

  // Process influences (only if feature flag enabled)
  if (featureFlags.insights.book_influences) {
    const influences = bookInfluencesData.data?.influences;
    if (influences && Array.isArray(influences)) {
      for (const influence of influences) {
        if (await insertFeedItem('influence', { influence })) created++;
      }
    }
  }

  // Process podcasts
  const curatedPodcasts = podcastsData.data?.podcast_episodes_curated || [];
  const applePodcasts = podcastsData.data?.podcast_episodes_apple || [];
  for (const episode of [...curatedPodcasts, ...applePodcasts]) {
    if (await insertFeedItem('podcast', { episode })) created++;
  }

  // Process articles
  const articles = articlesData.data?.articles;
  if (articles && Array.isArray(articles)) {
    for (const article of articles) {
      if (await insertFeedItem('article', { article })) created++;
    }
  }

  // Process related books
  const relatedBooks = relatedBooksData.data?.related_books;
  if (relatedBooks && Array.isArray(relatedBooks)) {
    for (const relatedBook of relatedBooks) {
      if (await insertFeedItem('related_book', { related_book: relatedBook })) created++;
    }
  }

  // Process YouTube videos
  const videos = youtubeVideosData.data?.videos;
  if (videos && Array.isArray(videos)) {
    for (const video of videos) {
      if (await insertFeedItem('video', { video })) created++;
    }
  }

  // Process "Did you know?" insights - each item has 3 notes shown together (only if feature flag enabled)
  if (featureFlags.insights.did_you_know) {
    const didYouKnowInsights = didYouKnowData.data?.insights;
    if (didYouKnowInsights && Array.isArray(didYouKnowInsights)) {
      for (const item of didYouKnowInsights) {
        // Each did_you_know item contains { rank, notes: [string, string, string] }
        if (item.notes && Array.isArray(item.notes) && item.notes.length === 3) {
          if (await insertFeedItem('did_you_know', {
            rank: item.rank,
            notes: item.notes
          })) created++;
        }
      }
    }
  }

  console.log(`[generateFeedItemsForBook] ✅ Created ${created} feed items for "${bookTitle}" (${errors.length} errors)`);
  return { created, errors };
}

// Get personalized feed with scoring and type diversity
async function getPersonalizedFeed(userId: string): Promise<any[]> {
  const POOL_SIZE = 60;

  // Fetch a large candidate pool from each type
  const typeQueries = [
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'fact').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'context').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'drilldown').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'influence').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'podcast').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'did_you_know').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'article').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'related_book').order('created_at', { ascending: false }).limit(POOL_SIZE),
    supabase.from('feed_items').select('*').eq('user_id', userId).eq('type', 'video').order('created_at', { ascending: false }).limit(POOL_SIZE),
  ];

  // Also fetch friend_book items from followed users
  const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  if (follows && follows.length > 0) {
    const followingIds = follows.map(f => f.following_id);
    let publicFollowingIds = followingIds;
    const { data: publicUsers, error: publicUsersError } = await supabase
      .from('users')
      .select('id')
      .in('id', followingIds)
      .eq('is_public', true);

    if (!publicUsersError && publicUsers && publicUsers.length > 0) {
      publicFollowingIds = publicUsers.map(user => user.id);
    }

    if (publicFollowingIds.length > 0) {
      typeQueries.push(
        supabase.from('feed_items').select('*').in('user_id', publicFollowingIds).eq('type', 'friend_book').order('created_at', { ascending: false }).limit(POOL_SIZE)
      );
    }
  }

  const results = await Promise.all(typeQueries);
  const allCandidates = results.flatMap(r => r.data || []);

  if (allCandidates.length === 0) {
    return [];
  }

  // Greedy selection with diversity scoring — process all candidates
  const feed: any[] = [];
  const recentTypes: string[] = [];
  const recentBooks: string[] = [];
  const remainingCandidates = [...allCandidates];

  while (remainingCandidates.length > 0) {
    for (const item of remainingCandidates) {
      item.computed_score = calculateFeedScore(item, recentTypes, recentBooks);
    }

    remainingCandidates.sort((a, b) => (b.computed_score || 0) - (a.computed_score || 0));

    const selected = remainingCandidates.shift()!;
    feed.push(selected);

    recentTypes.unshift(selected.type);
    recentBooks.unshift(selected.source_book_id);

    if (recentTypes.length > 5) recentTypes.pop();
    if (recentBooks.length > 5) recentBooks.pop();
  }

  return feed;
}

// Calculate feed score with freshness and diversity factors
function calculateFeedScore(item: any, recentTypes: string[], recentBooks: string[]): number {
  let score = item.base_score || 1.0;

  // 1. FRESHNESS - Decay over 14 days
  const createdAt = new Date(item.created_at).getTime();
  const daysSinceCreated = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const freshnessFactor = Math.max(0.2, 1 - daysSinceCreated / 14);
  score *= freshnessFactor;

  // 2. READING STATUS - Prioritize "reading" books, then recently added "read_it"
  if (item.reading_status === 'reading') {
    score *= 2.0;
  } else if (item.reading_status === 'read_it') {
    if (item.source_book_created_at) {
      const bookAddedAt = new Date(item.source_book_created_at).getTime();
      const daysSinceBookAdded = (Date.now() - bookAddedAt) / (1000 * 60 * 60 * 24);
      score *= Math.max(1.0, 1.8 - (daysSinceBookAdded / 60) * 0.8);
    } else {
      score *= 1.3;
    }
  } else if (item.reading_status === 'want_to_read') {
    score *= 0.7;
  } else {
    score *= 0.5;
  }

  // 3. STALENESS BOOST - Items not shown recently get priority
  if (item.last_shown_at) {
    const lastShown = new Date(item.last_shown_at).getTime();
    const daysSinceShown = (Date.now() - lastShown) / (1000 * 60 * 60 * 24);
    score += daysSinceShown * 0.5;
  } else {
    score += 5; // Never shown = big boost
  }

  // 4. DIMINISHING RETURNS - Penalize frequently shown items
  score *= 1 / (1 + (item.times_shown || 0) * 0.15);

  // 5. TYPE DIVERSITY - Penalize if same type was recent
  const typeRecency = recentTypes.indexOf(item.type);
  if (typeRecency !== -1) {
    score *= Math.max(0.3, 1 - 0.2 * (5 - typeRecency));
  }

  // 6. BOOK DIVERSITY - Penalize if same book was recent
  const bookRecency = recentBooks.indexOf(item.source_book_id);
  if (bookRecency !== -1) {
    score *= Math.max(0.4, 1 - 0.15 * (5 - bookRecency));
  }

  return score;
}

// Mark feed items as shown (for staleness tracking)
async function markFeedItemsAsShown(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  for (const id of itemIds) {
    const { data: item } = await supabase
      .from('feed_items')
      .select('times_shown')
      .eq('id', id)
      .single();

    const currentCount = item?.times_shown || 0;

    await supabase
      .from('feed_items')
      .update({
        times_shown: currentCount + 1,
        last_shown_at: new Date().toISOString(),
      })
      .eq('id', id);
  }
}

// Mark a feed item as read/unread
// Store read status in localStorage
const FEED_READ_STORAGE_KEY = 'feed_items_read';

function getReadFeedItems(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(FEED_READ_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function setFeedItemReadStatus(itemId: string, read: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const readItems = getReadFeedItems();
    if (read) {
      readItems.add(itemId);
    } else {
      readItems.delete(itemId);
    }
    localStorage.setItem(FEED_READ_STORAGE_KEY, JSON.stringify([...readItems]));
  } catch (e) {
    console.error('[setFeedItemReadStatus] Error saving to localStorage:', e);
  }
}

// Spoiler revealed status storage (per book) - cross-platform
const SPOILER_REVEALED_STORAGE_KEY = 'spoiler_revealed_status';

function getSpoilerRevealedFromStorage(): Map<string, Set<string>> {
  if (typeof window === 'undefined') return new Map();
  try {
    // Try localStorage first for initial sync load
    const stored = localStorage.getItem(SPOILER_REVEALED_STORAGE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const map = new Map<string, Set<string>>();
    for (const [bookId, sections] of Object.entries(parsed)) {
      map.set(bookId, new Set(sections));
    }
    return map;
  } catch {
    return new Map();
  }
}

// Async version for cross-platform storage (call on mount for native)
async function loadSpoilerRevealedFromStorage(): Promise<Map<string, Set<string>>> {
  try {
    const stored = await storageGet(SPOILER_REVEALED_STORAGE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const map = new Map<string, Set<string>>();
    for (const [bookId, sections] of Object.entries(parsed)) {
      map.set(bookId, new Set(sections));
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveSpoilerRevealedToStorage(revealed: Map<string, Set<string>>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string[]> = {};
    revealed.forEach((sections, bookId) => {
      obj[bookId] = [...sections];
    });
    const jsonStr = JSON.stringify(obj);
    // Save to both localStorage (sync) and cross-platform storage (async)
    localStorage.setItem(SPOILER_REVEALED_STORAGE_KEY, jsonStr);
    storageSet(SPOILER_REVEALED_STORAGE_KEY, jsonStr).catch(e => {
      console.error('[saveSpoilerRevealedToStorage] Error saving to Preferences:', e);
    });
  } catch (e) {
    console.error('[saveSpoilerRevealedToStorage] Error saving:', e);
  }
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
    
    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokPodcastEpisodes', data.usage);
    }
    
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
    
    if (!cacheError && cachedData && cachedData.articles && Array.isArray(cachedData.articles)) {
      // Check if it's a cached empty array (no results found)
      if (cachedData.articles.length === 0) {
        console.log(`[getGoogleScholarAnalysis] ✅ Found cached empty results (no articles available) in database`);
        return [] as AnalysisArticle[];
      }

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
  
  // Check if we successfully parsed pages but found no articles
  // This means Google Scholar has no results for this book, so save empty array to prevent future calls
  console.log(`[getGoogleScholarAnalysis] ⚠️ No articles found after trying all proxies. This book may have no scholarly analysis available.`);

  // Save empty array to database to prevent future unnecessary API calls
  await saveArticlesToDatabase(normalizedTitle, normalizedAuthor, []);

  // Return empty array for display (no analysis section will show)
  return [];

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
    
    if (!cacheError && cachedData && cachedData.related_books && Array.isArray(cachedData.related_books)) {
      if (cachedData.related_books.length > 0) {
        console.log(`[getRelatedBooks] ✅ Found ${cachedData.related_books.length} cached related books in database`);
        return cachedData.related_books as RelatedBook[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getRelatedBooks] ✅ Found cached "no results" - skipping Grok API call`);
        return [];
      }
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

    // Log usage
    if (data.usage) {
      logGrokUsage('getRelatedBooks', data.usage);
    }

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

// --- Book Research (Grok API) ---
async function getBookResearch(bookTitle: string, authorName: string): Promise<BookResearch | null> {
  console.log(`[getBookResearch] 🔄 Fetching research for "${bookTitle}" by ${authorName}`);
  
  if (!grokApiKey || grokApiKey.trim() === '') {
    console.warn('[getBookResearch] ⚠️ Grok API key not found or empty');
    return null;
  }
  
  // Validate API key format
  if (grokApiKey.length < 20) {
    console.warn('[getBookResearch] ⚠️ Grok API key appears to be invalid');
    return null;
  }

  try {
    const prompts = await loadPrompts();
    
    // Safety check: ensure book_research prompt exists
    if (!prompts.book_research || !prompts.book_research.prompt) {
      console.error('[getBookResearch] ❌ book_research prompt not found in prompts config');
      console.error('[getBookResearch] Available prompts:', Object.keys(prompts));
      return null;
    }
    
    const researchPrompt = formatPrompt(prompts.book_research.prompt, { bookTitle, authorName });

    const payload = {
      messages: [
        {
          role: "user",
          content: researchPrompt
        }
      ],
      model: "grok-4-1-fast-non-reasoning",
      stream: false,
      temperature: 0.7
    };

    console.log('[getBookResearch] 🔵 Making request to Grok API...');
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    const content = data.choices?.[0]?.message?.content || '{}';
    console.log('[getBookResearch] 🔵 RAW CONTENT:', content.substring(0, 500));
    
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    
    // Validate and structure the result
    if (!result.pillars || !Array.isArray(result.pillars)) {
      console.error('[getBookResearch] ❌ Invalid response format - missing pillars array');
      return null;
    }
    
    const research: BookResearch = {
      book_title: result.book_title || bookTitle,
      author: result.author || authorName,
      pillars: result.pillars.filter((p: any) => p.pillar_name && p.content_items && Array.isArray(p.content_items) && p.content_items.length > 0)
    };
    
    console.log(`[getBookResearch] ✅ Received research with ${research.pillars.length} pillars`);
    
    return research;
  } catch (err: any) {
    console.error('[getBookResearch] ❌ Error:', err);
    return null;
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
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('youtube_videos')
      .select('videos')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData && cachedData.videos && Array.isArray(cachedData.videos)) {
      if (cachedData.videos.length > 0) {
        console.log(`[getYouTubeVideos] ✅ Found ${cachedData.videos.length} cached videos in database`);
        return cachedData.videos as YouTubeVideo[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getYouTubeVideos] ✅ Found cached "no results" - skipping YouTube API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getYouTubeVideos] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getYouTubeVideos] ⚠️ Error checking cache:', err);
    // Continue to fetch
  }
  
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
      let errorData: any = {};
      try {
        const text = await response1.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // If JSON parsing fails, log the raw text
        console.error('[getYouTubeVideos] ❌ Query 1 error response (raw):', await response1.text().catch(() => 'Could not read response'));
      }
      
      console.error(`[getYouTubeVideos] ❌ Query 1 failed: ${response1.status} ${response1.statusText}`);
      console.error('[getYouTubeVideos] Error details:', {
        status: response1.status,
        statusText: response1.statusText,
        error: errorData.error || errorData,
        message: errorData.error?.message || errorData.message || 'No error message',
        reason: errorData.error?.errors?.[0]?.reason || errorData.reason || 'Unknown reason',
        domain: errorData.error?.errors?.[0]?.domain || errorData.domain,
        fullError: errorData
      });
      
      // Provide helpful guidance based on error
      if (response1.status === 403) {
        const reason = errorData.error?.errors?.[0]?.reason || errorData.reason || '';
        if (reason === 'quotaExceeded') {
          console.error('[getYouTubeVideos] ⚠️ YouTube API quota exceeded. Please check your quota in Google Cloud Console.');
        } else if (reason === 'accessNotConfigured') {
          console.error('[getYouTubeVideos] ⚠️ YouTube Data API v3 is not enabled. Enable it in Google Cloud Console.');
        } else if (reason === 'ipRefererBlocked') {
          console.error('[getYouTubeVideos] ⚠️ API key restrictions are blocking this request. Check IP/referrer restrictions in Google Cloud Console.');
        } else {
          console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 Forbidden. Possible causes:');
          console.error('[getYouTubeVideos]   1. Invalid API key');
          console.error('[getYouTubeVideos]   2. API key restrictions (IP/referrer)');
          console.error('[getYouTubeVideos]   3. YouTube Data API v3 not enabled');
          console.error('[getYouTubeVideos]   4. Quota exceeded');
          console.error('[getYouTubeVideos]   Check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets and Google Cloud Console settings.');
        }
      }
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
      let errorData: any = {};
      try {
        const text = await response2.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // If JSON parsing fails, log the raw text
        console.error('[getYouTubeVideos] ❌ Query 2 error response (raw):', await response2.text().catch(() => 'Could not read response'));
      }
      
      console.error(`[getYouTubeVideos] ❌ Query 2 failed: ${response2.status} ${response2.statusText}`);
      console.error('[getYouTubeVideos] Error details:', {
        status: response2.status,
        statusText: response2.statusText,
        error: errorData.error || errorData,
        message: errorData.error?.message || errorData.message || 'No error message',
        reason: errorData.error?.errors?.[0]?.reason || errorData.reason || 'Unknown reason',
        domain: errorData.error?.errors?.[0]?.domain || errorData.domain,
        fullError: errorData
      });
      
      // Provide helpful guidance based on error
      if (response2.status === 403) {
        const reason = errorData.error?.errors?.[0]?.reason || errorData.reason || '';
        if (reason === 'quotaExceeded') {
          console.error('[getYouTubeVideos] ⚠️ YouTube API quota exceeded. Please check your quota in Google Cloud Console.');
        } else if (reason === 'accessNotConfigured') {
          console.error('[getYouTubeVideos] ⚠️ YouTube Data API v3 is not enabled. Enable it in Google Cloud Console.');
        } else if (reason === 'ipRefererBlocked') {
          console.error('[getYouTubeVideos] ⚠️ API key restrictions are blocking this request. Check IP/referrer restrictions in Google Cloud Console.');
        } else {
          console.error('[getYouTubeVideos] ⚠️ YouTube API returned 403 Forbidden. Possible causes:');
          console.error('[getYouTubeVideos]   1. Invalid API key');
          console.error('[getYouTubeVideos]   2. API key restrictions (IP/referrer)');
          console.error('[getYouTubeVideos]   3. YouTube Data API v3 not enabled');
          console.error('[getYouTubeVideos]   4. Quota exceeded');
          console.error('[getYouTubeVideos]   Check NEXT_PUBLIC_YOUTUBE_API_KEY in GitHub secrets and Google Cloud Console settings.');
        }
      }
    }
    
    // Limit to top 10 videos
    const limitedVideos = videos.slice(0, 10);
    console.log(`[getYouTubeVideos] ✅ Found ${limitedVideos.length} videos`);
    
    // Save to database
    if (limitedVideos.length > 0) {
      await saveYouTubeVideosToDatabase(bookTitle, author, limitedVideos);
    }
    
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

// --- Save YouTube Videos to Database ---
async function saveYouTubeVideosToDatabase(bookTitle: string, bookAuthor: string, videos: YouTubeVideo[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveYouTubeVideosToDatabase] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      videos: videos,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('youtube_videos')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('youtube_videos')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveYouTubeVideosToDatabase] ❌ Error saving videos:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        fullError: result.error
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveYouTubeVideosToDatabase] ⚠️ Table "youtube_videos" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveYouTubeVideosToDatabase] ✅ Saved ${videos.length} videos to database`);
    }
  } catch (err: any) {
    console.error('[saveYouTubeVideosToDatabase] ❌ Unexpected error:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
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
  console.log(`[getPodcastEpisodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${author}`);
  
  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();
    
    const { data: cachedData, error: cacheError } = await supabase
      .from('podcast_episodes_cache')
      .select('podcast_episodes_curated, podcast_episodes_apple')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (!cacheError && cachedData) {
      const curatedEpisodes = (cachedData.podcast_episodes_curated || []) as PodcastEpisode[];
      const appleEpisodes = (cachedData.podcast_episodes_apple || []) as PodcastEpisode[];
      
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
      
      if (combined.length > 0 || (curatedEpisodes.length === 0 && appleEpisodes.length === 0)) {
        console.log(`[getPodcastEpisodes] ✅ Found cached episodes: ${combined.length} combined (${curatedEpisodes.length} curated + ${appleEpisodes.length} Apple)`);
        return combined;
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getPodcastEpisodes] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getPodcastEpisodes] ⚠️ Error checking cache:', err);
    // Continue to fetch
  }
  
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
  
  // Save to cache (including empty arrays to prevent future fetches)
  await savePodcastEpisodesToCache(bookTitle, author, curatedEpisodes, appleEpisodes);
  
  return combined;
}

// Helper function to save podcast episodes to cache table
async function savePodcastEpisodesToCache(bookTitle: string, bookAuthor: string, curatedEpisodes: PodcastEpisode[], appleEpisodes: PodcastEpisode[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('podcast_episodes_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[savePodcastEpisodesToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      podcast_episodes_curated: curatedEpisodes,
      podcast_episodes_apple: appleEpisodes,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('podcast_episodes_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('podcast_episodes_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[savePodcastEpisodesToCache] ❌ Error saving podcast episodes:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[savePodcastEpisodesToCache] ⚠️ Table "podcast_episodes_cache" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[savePodcastEpisodesToCache] ✅ Saved ${curatedEpisodes.length} curated + ${appleEpisodes.length} Apple episodes to cache`);
    }
  } catch (err: any) {
    console.error('[savePodcastEpisodesToCache] ❌ Error:', err);
  }
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
    
    // Take top 7 results
    const topResults = sortedResults.slice(0, 7);
    
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
      
      // Extract summary/description from Apple Books
      // iTunes API provides description which is typically a synopsis
      let summary: string | undefined = undefined;
      if (item.description) {
        // Clean up description: remove HTML tags
        const cleanedDesc = item.description
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        summary = cleanedDesc;
      }
      
      // Extract ISBN from Apple Books
      // Apple Books API may have isbn or isbn13/isbn10 in some responses
      let isbn: string | undefined = undefined;
      if (item.isbn) {
        isbn = String(item.isbn).replace(/-/g, ''); // Remove hyphens
      } else if (item.isbn13) {
        isbn = String(item.isbn13).replace(/-/g, '');
      } else if (item.isbn10) {
        isbn = String(item.isbn10).replace(/-/g, '');
      } else if (item.description) {
        // Try to extract ISBN from description text (e.g., "ISBN: 978-0-123-45678-9")
        const isbnMatch = item.description.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
        if (isbnMatch) {
          isbn = isbnMatch[1].replace(/-/g, '');
        }
      }

      return {
        title: title,
        author: author,
        publish_year: publishYear,
        genre: genre,
        cover_url: coverUrl,
        wikipedia_url: null,
        google_books_url: appleBooksUrl,
        summary: summary || null,
        isbn: isbn || undefined,
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

async function getAuthorAndYearFromWikidata(qid: string, lang = 'en'): Promise<{ author: string; publishYear?: number; genre?: string; isbn?: string }> {
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
  
  // Extract ISBN from P212 (ISBN-13) or P957 (ISBN-10) properties in Wikidata
  let isbn: string | undefined = undefined;
  const isbn13Claims = claims?.P212 ?? [];
  const isbn10Claims = claims?.P957 ?? [];
  
  // Prefer ISBN-13 over ISBN-10
  if (isbn13Claims.length > 0) {
    const isbnValue = isbn13Claims[0]?.mainsnak?.datavalue?.value;
    if (typeof isbnValue === 'string') {
      isbn = isbnValue.replace(/-/g, ''); // Remove hyphens
    } else if (typeof isbnValue === 'number') {
      isbn = String(isbnValue);
    }
  } else if (isbn10Claims.length > 0) {
    const isbnValue = isbn10Claims[0]?.mainsnak?.datavalue?.value;
    if (typeof isbnValue === 'string') {
      isbn = isbnValue.replace(/-/g, ''); // Remove hyphens
    } else if (typeof isbnValue === 'number') {
      isbn = String(isbnValue);
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
  return { author, publishYear, genre, isbn };
}

async function lookupBooksOnWikipedia(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
  const lang = isHebrew(query) ? 'he' : 'en';
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=7`;
  const searchData = await fetchWithRetry(searchUrl);
  const results = searchData.query?.search || [];
  
  if (results.length === 0) {
    return [];
  }
  
  // Process top 7 results
  const books = await Promise.all(
    results.slice(0, 7).map(async (result: any) => {
      const pageTitle = result.title;
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const summaryData = await fetchWithRetry(summaryUrl);
      
      const qid = await getWikidataItemForTitle(pageTitle, lang);
      const { author, publishYear, genre, isbn: isbnFromWikidata } = qid ? await getAuthorAndYearFromWikidata(qid, lang) : { author: summaryData.extract?.split('(')[0]?.trim() || 'Unknown Author', publishYear: undefined, genre: undefined, isbn: undefined };
      
      // Extract summary from Wikipedia extract
      // Wikipedia extract is typically a short synopsis of the book
      let summary: string | undefined = undefined;
      if (summaryData.extract) {
        const cleanedExtract = summaryData.extract.trim();
        summary = cleanedExtract;
      }
      
      // Extract ISBN from Wikipedia extract if not found in Wikidata
      let isbn: string | undefined = isbnFromWikidata;
      if (!isbn && summaryData.extract) {
        // Try to find ISBN in extract (e.g., "ISBN: 978-0-123-45678-9", "ISBN 9780123456789")
        const isbnMatch = summaryData.extract.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
        if (isbnMatch) {
          isbn = isbnMatch[1].replace(/-/g, ''); // Remove hyphens
        }
      }
      
      return {
        title: summaryData.title || pageTitle,
        author: author,
        publish_year: publishYear,
        genre: genre,
        cover_url: summaryData.thumbnail?.source?.replace('http://', 'https://') || null,
        wikipedia_url: summaryData.content_urls?.desktop?.page || null,
        google_books_url: null,
        summary: summary || null,
        isbn: isbn || undefined,
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
  let isbn: string | undefined = undefined;
  
  if (qid) {
    const wdData = await getAuthorAndYearFromWikidata(qid, lang);
    author = wdData.author || author;
    publishYear = wdData.publishYear;
    genre = wdData.genre;
    isbn = wdData.isbn;
  }

  // Extract summary from Wikipedia extract
  let summary: string | undefined = undefined;
  if (summaryData.extract) {
    const cleanedExtract = summaryData.extract.trim();
    summary = cleanedExtract;
    
    // Extract ISBN from extract if not found in Wikidata
    if (!isbn) {
      const isbnMatch = summaryData.extract.match(/isbn[:\s-]*([0-9X-]{10,17})/i);
      if (isbnMatch) {
        isbn = isbnMatch[1].replace(/-/g, ''); // Remove hyphens
      }
    }
  }

  return {
    title: summaryData.title || pageTitle,
    author: author,
    publish_year: publishYear,
    genre: genre,
    cover_url: summaryData.thumbnail?.source || summaryData.originalimage?.source || null,
    wikipedia_url: summaryData.content_urls?.desktop?.page || null,
    summary: summary || null,
    isbn: isbn || undefined,
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
    first_issue_year: book.first_issue_year,
    genre: book.genre,
    isbn: book.isbn,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
    google_books_url: book.google_books_url,
    summary: book.summary || null,
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

interface InsightItem {
  text: string;
  sourceUrl?: string;
  label: string;
}

interface InsightsCardsProps {
  insights: InsightItem[];
  bookId: string; // To reset when book changes
  isLoading?: boolean;
}

function InsightsCards({ insights, bookId, isLoading = false }: InsightsCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true); // Start visible to prevent flickering
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;
  const prevInsightsRef = useRef<string>('');
  
  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };
  
  // Extract actual book ID (remove category suffix if present)
  const actualBookId = bookId.split('-')[0];
  
  // Create a stable key from insights to detect actual content changes
  const insightsKey = insights.length > 0 
    ? `${insights.length}-${insights[0]?.text?.substring(0, 30)}-${insights[insights.length - 1]?.text?.substring(0, 30)}`
    : 'empty';

  useEffect(() => {
    // Only reset if the actual content changed (not just the array reference)
    if (insightsKey !== prevInsightsRef.current) {
      prevInsightsRef.current = insightsKey;
      // Only reset index, keep visibility to prevent flickering
    setCurrentIndex(0);
      // Ensure visibility is true if we have insights
      if (insights.length > 0) {
        setIsVisible(true);
      }
    }
  }, [insightsKey, insights.length]);
  
  // Separate effect for book changes to reset everything
  useEffect(() => {
    setCurrentIndex(0);
      setIsVisible(true);
    prevInsightsRef.current = '';
  }, [actualBookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % insights.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : insights.length - 1));
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
          className="rounded-2xl overflow-hidden"
          style={glassmorphicStyle}
        >
          {/* Label skeleton */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div className="w-14 h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
          {/* Header skeleton */}
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-10 h-10 rounded-full bg-slate-300/50 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="w-20 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-40 h-3 bg-slate-300/50 rounded animate-pulse" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="px-4 pb-4 space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-4/5 h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-3/5 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (insights.length === 0 || currentIndex >= insights.length) return null;

  const currentInsight = insights[currentIndex];

  // Stacked cards style (cards behind the main card)
  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        handleSwipe();
      }}
      className="w-full cursor-pointer"
    >
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {insights.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentInsight.text}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <Lightbulb size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Insights</p>
                <p className="text-xs text-slate-500">Interesting facts about this book</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {currentInsight.text}
              </p>
              {currentInsight.sourceUrl && (
                <a
                  href={currentInsight.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-600 font-medium hover:text-cyan-700"
                >
                  <ExternalLink size={12} />
                  Source
                </a>
              )}
              {/* Pagination */}
              {insights.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{insights.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Keep AuthorFactsTooltips for backward compatibility (deprecated - use InsightsCards)
interface AuthorFactsTooltipsProps {
  facts: string[];
  bookId: string;
  isLoading?: boolean;
}

function AuthorFactsTooltips({ facts, bookId, isLoading = false }: AuthorFactsTooltipsProps) {
  const insights: InsightItem[] = facts.map(fact => ({ text: fact, label: 'Trivia' }));
  return <InsightsCards insights={insights} bookId={bookId} isLoading={isLoading} />;
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
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const minSwipeDistance = 50;
  
  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

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
    setIsTextExpanded(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setIsTextExpanded(false);
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
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-2/3 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (episodes.length === 0 || currentIndex >= episodes.length) return null;

  const currentEpisode = episodes[currentIndex];
  const audioUrl = currentEpisode.audioUrl || (currentEpisode.url && currentEpisode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? currentEpisode.url : null);
  const isPlaying = playingAudioUrl === (audioUrl || currentEpisode.url);

  // Stacked cards style (cards behind the main card)
  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

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
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {episodes.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentEpisode.url}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <Headphones size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Podcasts</p>
                <p className="text-xs text-slate-500">Podcast about this book</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <div className="flex gap-3 mb-3">
                {/* Podcast thumbnail */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  {currentEpisode.thumbnail ? (
                    <img src={currentEpisode.thumbnail} alt={currentEpisode.title} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center">
                      <Headphones size={28} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm line-clamp-2">{decodeHtmlEntities(currentEpisode.title)}</p>
                  <p className="text-xs text-slate-500 mt-1">{decodeHtmlEntities(currentEpisode.podcast_name || 'Podcast')}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={(e) => handlePlay(e, currentEpisode)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                    >
                      {isPlaying ? (
                        <>
                          <VolumeX size={12} />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          Preview
                        </>
                      )}
                    </button>
                    {currentEpisode.url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(currentEpisode.url, '_blank');
                        }}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                      >
                        <ExternalLink size={12} />
                        Link
                      </button>
                    )}
                    {currentEpisode.length && (
                      <span className="text-xs text-slate-400">{currentEpisode.length}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Episode description with read-more */}
              {currentEpisode.episode_summary && (
                <div className="mt-2">
                  <p
                    className={`text-sm text-slate-700 leading-relaxed ${!isTextExpanded ? 'line-clamp-2' : ''}`}
                    onClick={(e) => {
                      if (currentEpisode.episode_summary && currentEpisode.episode_summary.length > 100) {
                        e.stopPropagation();
                        setIsTextExpanded(!isTextExpanded);
                      }
                    }}
                  >
                    {decodeHtmlEntities(currentEpisode.episode_summary)}
                  </p>
                  {currentEpisode.episode_summary.length > 100 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTextExpanded(!isTextExpanded);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                      {isTextExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}
              {/* Pagination */}
              {episodes.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{episodes.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
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
  
  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

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
          className="rounded-xl overflow-hidden"
          style={glassmorphicStyle}
        >
          <div className="relative w-full bg-slate-300/50 animate-pulse" style={{ paddingBottom: '56.25%' }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={32} className="text-slate-400/50" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (videos.length === 0 || currentIndex >= videos.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 text-center">No videos found</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideo.videoId}`;

  // Stacked cards style (cards behind the main card)
  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

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
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {videos.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentVideo.videoId}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Videos</p>
                <p className="text-xs text-slate-500">Videos about the book and its author</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              {/* Thumbnail with play button - works on iOS */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openSystemBrowser(videoUrl);
                }}
                className="relative w-full block rounded-xl overflow-hidden"
                style={{ paddingBottom: '56.25%' }}
              >
                {currentVideo.thumbnail ? (
                  <img
                    src={currentVideo.thumbnail}
                    alt={currentVideo.title}
                    className="absolute top-0 left-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute top-0 left-0 w-full h-full bg-slate-300 flex items-center justify-center">
                    <Play size={48} className="text-slate-500" />
                  </div>
                )}
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 active:bg-black/40 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <Play size={32} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              </button>
              <div className="mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openSystemBrowser(videoUrl);
                  }}
                  className="text-sm font-bold text-slate-900 block mb-1 line-clamp-2 text-left"
                >
                  {currentVideo.title}
                </button>
                <div className="text-xs text-slate-500 mb-2">
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
              {/* Pagination */}
              {videos.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{videos.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
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
  
  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

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
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="space-y-2">
            <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse mt-3" />
            <div className="w-5/6 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (articles.length === 0 || currentIndex >= articles.length) return null;

  const currentArticle = articles[currentIndex];

  // Stacked cards style (cards behind the main card)
  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

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
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {articles.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentArticle.url}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Articles</p>
                <p className="text-xs text-slate-500">Academic article about this book</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
              <div className="flex-1 min-w-0 mb-2">
                <a
                  href={currentArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-bold text-blue-700 hover:text-blue-800 hover:underline block mb-1 line-clamp-2"
                >
                  {decodeHtmlEntities(currentArticle.title)}
                </a>
                {(currentArticle.authors || currentArticle.year) && (
                  <div className="text-xs text-slate-500">
                    {currentArticle.authors && <span>{decodeHtmlEntities(currentArticle.authors)}</span>}
                    {currentArticle.year && <span> • {currentArticle.year}</span>}
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-2">
                {decodeHtmlEntities(currentArticle.snippet)}
              </p>
              {currentArticle.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(currentArticle.url, '_blank');
                  }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium active:scale-95 transition-transform"
                >
                  <ExternalLink size={12} />
                  Read full article
                </button>
              )}
              {/* Pagination */}
              {articles.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{articles.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
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

  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

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
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-16 h-20 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
              <div className="w-20 h-6 bg-slate-300/50 rounded-lg animate-pulse mt-2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
            <div className="w-4/5 h-3 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (books.length === 0 || currentIndex >= books.length) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 text-center">No related books found</p>
        </div>
      </div>
    );
  }

  const currentBook = books[currentIndex];

  // Stacked cards style (cards behind the main card)
  const stackedCardStyle = (offset: number, scale: number, opacity: number): React.CSSProperties => ({
    ...glassmorphicStyle,
    position: 'absolute' as const,
    inset: 0,
    transform: `translateY(${offset}px) scale(${scale})`,
    opacity,
    borderRadius: '16px',
  });

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
        e.stopPropagation(); // Prevent book navigation swipe
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        e.stopPropagation(); // Prevent book navigation swipe
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation(); // Prevent book navigation swipe
        handleSwipe();
      }}
      className="w-full cursor-pointer"
    >
      <div className="relative pb-3">
        {/* Stacked cards effect - only show if multiple items */}
        {books.length > 1 && (
          <>
            <div style={stackedCardStyle(4, 0.96, 0.4)} />
            <div style={stackedCardStyle(-4, 0.98, 0.6)} />
          </>
        )}
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={`${currentBook.title}-${currentIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="relative rounded-2xl overflow-hidden"
              style={glassmorphicStyle}
            >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <BookMarked size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm">Related Books</p>
                <p className="text-xs text-slate-500">Similar books you might enjoy</p>
              </div>
            </div>
            {/* Content */}
            <div className="px-4 pb-4">
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
                  <h3 className="text-sm font-bold text-slate-800 mb-1 line-clamp-2">
                    {decodeHtmlEntities(currentBook.title)}
                  </h3>
                  <div className="text-xs text-slate-500 mb-2">
                    <span>{decodeHtmlEntities(currentBook.author)}</span>
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
              {currentBook.reason && (
                <div className="mb-2">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {decodeHtmlEntities(currentBook.reason)}
                  </p>
                </div>
              )}
              {/* Pagination */}
              {books.length > 1 && (
                <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                  Tap for next ({currentIndex + 1}/{books.length})
                </p>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface ResearchSectionProps {
  research: BookResearch | null;
  bookId: string;
  isLoading?: boolean;
}

function ResearchSection({ research, bookId, isLoading = false }: ResearchSectionProps) {
  // Generate colors for pillar labels
  const pillarColors = [
    'bg-blue-600', 'bg-purple-600', 'bg-pink-600', 'bg-indigo-600',
    'bg-teal-600', 'bg-orange-600', 'bg-red-600', 'bg-green-600',
    'bg-yellow-600', 'bg-cyan-600', 'bg-amber-600', 'bg-emerald-600',
    'bg-violet-600', 'bg-rose-600'
  ];
  
  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-xl p-4"
          style={glassmorphicStyle}
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!research || !research.pillars || research.pillars.length === 0) {
    return (
      <div className="w-full">
        <div className="rounded-xl p-4" style={glassmorphicStyle}>
          <p className="text-xs text-slate-600 text-center">No research data available</p>
        </div>
      </div>
    );
  }

  // Flatten all content items from all pillars for card navigation
  const allContentItems: Array<{ pillar: ResearchPillar; item: ResearchContentItem; itemIndex: number }> = [];
  research.pillars.forEach(pillar => {
    pillar.content_items.forEach((item, itemIndex) => {
      allContentItems.push({ pillar, item, itemIndex });
    });
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (allContentItems.length === 0) return;

    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [research, bookId]);

  function handleNext() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % allContentItems.length);
      setIsVisible(true);
    }, 300);
  }

  function handlePrev() {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : allContentItems.length - 1));
      setIsVisible(true);
    }, 300);
  }

  const handleSwipe = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (allContentItems.length === 0 || currentIndex >= allContentItems.length) return null;

  const current = allContentItems[currentIndex];
  const pillarIndex = research.pillars.findIndex(p => p.pillar_name === current.pillar.pillar_name);
  const colorClass = pillarColors[pillarIndex % pillarColors.length];

  return (
    <div
      onClick={handleNext}
      onTouchStart={(e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        if (touchStart) {
          const touch = e.touches[0];
          setTouchEnd({ x: touch.clientX, y: touch.clientY });
        }
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        handleSwipe();
      }}
      className="w-full cursor-pointer"
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={`${current.pillar.pillar_name}-${current.itemIndex}-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="rounded-xl p-4"
          style={glassmorphicStyle}
          >
            {/* Pillar Label */}
            <div className="mb-3">
              <span className={`${colorClass} text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg inline-block`}>
                {current.pillar.pillar_name}
              </span>
            </div>
            
            {/* Deep Insight */}
            <p className="text-xs font-medium text-slate-800 leading-relaxed mb-3">
              {current.item.deep_insight}
            </p>
            
            {/* Source URL Icon */}
            {current.item.source_url && (
              <div className="flex justify-end">
                <a
                  href={current.item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            )}
            
            {allContentItems.length > 1 && (
              <p className="text-xs text-slate-600 text-center mt-3 font-bold uppercase tracking-wider">
                Tap for next ({currentIndex + 1}/{allContentItems.length})
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Memoized arrow animation to prevent re-renders from restarting animation
const ArrowAnimation = React.memo(function ArrowAnimation({ isBookshelfEmpty = false }: { isBookshelfEmpty?: boolean }) {
  return (
    <div className={`absolute top-0 left-0 right-0 pointer-events-none z-10 flex justify-start pt-32 pl-4 ${isBookshelfEmpty ? 'ml-[170px] mt-[150px]' : 'ml-[70px] mt-[70px]'}`}>
      <Lottie
        animationData={arrowAnimation}
        loop={false}
        className="w-44 h-44 -scale-x-100 rotate-[140deg]"
      />
    </div>
  );
});

// Lightbulb animation that plays forward, then reverse, then hides
const LightbulbAnimation = React.memo(function LightbulbAnimation({ bookId }: { bookId: string }) {
  const lottieRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [playingReverse, setPlayingReverse] = useState(false);

  // Set speed on mount
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.setSpeed(1.25);
    }
  }, []);

  // Reset state when bookId changes
  useEffect(() => {
    setIsVisible(true);
    setPlayingReverse(false);
    if (lottieRef.current) {
      lottieRef.current.setDirection(1);
      lottieRef.current.setSpeed(1.25);
      lottieRef.current.goToAndPlay(0);
    }
  }, [bookId]);

  const handleComplete = () => {
    if (!playingReverse) {
      // First completion: play in reverse
      setPlayingReverse(true);
      if (lottieRef.current) {
        lottieRef.current.setDirection(-1);
        lottieRef.current.play();
      }
    } else {
      // Second completion (reverse done): hide
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={lightbulbAnimation}
      loop={false}
      onComplete={handleComplete}
      className="w-36 h-36"
    />
  );
});

// Info Page Variant B - Rotating tooltips component
const InfoPageTooltips = React.memo(function InfoPageTooltips() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tooltips = [
    {
      type: 'youtube',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      label: 'YouTube',
      title: 'Brandon Sanderson on World Building',
      subtitle: 'The Author\'s Corner • 1.2M views',
      content: 'Exclusive interview where the author discusses the intricate magic system and its real-world inspirations',
    },
    {
      type: 'podcast',
      thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop',
      label: 'Podcast',
      title: 'The Literary Deep Dive',
      subtitle: 'Episode 142 • 58 min',
      content: 'Historical accuracy explored: How the author researched medieval warfare for authentic battle scenes',
    },
    {
      type: 'icon',
      icon: <Lightbulb size={24} className="text-white" />,
      color: 'rgba(234, 179, 8, 0.9)',
      borderColor: 'rgba(234, 179, 8, 0.3)',
      label: 'Fun Fact',
      content: 'The manuscript was rejected by 12 major publishers over 3 years before becoming a #1 bestseller that stayed on the charts for 47 weeks',
    },
    {
      type: 'icon',
      icon: <FileText size={24} className="text-white" />,
      color: 'rgba(59, 130, 246, 0.9)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      label: 'Article',
      content: 'The Guardian explores how this novel redefined the fantasy genre and influenced a generation of writers',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tooltips.length);
    }, 2500); // Rotate every 2.5 seconds
    return () => clearInterval(interval);
  }, [tooltips.length]);

  const currentTooltip = tooltips[currentIndex];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full flex justify-center"
      >
        <div
          className="px-[min(20px,2.5vh)] py-[min(20px,2.5vh)] rounded-2xl w-[min(340px,90vw)]"
          style={{
            background: 'rgba(255, 255, 255, 0.35)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          {(currentTooltip.type === 'youtube' || currentTooltip.type === 'podcast') ? (
            <div>
              <div className="w-[min(112px,14vh)] h-[min(112px,14vh)] rounded-xl overflow-hidden relative float-left mr-[min(16px,2vh)] mb-2">
                <img
                  src={currentTooltip.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-[min(48px,6vh)] h-[min(48px,6vh)] rounded-full bg-white/90 flex items-center justify-center">
                    <Play size={22} className={currentTooltip.type === 'youtube' ? 'text-red-600 ml-0.5' : 'text-purple-600 ml-0.5'} fill="currentColor" />
                  </div>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {currentTooltip.label}
              </p>
              {currentTooltip.title && (
                <p className="text-base font-bold text-slate-900 leading-tight mb-1">
                  {currentTooltip.title}
                </p>
              )}
              {currentTooltip.subtitle && (
                <p className="text-sm text-slate-500 mb-1">
                  {currentTooltip.subtitle}
                </p>
              )}
              <p className="text-sm text-slate-700 leading-snug">
                {currentTooltip.content}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-[min(16px,2vh)]">
              <div
                className="w-[min(56px,7vh)] h-[min(56px,7vh)] rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: currentTooltip.color,
                  border: `1px solid ${currentTooltip.borderColor}`,
                }}
              >
                {React.cloneElement(currentTooltip.icon as React.ReactElement, { size: 24 })}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {currentTooltip.label}
                </p>
                <p className="text-sm text-slate-700 leading-snug">
                  {currentTooltip.content}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

interface RatingStarsProps {
  value: number | null;
  onRate: (dimension: string, value: number | null) => void;
  dimension: string;
}

const RATING_FEEDBACK: Record<number, string> = {
  1: "A BAD BOOK!",
  2: "MEH...",
  3: "AN OK BOOK",
  4: "A GOOD BOOK",
  5: "A GREAAAAAT BOOK!",
};

function RatingStars({ value, onRate, dimension }: RatingStarsProps) {
  const [localValue, setLocalValue] = useState(value || 0);
  const [isLocked, setIsLocked] = useState(false);
  const [ratingFeedback, setRatingFeedback] = useState<string | null>(
    value ? RATING_FEEDBACK[value] : null
  );

  // Only sync from prop when dimension changes (new rating context)
  useEffect(() => {
    setLocalValue(value || 0);
    setIsLocked(false);
    setRatingFeedback(value ? RATING_FEEDBACK[value] : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension]);

  function handleTap(star: number) {
    if (isLocked) return;
    setIsLocked(true);
    setLocalValue(star);
    setRatingFeedback(RATING_FEEDBACK[star]);

    // Delay the onRate call to show feedback first
    setTimeout(() => {
      // Always pass the star value (never null)
      onRate(dimension, star);
      setIsLocked(false);
    }, 800);
  }

  function handleSkip() {
    if (isLocked) return;
    setIsLocked(true);
    // Clear stars visually first
    setLocalValue(0);
    setRatingFeedback("SKIPPED");
    // Wait for animation then close
    setTimeout(() => {
      onRate(dimension, null);
      setIsLocked(false);
    }, 500);
  }

  const titleText = ratingFeedback || "RATING";

  return (
    <div className="flex flex-col items-center gap-1">
      <AnimatePresence mode="wait">
        <motion.h3
          key={titleText}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-bold uppercase tracking-widest text-slate-950"
        >
          {titleText}
        </motion.h3>
      </AnimatePresence>
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
      <button
        onClick={handleSkip}
        className="px-3 py-0.5 text-xs font-medium text-slate-500 hover:text-slate-700 active:scale-95 transition-all"
      >
        Skip
      </button>
    </div>
  );
}

interface AddBookSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) => void;
  books: BookWithRatings[];
  onSelectBook?: (bookId: string) => void;
  onSelectUser?: (userId: string) => void;
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  book_count?: number;
}

interface DBBookSearchResult {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  publish_year?: number | null;
  wikipedia_url?: string | null;
  google_books_url?: string | null;
  genre?: string | null;
  first_issue_year?: number | null;
  summary?: string | null;
  user_id: string;
  user_name?: string | null;
  user_avatar?: string | null;
}

function AddBookSheet({ isOpen, onClose, onAdd, books, onSelectBook, onSelectUser }: AddBookSheetProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<(Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' })[]>([]);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [dbBookResults, setDbBookResults] = useState<DBBookSearchResult[]>([]);
  const [bookshelfResults, setBookshelfResults] = useState<BookWithRatings[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter bookshelf as user types
  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      const filtered = books.filter(book =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.author.toLowerCase().includes(lowerQuery)
      );
      setBookshelfResults(filtered);
    } else {
      setBookshelfResults([]);
    }
  }, [query, books]);

  // Debounced user search as user types
  useEffect(() => {
    if (query.trim().length <= 2) {
      setUserResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const users = await searchUsers(query);
      setUserResults(users);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  // Debounced book search from database as user types
  useEffect(() => {
    if (query.trim().length <= 2) {
      setDbBookResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const dbBooks = await searchBooksFromDB(query);
      setDbBookResults(dbBooks);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, user]);

  // Search for users by querying users table
  async function searchUsers(searchQuery: string) {
    if (!searchQuery.trim() || !user) return [];
    
    try {
      const lowerQuery = searchQuery.toLowerCase();
      
      // Query users table - search by email or full_name
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url')
        .neq('id', user.id) // Exclude current user
        .or(`email.ilike.%${lowerQuery}%,full_name.ilike.%${lowerQuery}%`)
        .limit(10);
      
      if (error) {
        console.error('Error searching users:', error.message, error.code, error.details, error.hint);
        return [];
      }
      
      if (!usersData || usersData.length === 0) {
        return [];
      }
      
      // For each user, count their books
      const userResults: UserSearchResult[] = [];
      
      for (const userData of usersData) {
        // Count books for this user
        const { count } = await supabase
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.id);
        
        userResults.push({
          id: userData.id,
          email: userData.email || userData.id,
          full_name: userData.full_name,
          avatar_url: userData.avatar_url,
          book_count: count || 0,
        });
      }
      
      return userResults;
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  }

  // Search for books in database using trigram indexes
  async function searchBooksFromDB(searchQuery: string): Promise<DBBookSearchResult[]> {
    if (!searchQuery.trim() || !user) return [];

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Query books table - search by title or author using trigram-indexed ilike
      const { data: booksData, error } = await supabase
        .from('books')
        .select('id, title, author, cover_url, publish_year, wikipedia_url, google_books_url, genre, first_issue_year, summary, user_id')
        .neq('user_id', user.id) // Exclude current user's books
        .or(`title.ilike.%${lowerQuery}%,author.ilike.%${lowerQuery}%`)
        .limit(10);

      if (error) {
        console.error('Error searching books:', error.message, error.code, error.details, error.hint);
        return [];
      }

      if (!booksData || booksData.length === 0) {
        return [];
      }

      // Get unique user IDs to fetch user info
      const userIds = [...new Set(booksData.map(b => b.user_id))];

      // Fetch user info for all book owners
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const userMap = new Map(usersData?.map(u => [u.id, u]) || []);

      // Map books with user info
      return booksData.map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        publish_year: book.publish_year,
        wikipedia_url: book.wikipedia_url,
        google_books_url: book.google_books_url,
        genre: book.genre,
        first_issue_year: book.first_issue_year,
        summary: book.summary,
        user_id: book.user_id,
        user_name: userMap.get(book.user_id)?.full_name || null,
        user_avatar: userMap.get(book.user_id)?.avatar_url || null,
      }));
    } catch (err) {
      console.error('Error searching books:', err);
      return [];
    }
  }

  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) {
      setUserResults([]);
      setDbBookResults([]);
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    setError('');
    setSearchResults([]);
    setSuggestions([]); // Clear suggestions first

    try {
      // Start both book searches simultaneously
      const applePromise = lookupBooksOnAppleBooks(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'apple_books' as const }))
      ).catch(() => []);

      const wikiPromise = lookupBooksOnWikipedia(titleToSearch).then(results =>
        results.slice(0, 7).map(book => ({ ...book, source: 'wikipedia' as const }))
      ).catch(() => []);

      // Show Apple Books results as soon as they return
      const appleResults = await applePromise;
      if (appleResults.length > 0) {
        setSearchResults(appleResults);
        setSuggestions([]);
      }

      // Wait for Wikipedia results and append them
      const wikiResults = await wikiPromise;
      if (wikiResults.length > 0) {
        // Append Wikipedia results to existing Apple Books results
        setSearchResults(prev => [...prev, ...wikiResults]);
      }

      // Check if we have any results after both complete
      const combinedResults = [...appleResults, ...wikiResults];
      if (combinedResults.length === 0 && userResults.length === 0 && dbBookResults.length === 0) {
        setError(`No results found.`);
        
        // Fetch AI suggestions only when no results
        try {
          const aiSuggestions = await getAISuggestions(titleToSearch);
      setSuggestions(aiSuggestions);
        } catch (aiErr) {
          console.error('Error fetching AI suggestions:', aiErr);
          // Don't set error for AI suggestions failure, just leave suggestions empty
        }
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
  }
  
  function handleSelectBook(book: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> & { source?: 'apple_books' | 'wikipedia' }) {
    // Remove source property before adding to database
    const { source, ...bookWithoutSource } = book;
    onAdd(bookWithoutSource);
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

  // Track keyboard visibility
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Monitor viewport changes to detect keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => {
            if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - viewportHeight;
        
        if (heightDiff > 150) {
          setIsKeyboardVisible(true);
          setKeyboardHeight(heightDiff);
        } else {
          setIsKeyboardVisible(false);
          setKeyboardHeight(0);
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      handleViewportChange();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, [isOpen]);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  // Scroll results to top when they appear
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((searchResults.length > 0 || bookshelfResults.length > 0) && resultsContainerRef.current) {
      resultsContainerRef.current.scrollTop = 0;
    }
  }, [searchResults.length, bookshelfResults.length]);

  const isQueryHebrew = isHebrew(query);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
      style={{
        paddingBottom: '0px'
      }}
    >
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: isKeyboardVisible && window.visualViewport 
            ? `${window.visualViewport.height - 40}px` 
            : '90vh'
        }}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-12 h-1 bg-slate-400 rounded-full" />
        </div>

        {/* Results area - scrollable, behind search box, starts at top */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto px-4 ios-scroll"
          style={{
            paddingBottom: '120px', // Space for search box at bottom
            maxHeight: isKeyboardVisible && window.visualViewport
              ? `${window.visualViewport.height - (window.visualViewport.offsetTop || 0) - 200}px` // Account for keyboard and search box
              : 'calc(100vh - 250px)' // Default: account for header, handle bar, and search box
          }}
        >
          <div className="space-y-4">
            {/* Bookshelf Results - Show first as user types */}
            <AnimatePresence>
              {bookshelfResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    Your bookshelf:
            </div>
                  {bookshelfResults.slice(0, 5).map((book, i) => (
                    <motion.button
                      key={`bookshelf-${book.id || `book-${i}`}`}
                type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                onClick={() => {
                        if (onSelectBook) {
                          onSelectBook(book.id);
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50/80 backdrop-blur-md hover:bg-blue-100/85 rounded-xl border border-blue-200/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img 
                          src={book.cover_url} 
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-blue-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-100">
                            Your Book
                </span>
            </div>
              </div>
                    </motion.button>
                  ))}
                </motion.div>
            )}
            </AnimatePresence>

            {/* User Results */}
            <AnimatePresence>
              {userResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    Users:
                  </div>
                  {userResults.map((userResult, i) => (
                    <motion.button
                      key={`user-${userResult.id || `user-${i}`}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        if (onSelectUser) {
                          onSelectUser(userResult.id);
                        }
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-purple-50/80 backdrop-blur-md hover:bg-purple-100/85 rounded-xl border border-purple-200/30 shadow-sm transition-all text-left"
                    >
                      {userResult.avatar_url ? (
                        <img 
                          src={userResult.avatar_url} 
                          alt={userResult.full_name || userResult.email}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-purple-200/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-200 flex-shrink-0 flex items-center justify-center">
                          <User size={20} className="text-purple-700" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">
                          {userResult.full_name || userResult.email}
                        </h3>
                        <p className="text-xs text-slate-600">{userResult.book_count || 0} {userResult.book_count === 1 ? 'book' : 'books'}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Database Book Results - Books from other users */}
            <AnimatePresence>
              {dbBookResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 mb-4"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    From Community:
                  </div>
                  {dbBookResults.map((book, i) => (
                    <motion.button
                      key={`db-book-${book.id}`}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        // Add book to user's bookshelf
                        onAdd({
                          title: book.title,
                          author: book.author,
                          publish_year: book.publish_year || null,
                          cover_url: book.cover_url || null,
                          wikipedia_url: book.wikipedia_url || null,
                          google_books_url: book.google_books_url || null,
                          genre: book.genre || null,
                          first_issue_year: book.first_issue_year || null,
                          summary: book.summary || null,
                          notes: null,
                          reading_status: null,
                        });
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-emerald-50/80 backdrop-blur-md hover:bg-emerald-100/85 rounded-xl border border-emerald-200/30 shadow-sm transition-all text-left"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-emerald-100 rounded flex-shrink-0 flex items-center justify-center">
                          <BookOpen size={20} className="text-emerald-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
                          )}
                          {book.user_name && (
                            <>
                              {book.publish_year && <span className="text-slate-400">•</span>}
                              <div className="flex items-center gap-1">
                                {book.user_avatar ? (
                                  <img
                                    src={book.user_avatar}
                                    alt={book.user_name}
                                    className="w-4 h-4 rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center">
                                    <User size={8} className="text-emerald-700" />
                                  </div>
                                )}
                                <span className="text-[10px] text-emerald-700 truncate max-w-[80px]">{book.user_name}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <div className="text-xs font-medium text-slate-700 mb-2">
                    {bookshelfResults.length > 0 || userResults.length > 0 || dbBookResults.length > 0 ? 'Books:' : 'Select a book to add:'}
                  </div>
                  {searchResults.map((book, i) => (
                    <motion.button
                      key={`search-book-${i}-${book.title || ''}-${book.author || ''}`}
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
                        <div className="flex items-center gap-2 mt-1">
                        {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
                          )}
                          {book.source && (
                            <>
                              {book.publish_year && <span className="text-slate-400">•</span>}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                book.source === 'apple_books' 
                                  ? 'text-blue-700 bg-blue-100' 
                                  : 'text-purple-700 bg-purple-100'
                              }`}>
                                {book.source === 'apple_books' ? 'Apple Books' : 'Wikipedia'}
                        </span>
                            </>
                      )}
                        </div>
                      </div>
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
          </div>
        </div>

        {/* Search input - sticky at bottom, right above keyboard, overlays results */}
        <div 
          className="sticky bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2"
          style={{
            paddingBottom: isKeyboardVisible 
              ? `${Math.max(12, keyboardHeight > 0 ? 16 : 12)}px` 
              : 'calc(12px + env(safe-area-inset-bottom, 0px))',
            marginTop: '-120px' // Overlap with results area
          }}
        >
          <div className="bg-white bg-clip-padding backdrop-filter backdrop-blur-xl bg-opacity-10 backdrop-saturate-150 backdrop-contrast-75 rounded-full px-1.5 py-1.5 shadow-2xl border border-white/30">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <div className="relative flex items-center">
                <input 
                  ref={inputRef}
                  type="text" 
                  inputMode="search"
                  placeholder={isQueryHebrew ? "חפש ספר..." : "Search for book, author, user..."}
                  value={query} 
                  onChange={e => setQuery(e.target.value)}
                  className={`w-full h-11 bg-white/20 border border-white/30 rounded-full focus:outline-none focus:bg-white/30 text-base transition-all text-slate-950 placeholder:text-slate-600 ${isQueryHebrew ? 'text-right pr-12 pl-4' : 'pl-12 pr-4'}`}
                  dir={isQueryHebrew ? "rtl" : "ltr"}
                />
                <button
                  type="submit"
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 active:scale-95 transition-all cursor-pointer ${isQueryHebrew ? 'right-4' : 'left-4'}`}
                  aria-label="Search"
                >
                  {featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/search.svg")} alt="Search" className="w-[18px] h-[18px]" />
                  ) : (
                    <Search size={18} className="text-slate-600" />
                  )}
                </button>
              </div>
          </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Trivia Game Functions ---

interface TriviaNote {
  fact: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
}

// Collect random trivia notes from books
function collectTriviaNotes(books: BookWithRatings[]): TriviaNote[] {
  console.log('[collectTriviaNotes] Collecting trivia notes from books...');
  
  // Filter books that are completed reading and have author_facts
  const booksWithFacts = books.filter(book => 
    book.reading_status === 'read_it' &&
    book.author_facts && 
    Array.isArray(book.author_facts) && 
    book.author_facts.length > 0
  );
  
  if (booksWithFacts.length < 10) {
    console.warn('[collectTriviaNotes] ⚠️ Need at least 10 books with facts, found:', booksWithFacts.length);
    return [];
  }
  
  // Shuffle and take at least 10 different books
  const shuffled = [...booksWithFacts].sort(() => Math.random() - 0.5);
  const selectedBooks = shuffled.slice(0, Math.max(10, Math.min(20, shuffled.length)));
  
  // Collect 20 trivia notes total, ensuring at least one from each selected book
  const triviaNotes: TriviaNote[] = [];
  const notesPerBook = Math.floor(20 / selectedBooks.length);
  const remainder = 20 % selectedBooks.length;
  
  for (let i = 0; i < selectedBooks.length; i++) {
    const book = selectedBooks[i];
    const facts = book.author_facts || [];
    const count = notesPerBook + (i < remainder ? 1 : 0);
    
    // Shuffle facts and take random ones
    const shuffledFacts = [...facts].sort(() => Math.random() - 0.5);
    const selectedFacts = shuffledFacts.slice(0, Math.min(count, shuffledFacts.length));
    
    for (const fact of selectedFacts) {
      triviaNotes.push({
        fact,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author
      });
    }
  }
  
  // Shuffle all collected notes
  const finalNotes = triviaNotes.sort(() => Math.random() - 0.5).slice(0, 20);
  
  console.log(`[collectTriviaNotes] ✅ Collected ${finalNotes.length} trivia notes from ${selectedBooks.length} books`);
  return finalNotes;
}

// Generate trivia questions from trivia notes using Grok
// Generate trivia questions for a single book when author_facts are available
async function generateTriviaQuestionsForBook(bookTitle: string, bookAuthor: string, facts: string[]): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  source: string;
  source_detail?: string;
  url?: string;
}>> {
  console.log(`[generateTriviaQuestionsForBook] Generating trivia questions for "${bookTitle}" by ${bookAuthor}...`);
  
  if (!grokApiKey) {
    console.warn('[generateTriviaQuestionsForBook] API key is missing!');
    return [];
  }
  
  if (!facts || facts.length === 0) {
    console.warn('[generateTriviaQuestionsForBook] No facts provided');
    return [];
  }
  
  // Format facts as JSON array
  const factsJson = facts.map(fact => ({ author_facts: [fact] }));
  
  // Load prompt from prompts.yaml
  const prompts = await loadPrompts();
  if (!prompts.trivia_questions || !prompts.trivia_questions.prompt) {
    console.error('[generateTriviaQuestionsForBook] ❌ trivia_questions prompt not found in prompts config');
    return [];
  }
  
  // Format the prompt with book title, author, and facts JSON
  const prompt = formatPrompt(prompts.trivia_questions.prompt, { 
    book_title: bookTitle,
    author_name: bookAuthor,
    FACTS_JSON: JSON.stringify(factsJson, null, 2) 
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.8
  };

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
    
    // Log usage
    if (data.usage) {
      logGrokUsage('generateTriviaQuestionsForBook', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{}';
    // Extract JSON from markdown if needed
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    
    const questions = parsed.questions || [];
    
    console.log(`[generateTriviaQuestionsForBook] ✅ Generated ${questions.length} trivia questions`);
    return questions;
  } catch (err: any) {
    console.error('[generateTriviaQuestionsForBook] ❌ Error:', err);
    return [];
  }
}

// Global ref to store refresh callback (set by component)
let triviaQuestionsCountRefreshCallback: (() => void) | null = null;

function setTriviaQuestionsCountRefreshCallback(callback: (() => void) | null) {
  triviaQuestionsCountRefreshCallback = callback;
}

// Save trivia questions to cache table
async function saveTriviaQuestionsToCache(bookTitle: string, bookAuthor: string, questions: Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  source: string;
  source_detail?: string;
  url?: string;
}>): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();
    
    if (questions.length === 0) {
      console.warn('[saveTriviaQuestionsToCache] No questions to save');
      return;
    }
    
    // Check if questions already exist for this book
    const { data: existing, error: checkError } = await supabase
      .from('trivia_questions_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveTriviaQuestionsToCache] ❌ Error checking existing record:', checkError);
    }
    
    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      questions: questions,
      updated_at: new Date().toISOString(),
    };
    
    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('trivia_questions_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('trivia_questions_cache')
        .insert(recordData);
    }
    
    if (result.error) {
      console.error('[saveTriviaQuestionsToCache] ❌ Error saving trivia questions:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });
      
      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveTriviaQuestionsToCache] ⚠️ Table "trivia_questions_cache" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveTriviaQuestionsToCache] ✅ Saved ${questions.length} trivia questions to cache`);
      // Trigger refresh callback if available
      if (triviaQuestionsCountRefreshCallback) {
        triviaQuestionsCountRefreshCallback();
      }
    }
  } catch (err: any) {
    console.error('[saveTriviaQuestionsToCache] ❌ Error:', err);
  }
}

// Count books with trivia questions in cache
async function countBooksWithTriviaQuestions(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('trivia_questions_cache')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('[countBooksWithTriviaQuestions] ❌ Error counting books:', error);
      return 0;
    }
    
    return count || 0;
  } catch (err: any) {
    console.error('[countBooksWithTriviaQuestions] ❌ Error:', err);
    return 0;
  }
}

// Load random trivia questions from cache (11 questions from all available books)
async function loadRandomTriviaQuestions(): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
  book_title?: string;
  book_author?: string;
}>> {
  console.log('[loadRandomTriviaQuestions] Loading random trivia questions from cache...');
  
  try {
    // Get all trivia questions from cache
    const { data: allQuestions, error } = await supabase
      .from('trivia_questions_cache')
      .select('questions, book_title, book_author');
    
    if (error) {
      console.error('[loadRandomTriviaQuestions] ❌ Error loading questions:', error);
      return [];
    }
    
    if (!allQuestions || allQuestions.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No trivia questions found in cache');
      return [];
    }
    
    // Flatten all questions from all books
    const allQuestionsFlat: Array<{
      question: string;
      correct_answer: string;
      wrong_answers: string[];
      book_title?: string;
      book_author?: string;
    }> = [];
    
    for (const record of allQuestions) {
      if (record.questions && Array.isArray(record.questions)) {
        for (const q of record.questions) {
          // Extract only the fields we need for the game
          allQuestionsFlat.push({
            question: q.question,
            correct_answer: q.correct_answer,
            wrong_answers: q.wrong_answers || [],
            book_title: record.book_title,
            book_author: record.book_author,
          });
        }
      }
    }
    
    if (allQuestionsFlat.length === 0) {
      console.warn('[loadRandomTriviaQuestions] ⚠️ No questions found after flattening');
      return [];
    }
    
    // Shuffle and take 11 random questions
    const shuffled = [...allQuestionsFlat].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(11, shuffled.length));
    
    console.log(`[loadRandomTriviaQuestions] ✅ Loaded ${selected.length} random trivia questions from ${allQuestions.length} books`);
    return selected;
  } catch (err: any) {
    console.error('[loadRandomTriviaQuestions] ❌ Error:', err);
    return [];
  }
}

// Legacy function for backward compatibility (used by old trivia game flow)
async function generateTriviaQuestions(triviaNotes: TriviaNote[]): Promise<Array<{
  question: string;
  correct_answer: string;
  wrong_answers: string[];
}>> {
  console.log('[generateTriviaQuestions] Generating trivia questions via Grok...');
  
  if (!grokApiKey) {
    console.warn('[generateTriviaQuestions] API key is missing!');
    return [];
  }
  
  // Compile trivia notes into JSON format for the prompt
  const factsJson = triviaNotes.map((note, idx) => ({
    author_facts: [note.fact]
  }));
  
  // Load prompt from prompts.yaml
  const prompts = await loadPrompts();
  if (!prompts.trivia_questions || !prompts.trivia_questions.prompt) {
    console.error('[generateTriviaQuestions] ❌ trivia_questions prompt not found in prompts config');
    return [];
  }
  
  // Format the prompt with the facts JSON
  const prompt = formatPrompt(prompts.trivia_questions.prompt, { 
    FACTS_JSON: JSON.stringify(factsJson, null, 2) 
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const url = 'https://api.x.ai/v1/chat/completions';
  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.8
  };

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
    
    // Log usage
    if (data.usage) {
      logGrokUsage('generateTriviaQuestions', data.usage);
    }
    
    const content = data.choices?.[0]?.message?.content || '{}';
    // Extract JSON from markdown if needed
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    
    const questions = parsed.questions || [];
    
    // Shuffle questions
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
    
    console.log(`[generateTriviaQuestions] ✅ Generated ${shuffledQuestions.length} trivia questions`);
    return shuffledQuestions;
  } catch (err: any) {
    console.error('[generateTriviaQuestions] ❌ Error:', err);
    return [];
  }
}

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [books, setBooks] = useState<BookWithRatings[]>([]);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Screenshot mode for App Store screenshots
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [screenshotOverlayText, setScreenshotOverlayText] = useState('Discover the world around your books');
  const [viewingUserBooks, setViewingUserBooks] = useState<BookWithRatings[]>([]);
  const [viewingUserName, setViewingUserName] = useState<string>('');
  const [viewingUserFullName, setViewingUserFullName] = useState<string | null>(null);
  const [viewingUserAvatar, setViewingUserAvatar] = useState<string | null>(null);
  const [viewingUserIsPrivate, setViewingUserIsPrivate] = useState(false);
  const [viewingBookFromOtherUser, setViewingBookFromOtherUser] = useState<BookWithRatings | null>(null);
  const [isLoadingViewingUserBooks, setIsLoadingViewingUserBooks] = useState(false);
  const [isFadingOutViewingUser, setIsFadingOutViewingUser] = useState(false);
  const [isFollowingViewingUser, setIsFollowingViewingUser] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [myFollowingCount, setMyFollowingCount] = useState(0);
  const [viewingUserFollowingCount, setViewingUserFollowingCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastSelectedBookIndex');
      const parsed = saved ? parseInt(saved, 10) : 0;
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectingReadingStatusInRating, setSelectingReadingStatusInRating] = useState(false);
  const [selectingReadingStatusForExisting, setSelectingReadingStatusForExisting] = useState(false);
  const [pendingBookMeta, setPendingBookMeta] = useState<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null>(null);
  
  // Swipe detection state for book navigation
  const [bookTouchStart, setBookTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [bookTouchEnd, setBookTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;
  
  // Handle book navigation swipe
  const handleBookSwipe = () => {
    if (!bookTouchStart || !bookTouchEnd) return;

    // Don't allow swiping when in notes editor
    if (isShowingNotes) return;
    
    const distanceX = bookTouchStart.x - bookTouchEnd.x;
    const distanceY = bookTouchStart.y - bookTouchEnd.y;
    
    // Only handle horizontal swipes (ignore if vertical scroll is more dominant)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      triggerMediumHaptic();
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
  const openNotesAfterNavRef = useRef(false); // Track when to open notes after navigating from notes list
  const [newlyAddedNoteTimestamp, setNewlyAddedNoteTimestamp] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const lastSavedNoteTextRef = useRef<string>('');
  const noteTextOnFocusRef = useRef<string>('');
  const noteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevIsShowingNotesRef = useRef(false);
  const [isMetaExpanded, setIsMetaExpanded] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [loadingFactsForBookId, setLoadingFactsForBookId] = useState<string | null>(null);
  const [bookInfluences, setBookInfluences] = useState<Map<string, string[]>>(new Map());
  const [loadingInfluencesForBookId, setLoadingInfluencesForBookId] = useState<string | null>(null);
  const [bookDomain, setBookDomain] = useState<Map<string, DomainInsights>>(new Map());
  const [loadingDomainForBookId, setLoadingDomainForBookId] = useState<string | null>(null);
  const [bookContext, setBookContext] = useState<Map<string, string[]>>(new Map());
  const [loadingContextForBookId, setLoadingContextForBookId] = useState<string | null>(null);
  const [didYouKnow, setDidYouKnow] = useState<Map<string, DidYouKnowItem[]>>(new Map());
  const [loadingDidYouKnowForBookId, setLoadingDidYouKnowForBookId] = useState<string | null>(null);
  const [loadingPodcastsForBookId, setLoadingPodcastsForBookId] = useState<string | null>(null);
  const [loadingAnalysisForBookId, setLoadingAnalysisForBookId] = useState<string | null>(null);
  const [analysisArticles, setAnalysisArticles] = useState<Map<string, AnalysisArticle[]>>(new Map());
  const [loadingVideosForBookId, setLoadingVideosForBookId] = useState<string | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<Map<string, YouTubeVideo[]>>(new Map());
  const [loadingRelatedForBookId, setLoadingRelatedForBookId] = useState<string | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Map<string, RelatedBook[]>>(new Map());
  const [loadingResearchForBookId, setLoadingResearchForBookId] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<Map<string, BookResearch>>(new Map());
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<string>('trivia'); // 'trivia' or pillar names from research
  const [isInsightCategoryDropdownOpen, setIsInsightCategoryDropdownOpen] = useState(false);
  // Book infographic state
  const [bookInfographics, setBookInfographics] = useState<Map<string, BookInfographic>>(new Map());
  const [loadingInfographicForBookId, setLoadingInfographicForBookId] = useState<string | null>(null);
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicSection, setInfographicSection] = useState<'characters' | 'timeline'>('characters');
  const [isInfographicDropdownOpen, setIsInfographicDropdownOpen] = useState(false);
  const bookshelfGroupingDropdownRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Scroll to top when status bar area is tapped (iOS pattern)
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // Helper function to get last page from localStorage
  const getLastPageState = (): { showBookshelf: boolean; showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean } => {
    if (typeof window === 'undefined') {
      return { showBookshelf: false, showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
    }
    try {
      const saved = localStorage.getItem('lastPageState');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          showBookshelf: parsed.showBookshelf === true,
          showBookshelfCovers: parsed.showBookshelfCovers === true,
          showNotesView: parsed.showNotesView === true,
          showAccountPage: parsed.showAccountPage === true,
          showFollowingPage: parsed.showFollowingPage === true,
          showFeedPage: parsed.showFeedPage === true,
        };
      }
    } catch (err) {
      console.error('[getLastPageState] Error reading from localStorage:', err);
    }
    return { showBookshelf: false, showBookshelfCovers: false, showNotesView: false, showAccountPage: false, showFollowingPage: false, showFeedPage: false };
  };

  // Helper function to save current page state to localStorage
  const savePageState = (state: { showBookshelf: boolean; showBookshelfCovers: boolean; showNotesView: boolean; showAccountPage: boolean; showFollowingPage: boolean; showFeedPage: boolean }) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('lastPageState', JSON.stringify(state));
    } catch (err) {
      console.error('[savePageState] Error saving to localStorage:', err);
    }
  };

  // Initialize page states from localStorage
  const [showAccountPage, setShowAccountPage] = useState(() => getLastPageState().showAccountPage);
  const [grokUsageLogs, setGrokUsageLogs] = useState<GrokUsageLog[]>([]);
  const [isLoadingGrokLogs, setIsLoadingGrokLogs] = useState(false);
  const [isProfilePublic, setIsProfilePublic] = useState(true);
  const [isLoadingPrivacySetting, setIsLoadingPrivacySetting] = useState(false);
  const [isSavingPrivacySetting, setIsSavingPrivacySetting] = useState(false);
  const [showBookshelf, setShowBookshelf] = useState(() => getLastPageState().showBookshelf);
  const [showBookshelfCovers, setShowBookshelfCovers] = useState(() => getLastPageState().showBookshelfCovers);
  const [showNotesView, setShowNotesView] = useState(() => getLastPageState().showNotesView);
  const [showFollowingPage, setShowFollowingPage] = useState(() => getLastPageState().showFollowingPage);
  const [showFeedPage, setShowFeedPage] = useState(() => getLastPageState().showFeedPage);
  const [showAboutScreen, setShowAboutScreen] = useState(false);
  const [aboutPageIndex, setAboutPageIndex] = useState(0);
  const [aboutSwipeDirection, setAboutSwipeDirection] = useState<'forward' | 'backward'>('forward');
  const [aboutTouchStart, setAboutTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [aboutTouchEnd, setAboutTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [feedView, setFeedView] = useState<'following' | 'community'>('following');
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [personalizedFeedItems, setPersonalizedFeedItems] = useState<PersonalizedFeedItem[]>([]);
  const [isLoadingPersonalizedFeed, setIsLoadingPersonalizedFeed] = useState(false);
  const [feedDisplayCount, setFeedDisplayCount] = useState(8);
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread'>('all');
  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | 'fact' | 'context' | 'drilldown' | 'influence' | 'podcast' | 'article' | 'related_book' | 'video' | 'friend_book' | 'did_you_know'>('all');
  const [isFeedTypeDropdownOpen, setIsFeedTypeDropdownOpen] = useState(false);
  const feedTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);
  const [feedPlayingAudioUrl, setFeedPlayingAudioUrl] = useState<string | null>(null);
  const feedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [feedPlayingVideoId, setFeedPlayingVideoId] = useState<string | null>(null);
  const [expandedFeedDescriptions, setExpandedFeedDescriptions] = useState<Set<string>>(new Set());
  const [feedPodcastExpandedMap, setFeedPodcastExpandedMap] = useState<Map<string, boolean>>(new Map());
  const [didYouKnowNoteIndex, setDidYouKnowNoteIndex] = useState<Map<string, number>>(new Map());
  const [followingUsers, setFollowingUsers] = useState<Array<{ id: string; full_name: string | null; avatar_url: string | null; email: string; followed_at: string }>>([]);

  // Book discussion state
  const [showBookDiscussion, setShowBookDiscussion] = useState(false);
  const [discussionQuestions, setDiscussionQuestions] = useState<DiscussionQuestion[]>([]);
  const [isLoadingDiscussionQuestions, setIsLoadingDiscussionQuestions] = useState(false);

  // Telegram discussion topic state
  interface TelegramTopic {
    topicId: number;
    inviteLink: string;
  }
  const [telegramTopics, setTelegramTopics] = useState<Map<string, TelegramTopic>>(new Map());
  const [isLoadingTelegramTopic, setIsLoadingTelegramTopic] = useState(false);

  // Reading book picker state (for empty Reading group)
  const [showReadingBookPicker, setShowReadingBookPicker] = useState(false);

  // Book readers state (users who have the same book)
  interface BookReader {
    id: string;
    name: string;
    avatar: string | null;
    isFollowing: boolean;
  }
  const [bookReaders, setBookReaders] = useState<BookReader[]>([]);
  const [isLoadingBookReaders, setIsLoadingBookReaders] = useState(false);

  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [followingSortOrder, setFollowingSortOrder] = useState<'recent_desc' | 'recent_asc' | 'name_desc' | 'name_asc'>('recent_desc');
  const [editingNoteBookId, setEditingNoteBookId] = useState<string | null>(null);
  const [bookshelfGrouping, setBookshelfGrouping] = useState<'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bookshelfGrouping');
      const validOptions: ('reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year')[] = ['reading_status', 'added', 'rating', 'title', 'author', 'genre', 'publication_year'];
      return (validOptions.includes(saved as any) ? saved : 'reading_status') as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year';
    }
    return 'reading_status';
  });
  const [isBookshelfGroupingDropdownOpen, setIsBookshelfGroupingDropdownOpen] = useState(false);
  const [backgroundGradient, setBackgroundGradient] = useState<string>('241,245,249,226,232,240'); // Default slate colors as RGB
  const [previousGradient, setPreviousGradient] = useState<string | null>(null);
  const [isGradientTransitioning, setIsGradientTransitioning] = useState(false);
  
  // Game state
  const [isPlayingGame, setIsPlayingGame] = useState(false);
  const [gameBook1, setGameBook1] = useState<BookWithRatings | null>(null);
  const [gameBook2, setGameBook2] = useState<BookWithRatings | null>(null);
  const [gameShownBooks, setGameShownBooks] = useState<Set<string>>(new Set());
  const [gameRound, setGameRound] = useState(0);
  const [showSortingResults, setShowSortingResults] = useState(false);
  const [isGameCompleting, setIsGameCompleting] = useState(false);
  const [showGameResults, setShowGameResults] = useState(false);
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [resultsUpdateTrigger, setResultsUpdateTrigger] = useState(0);
  
  // Trivia Game state
  const [isPlayingTrivia, setIsPlayingTrivia] = useState(false);
  const [triviaQuestions, setTriviaQuestions] = useState<Array<{
    question: string;
    correct_answer: string;
    wrong_answers: string[];
    book_title?: string;
    book_author?: string;
  }>>([]);
  const [triviaFirstPlayTimestamp, setTriviaFirstPlayTimestamp] = useState<number | null>(null);
  const [currentTriviaQuestionIndex, setCurrentTriviaQuestionIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [selectedTriviaAnswer, setSelectedTriviaAnswer] = useState<string | null>(null);
  const [isTriviaLoading, setIsTriviaLoading] = useState(false);
  const [triviaGameComplete, setTriviaGameComplete] = useState(false);
  const [triviaSelectedAnswers, setTriviaSelectedAnswers] = useState<Map<number, string>>(new Map());
  const [isTriviaTransitioning, setIsTriviaTransitioning] = useState(false);
  const [triviaShuffledAnswers, setTriviaShuffledAnswers] = useState<string[]>([]);
  const [isTriviaReady, setIsTriviaReady] = useState(false);
  const [isTriviaMuted, setIsTriviaMuted] = useState(false);
  const [triviaAnswerFeedback, setTriviaAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [booksWithTriviaQuestions, setBooksWithTriviaQuestions] = useState<number>(0);
  const [triviaQuestionsRefreshTrigger, setTriviaQuestionsRefreshTrigger] = useState(0);
  const [nextQuestionsCountdown, setNextQuestionsCountdown] = useState<{hours: number; minutes: number; seconds: number} | null>(null);
  const triviaAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevTriviaGameCompleteRef = useRef(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState<Map<string, Set<string>>>(() => getSpoilerRevealedFromStorage());
  
  // Merge Sort Implementation - O(n log n) comparisons
  // Uses a queue-based state machine to track merge operations
  
  type MergeSortState = {
    comparisonQueue: Array<{ leftId: string; rightId: string }>; // Pending comparisons
    sortedLists: Array<string[]>; // Current sorted sublists (by book ID)
    comparedCount: number; // Number of comparisons made
  };
  
  // Get merge sort state from localStorage
  const getMergeSortState = (): MergeSortState | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('bookMergeSortState');
      if (!stored) return null;
      return JSON.parse(stored) as MergeSortState;
    } catch {
      return null;
    }
  };
  
  // Save merge sort state to localStorage
  const saveMergeSortState = (state: MergeSortState) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bookMergeSortState', JSON.stringify(state));
    } catch (err) {
      console.warn('[saveMergeSortState] Failed to save:', err);
    }
  };
  
  // Initialize merge sort state from books
  const initializeMergeSort = (availableBooks: BookWithRatings[]): MergeSortState => {
    // Start with individual books as sorted lists of size 1
    const sortedLists: string[][] = availableBooks.map(b => [b.id]);
    return {
      comparisonQueue: [],
      sortedLists,
      comparedCount: 0
    };
  };
  
  // Generate next comparison in merge sort (builds comparison queue)
  const getNextMergeComparison = (state: MergeSortState): { leftId: string; rightId: string } | null => {
    // Find the first pair of lists that can be merged
    for (let i = 0; i < state.sortedLists.length - 1; i += 2) {
      const leftList = state.sortedLists[i];
      const rightList = state.sortedLists[i + 1];
      
      if (!leftList || !rightList) continue;
      
      // Get the next comparison for merging these two lists
      // We track which indices we're at in the merge via the comparison queue
      // For simplicity, we'll rebuild the queue each time
      
      // Find the first uncompared pair between these lists
      // This happens during merge: compare heads of both lists
      for (const leftId of leftList) {
        for (const rightId of rightList) {
          // Check if we've already decided the order
          // We can infer this from the sorted structure, but for now
          // we'll add all cross-list comparisons to the queue
          const exists = state.comparisonQueue.find(c => 
            (c.leftId === leftId && c.rightId === rightId) ||
            (c.leftId === rightId && c.rightId === leftId)
          );
          if (!exists) {
            return { leftId, rightId };
          }
        }
      }
    }
    
    return null;
  };
  
  // Record a comparison and advance merge sort state
  const recordMergeComparison = (winnerId: string, loserId: string, currentState: MergeSortState): MergeSortState => {
    // Remove this comparison from queue
    const updatedQueue = currentState.comparisonQueue.filter(c => 
      !((c.leftId === winnerId && c.rightId === loserId) ||
        (c.leftId === loserId && c.rightId === winnerId))
    );
    
    // Update sorted lists based on the comparison
    // This is simplified - we'd need to track merge positions more carefully
    // For now, we'll use a simpler approach: maintain a full comparison queue
    
    return {
      ...currentState,
      comparisonQueue: updatedQueue,
      comparedCount: currentState.comparedCount + 1
    };
  };
  
  // Simplified: Build complete comparison queue for merge sort
  // This generates all comparisons needed for merge sort
  const buildMergeSortQueue = (availableBooks: BookWithRatings[]): Array<{ leftId: string; rightId: string }> => {
    const queue: Array<{ leftId: string; rightId: string }> = [];
    const books = availableBooks.map(b => b.id);
    
    // Merge sort comparison pattern: we need to merge adjacent pairs
    // For simplicity, we'll generate comparisons level by level
    
    // Start with individual lists
    let currentLists: string[][] = books.map(id => [id]);
    
    // While we have more than one list
    while (currentLists.length > 1) {
      const nextLists: string[][] = [];
      
      // Process pairs of lists
      for (let i = 0; i < currentLists.length; i += 2) {
        const left = currentLists[i];
        const right = currentLists[i + 1];
        
        if (!right) {
          // Odd one out, move to next level
          nextLists.push(left);
          continue;
        }
        
        // Generate comparisons needed to merge left and right
        // During merge, we compare heads of lists
        // For now, we'll generate all necessary comparisons
        let leftIdx = 0, rightIdx = 0;
        const merged: string[] = [];
        
        // Generate comparisons for merging
        while (leftIdx < left.length && rightIdx < right.length) {
          // This is the comparison we need
          queue.push({ leftId: left[leftIdx], rightId: right[rightIdx] });
          
          // We don't know the result yet, so we'll let the user decide
          // For now, we'll just track that we need this comparison
          leftIdx++;
          rightIdx++;
        }
      }
      
      if (nextLists.length === 1 && currentLists.length <= 2) {
        break; // We're done
      }
      
      currentLists = nextLists;
    }
    
    return queue;
  };
  
  // Better approach: Maintain merge state more explicitly
  type MergeOperation = {
    leftList: string[];
    rightList: string[];
    leftIdx: number;
    rightIdx: number;
    merged: string[];
  };
  
  type MergeSortStateV2 = {
    mergeStack: MergeOperation[];
    completedSortedLists: string[][]; // Track ALL completed sorted lists at current level
    comparedCount: number;
  };
  
  // Initialize merge sort with explicit merge operations
  const initializeMergeSortV2 = (availableBooks: BookWithRatings[]): MergeSortStateV2 => {
    const bookIds = availableBooks.map(b => b.id);
    console.log('[initializeMergeSortV2] 🎮 Initializing merge sort with', bookIds.length, 'books');
    
    // Create initial merge operations (adjacent pairs)
    const mergeStack: MergeOperation[] = [];
    for (let i = 0; i < bookIds.length; i += 2) {
      const left = [bookIds[i]];
      const right = bookIds[i + 1] ? [bookIds[i + 1]] : [];
      if (right.length > 0) {
        mergeStack.push({
          leftList: left,
          rightList: right,
          leftIdx: 0,
          rightIdx: 0,
          merged: []
        });
      }
    }
    
    console.log('[initializeMergeSortV2] 📊 Created', mergeStack.length, 'initial merge operations');
    
    return {
      mergeStack,
      completedSortedLists: [],
      comparedCount: 0
    };
  };
  
  // Get next comparison from current merge operation
  const getNextComparisonFromMerge = (state: MergeSortStateV2): { leftId: string; rightId: string } | null => {
    console.log('[getNextComparisonFromMerge] 🔍 State:', {
      mergeStackLength: state.mergeStack.length,
      completedSortedListsCount: state.completedSortedLists?.length || 0,
      completedSortedLists: state.completedSortedLists || [],
      comparedCount: state.comparedCount
    });
    
    if (state.mergeStack.length === 0) {
      console.log('[getNextComparisonFromMerge] ✅ Merge stack empty - sorting complete');
      return null; // Sorting complete
    }
    
    const currentMerge = state.mergeStack[0];
    console.log('[getNextComparisonFromMerge] 📋 Current merge:', {
      leftListLength: currentMerge.leftList.length,
      rightListLength: currentMerge.rightList.length,
      leftIdx: currentMerge.leftIdx,
      rightIdx: currentMerge.rightIdx,
      mergedLength: currentMerge.merged.length
    });
    
    if (currentMerge.leftIdx >= currentMerge.leftList.length) {
      // Left list exhausted, merge remaining right
      console.log('[getNextComparisonFromMerge] ⚠️ Left list exhausted');
      return null; // Should advance merge
    }
    if (currentMerge.rightIdx >= currentMerge.rightList.length) {
      // Right list exhausted, merge remaining left
      console.log('[getNextComparisonFromMerge] ⚠️ Right list exhausted');
      return null; // Should advance merge
    }
    
    const comparison = {
      leftId: currentMerge.leftList[currentMerge.leftIdx],
      rightId: currentMerge.rightList[currentMerge.rightIdx]
    };
    console.log('[getNextComparisonFromMerge] ✅ Next comparison:', comparison);
    return comparison;
  };
  
  // Record comparison and advance merge
  const recordMergeComparisonV2 = (
    winnerId: string, 
    loserId: string, 
    state: MergeSortStateV2
  ): MergeSortStateV2 => {
    console.log('[recordMergeComparisonV2] 🎯 Recording:', { winnerId, loserId, mergeStackLength: state.mergeStack.length });
    
    // Ensure completedSortedLists is always defined
    const safeState = {
      ...state,
      completedSortedLists: state.completedSortedLists || []
    };
    
    if (safeState.mergeStack.length === 0) {
      console.warn('[recordMergeComparisonV2] ⚠️ Merge stack empty, nothing to record');
      return safeState;
    }
    
    const [currentMerge, ...restStack] = safeState.mergeStack;
    console.log('[recordMergeComparisonV2] 📊 Current merge state:', {
      leftList: currentMerge.leftList,
      rightList: currentMerge.rightList,
      leftIdx: currentMerge.leftIdx,
      rightIdx: currentMerge.rightIdx,
      merged: currentMerge.merged,
      restStackLength: restStack.length
    });
    
    // Determine which list the winner came from
    const winnerFromLeft = currentMerge.leftList[currentMerge.leftIdx] === winnerId;
    
    // Add winner to merged list
    const newMerged = [...currentMerge.merged, winnerId];
    
    // Advance the appropriate index
    let newLeftIdx = currentMerge.leftIdx;
    let newRightIdx = currentMerge.rightIdx;
    
    if (winnerFromLeft) {
      newLeftIdx++;
    } else {
      newRightIdx++;
    }
    
    // Check if merge is complete
    const leftDone = newLeftIdx >= currentMerge.leftList.length;
    const rightDone = newRightIdx >= currentMerge.rightList.length;
    
    if (leftDone || rightDone) {
      // One list exhausted, add remaining from the other
      const finalMerged = [
        ...newMerged,
        ...(leftDone ? [] : currentMerge.leftList.slice(newLeftIdx)),
        ...(rightDone ? [] : currentMerge.rightList.slice(newRightIdx))
      ];
      
      console.log('[recordMergeComparisonV2] ✅ Merge complete! Final merged:', finalMerged);
      console.log('[recordMergeComparisonV2] 📊 Completed lists so far:', safeState.completedSortedLists);
      console.log('[recordMergeComparisonV2] 📊 Remaining merges in stack:', restStack.length);
      
      // Add this completed merge to the list of completed sorted lists
      const updatedCompletedLists = [...safeState.completedSortedLists, finalMerged];
      
      // If we have incomplete merges in restStack, we need to continue them
      // Only when all merges at the current level are done, we create the next level
      if (restStack.length === 0) {
        // All merges at this level are complete - create next level merges
        console.log('[recordMergeComparisonV2] 🎉 All merges at this level complete! Creating next level...');
        console.log('[recordMergeComparisonV2] 📋 All completed lists:', updatedCompletedLists);
        
        const newMergeStack: MergeOperation[] = [];
        for (let i = 0; i < updatedCompletedLists.length; i += 2) {
          const left = updatedCompletedLists[i];
          const right = updatedCompletedLists[i + 1];
          if (left && right) {
            newMergeStack.push({
              leftList: left,
              rightList: right,
              leftIdx: 0,
              rightIdx: 0,
              merged: []
            });
          }
        }
        
        console.log('[recordMergeComparisonV2] 📊 Created', newMergeStack.length, 'new merge operations for next level');
        
        // If only one list remains, that's our final sorted list (keep it in completedSortedLists)
        // Otherwise, clear completed lists and start new level
        return {
          ...safeState,
          mergeStack: newMergeStack,
          completedSortedLists: updatedCompletedLists.length === 1 ? updatedCompletedLists : [],
          comparedCount: safeState.comparedCount + 1
        };
      } else {
        // Still have incomplete merges - keep track of all completed merges
        console.log('[recordMergeComparisonV2] ⏸️ Merge complete but', restStack.length, 'merges remaining');
        
        return {
          ...safeState,
          mergeStack: restStack,
          completedSortedLists: updatedCompletedLists, // Store ALL completed merges
          comparedCount: safeState.comparedCount + 1
        };
      }
    }
    
    // Continue current merge
    const updatedMerge: MergeOperation = {
      ...currentMerge,
      leftIdx: newLeftIdx,
      rightIdx: newRightIdx,
      merged: newMerged
    };
    
    return {
      ...safeState,
      mergeStack: [updatedMerge, ...restStack],
      comparedCount: safeState.comparedCount + 1
    };
  };
  
  // Simplified wrapper functions for the game
  const getMergeSortStateFromStorage = (): MergeSortStateV2 | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('bookMergeSortState');
      if (!stored) return null;
      const parsed = JSON.parse(stored) as any;
      
      // Migrate old state format (sortedBooks) to new format (completedSortedLists)
      if (parsed.sortedBooks && !parsed.completedSortedLists) {
        console.log('[getMergeSortStateFromStorage] 🔄 Migrating old state format...');
        return {
          mergeStack: parsed.mergeStack || [],
          completedSortedLists: parsed.sortedBooks && parsed.sortedBooks.length > 0 
            ? [parsed.sortedBooks] 
            : [],
          comparedCount: parsed.comparedCount || 0
        };
      }
      
      // Ensure completedSortedLists exists (handle undefined/null)
      if (!parsed.completedSortedLists) {
        parsed.completedSortedLists = [];
      }
      
      return parsed as MergeSortStateV2;
    } catch {
      return null;
    }
  };
  
  const saveMergeSortStateToStorage = (state: MergeSortStateV2) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('bookMergeSortState', JSON.stringify(state));
    } catch (err) {
      console.warn('[saveMergeSortStateToStorage] Failed to save:', err);
    }
  };
  
  // Efficiently add a new book to the merge sort game state
  const addBookToMergeSortState = (bookId: string) => {
    console.log('[addBookToMergeSortState] 📚 Adding book to merge sort state:', bookId);
    
    const state = getMergeSortStateFromStorage();
    
    // If no state exists, don't create one - it will be initialized when game starts
    if (!state) {
      console.log('[addBookToMergeSortState] ℹ️ No merge sort state found - will be initialized when game starts');
      return;
    }
    
    // Check if book already exists in any list
    const bookExists = 
      state.mergeStack.some(op => 
        op.leftList.includes(bookId) || 
        op.rightList.includes(bookId) || 
        op.merged.includes(bookId)
      ) ||
      (state.completedSortedLists || []).some(list => list.includes(bookId));
    
    if (bookExists) {
      console.log('[addBookToMergeSortState] ℹ️ Book already in merge sort state');
      return;
    }
    
    // If game is complete (only 1 list and empty stack), add book as singleton
    // It will be naturally included in future games
    if (state.mergeStack.length === 0 && state.completedSortedLists?.length === 1) {
      console.log('[addBookToMergeSortState] ✅ Game complete - adding book as singleton for future merges');
      const updatedState = {
        ...state,
        completedSortedLists: [...(state.completedSortedLists || []), [bookId]]
      };
      saveMergeSortStateToStorage(updatedState);
      return;
    }
    
    // If game is in progress, add book as singleton to completedSortedLists
    // This is the most efficient - it will naturally merge at the current level
    // If all merges at current level are done, it will be included in the next level
    console.log('[addBookToMergeSortState] ✅ Adding book as singleton to completedSortedLists');
    const updatedState = {
      ...state,
      completedSortedLists: [...(state.completedSortedLists || []), [bookId]]
    };
    saveMergeSortStateToStorage(updatedState);
  };
  
  // Clean merge sort state by removing book IDs that no longer exist
  const cleanMergeSortState = (state: MergeSortStateV2, availableBookIds: Set<string>): MergeSortStateV2 => {
    // Filter merge stack operations
    const cleanedMergeStack = state.mergeStack
      .map(op => ({
        ...op,
        leftList: op.leftList.filter(id => availableBookIds.has(id)),
        rightList: op.rightList.filter(id => availableBookIds.has(id)),
        merged: op.merged.filter(id => availableBookIds.has(id))
      }))
      .filter(op => op.leftList.length > 0 && op.rightList.length > 0); // Remove operations with empty lists
    
    // Filter completed sorted lists
    const cleanedCompletedLists = (state.completedSortedLists || [])
      .map(list => list.filter(id => availableBookIds.has(id)))
      .filter(list => list.length > 0); // Remove empty lists
    
    return {
      ...state,
      mergeStack: cleanedMergeStack,
      completedSortedLists: cleanedCompletedLists
    };
  };

  // Get next pair to compare (merge sort approach)
  const getNextMergePair = (availableBooks: BookWithRatings[]): [BookWithRatings, BookWithRatings] | null => {
    let state = getMergeSortStateFromStorage();
    
    // Create set of available book IDs for quick lookup
    const availableBookIds = new Set(availableBooks.map(b => b.id));
    
    // Initialize if needed
    if (!state) {
      console.log('[getNextMergePair] 🎮 No state found, initializing...');
      state = initializeMergeSortV2(availableBooks);
      saveMergeSortStateToStorage(state);
    } else {
      // Clean state to remove any book IDs that no longer exist
      const cleanedState = cleanMergeSortState(state, availableBookIds);
      if (JSON.stringify(cleanedState) !== JSON.stringify(state)) {
        console.log('[getNextMergePair] 🧹 Cleaned merge sort state - removed missing books');
        state = cleanedState;
        saveMergeSortStateToStorage(state);
      }
    }
    
    // If mergeStack is empty but we have multiple completed lists, create new merge operations
    if (state.mergeStack.length === 0 && (state.completedSortedLists || []).length > 1) {
      console.log('[getNextMergePair] 🔄 Merge stack empty but multiple completed lists found, creating new merge operations...');
      const completedLists = state.completedSortedLists || [];
      const newMergeStack: MergeOperation[] = [];
      
      // Create merge operations from pairs of completed lists
      for (let i = 0; i < completedLists.length; i += 2) {
        const left = completedLists[i];
        const right = completedLists[i + 1];
        if (left && right && left.length > 0 && right.length > 0) {
          newMergeStack.push({
            leftList: left,
            rightList: right,
            leftIdx: 0,
            rightIdx: 0,
            merged: []
          });
        }
      }
      
      // If there's an odd list left (no pair), keep it in completedSortedLists for next level
      const hasOddList = completedLists.length % 2 === 1;
      const remainingCompletedList = hasOddList && completedLists[completedLists.length - 1].length > 0 
        ? [completedLists[completedLists.length - 1]] 
        : [];
      
      console.log('[getNextMergePair] 📊 Created', newMergeStack.length, 'new merge operations', hasOddList ? '(1 list left unpaired)' : '');
      
      // Update state with new merge stack
      state = {
        ...state,
        mergeStack: newMergeStack,
        completedSortedLists: remainingCompletedList
      };
      saveMergeSortStateToStorage(state);
    }
    
    let comparison = getNextComparisonFromMerge(state);
    
    if (!comparison) {
      // Don't log when checking button state - only log when actually playing
      return null; // Sorting complete or needs state update
    }
    
    const book1 = availableBooks.find(b => b.id === comparison.leftId);
    const book2 = availableBooks.find(b => b.id === comparison.rightId);
    
    if (!book1 || !book2) {
      // Books not found - clean state and return null
      console.warn('[getNextMergePair] ⚠️ Books not found, cleaning state:', { leftId: comparison.leftId, rightId: comparison.rightId });
      const cleanedState = cleanMergeSortState(state, availableBookIds);
      saveMergeSortStateToStorage(cleanedState);
      return null;
    }
    
    console.log('[getNextMergePair] ✅ Returning pair:', { book1: book1.title, book2: book2.title });
    return [book1, book2];
  };
  
  // Update comparison results when a book is manually moved in the results list
  const updateComparisonResultsForManualMove = (movedBookId: string, newIndex: number, sortedBooks: BookWithRatings[]) => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('bookComparisonResults');
      const results: { [key: string]: { beats: string[]; losesTo: string[] } } = stored ? JSON.parse(stored) : {};
      
      // Ensure the moved book has an entry
      if (!results[movedBookId]) {
        results[movedBookId] = { beats: [], losesTo: [] };
      }
      
      // Update comparisons: the moved book beats all books below it (higher index)
      // and loses to all books above it (lower index)
      sortedBooks.forEach((book, index) => {
        if (book.id === movedBookId) return; // Skip the moved book itself
        
        // Ensure this book has an entry
        if (!results[book.id]) {
          results[book.id] = { beats: [], losesTo: [] };
        }
        
        if (index < newIndex) {
          // Book is above the moved book - moved book loses to it
          if (!results[movedBookId].losesTo.includes(book.id)) {
            results[movedBookId].losesTo.push(book.id);
          }
          if (!results[book.id].beats.includes(movedBookId)) {
            results[book.id].beats.push(movedBookId);
          }
        } else if (index > newIndex) {
          // Book is below the moved book - moved book beats it
          if (!results[movedBookId].beats.includes(book.id)) {
            results[movedBookId].beats.push(book.id);
          }
          if (!results[book.id].losesTo.includes(movedBookId)) {
            results[book.id].losesTo.push(movedBookId);
          }
        }
      });
      
      localStorage.setItem('bookComparisonResults', JSON.stringify(results));
      console.log('[updateComparisonResultsForManualMove] ✅ Updated comparison results for manual move');
    } catch (err) {
      console.warn('[updateComparisonResultsForManualMove] Failed to update comparison results:', err);
    }
  };

  // Record comparison (merge sort approach)
  const recordMergeComparisonForGame = (winnerId: string, loserId: string, availableBooks: BookWithRatings[]) => {
    console.log('[recordMergeComparisonForGame] 🎮 Recording game comparison:', { winnerId, loserId });
    
    let state = getMergeSortStateFromStorage();
    
    if (!state) {
      console.log('[recordMergeComparisonForGame] 🎮 No state found, initializing...');
      state = initializeMergeSortV2(availableBooks);
    }
    
    // Store comparison result for sorting
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bookComparisonResults');
        const results: { [key: string]: { beats: string[]; losesTo: string[] } } = stored ? JSON.parse(stored) : {};
        
        if (!results[winnerId]) results[winnerId] = { beats: [], losesTo: [] };
        if (!results[loserId]) results[loserId] = { beats: [], losesTo: [] };
        
        if (!results[winnerId].beats.includes(loserId)) {
          results[winnerId].beats.push(loserId);
        }
        if (!results[loserId].losesTo.includes(winnerId)) {
          results[loserId].losesTo.push(winnerId);
        }
        
        localStorage.setItem('bookComparisonResults', JSON.stringify(results));
      } catch (err) {
        console.warn('[recordMergeComparisonForGame] Failed to save comparison result:', err);
      }
    }
    
    const newState = recordMergeComparisonV2(winnerId, loserId, state);
    console.log('[recordMergeComparisonForGame] 💾 Saving new state:', {
      mergeStackLength: newState.mergeStack.length,
      completedSortedListsLength: newState.completedSortedLists?.length || 0,
      comparedCount: newState.comparedCount
    });
    saveMergeSortStateToStorage(newState);
  };
  
  // Get comparison results from localStorage
  const getComparisonResultsFromState = (): { [bookId: string]: { beats: Set<string>; losesTo: Set<string> } } => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('bookComparisonResults');
      if (!stored) return {};
      const parsed = JSON.parse(stored) as { [key: string]: { beats: string[]; losesTo: string[] } };
      // Convert arrays back to Sets
      const results: { [bookId: string]: { beats: Set<string>; losesTo: Set<string> } } = {};
      for (const [bookId, data] of Object.entries(parsed)) {
        results[bookId] = {
          beats: new Set(data.beats || []),
          losesTo: new Set(data.losesTo || [])
        };
      }
      return results;
    } catch {
      return {};
    }
  };
  
  // Get sorted books based on comparison results
  const getSortedBooks = (availableBooks: BookWithRatings[]): BookWithRatings[] => {
    // Get comparison results from localStorage
    const comparisonResults = getComparisonResultsFromState();
    
    // Calculate win/loss scores for each book
    const scores: { [bookId: string]: number } = {};
    availableBooks.forEach(book => {
      scores[book.id] = 0;
    });
    
    // Count wins (books this book beats)
    Object.entries(comparisonResults).forEach(([bookId, data]) => {
      scores[bookId] = (scores[bookId] || 0) + data.beats.size;
    });
    
    // Sort by score (descending) - books with more wins rank higher
    const sorted = [...availableBooks].sort((a, b) => {
      const scoreA = scores[a.id] || 0;
      const scoreB = scores[b.id] || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA; // Higher score first
      }
      // If scores are equal, use comparison results to break ties
      const aBeatsB = comparisonResults[a.id]?.beats.has(b.id);
      const bBeatsA = comparisonResults[b.id]?.beats.has(a.id);
      if (aBeatsB) return -1;
      if (bBeatsA) return 1;
      return 0;
    });
    
    return sorted;
  };
  
  // Get total comparisons needed (for progress)
  const getTotalMergeComparisons = (n: number): number => {
    // Merge sort requires approximately n * log2(n) comparisons
    return Math.ceil(n * Math.log2(n));
  };
  
  // Get current comparison count
  const getCurrentComparisonCount = (): number => {
    const state = getMergeSortStateFromStorage();
    return state?.comparedCount || 0;
  };

  // Check if there are unranked books (books without comparison results)
  const hasUnrankedBooks = (availableBooks: BookWithRatings[]): boolean => {
    const comparisonResults = getComparisonResultsFromState();
    const rankedBookIds = new Set(Object.keys(comparisonResults));
    
    // A book is ranked if it has at least one comparison (beats or losesTo)
    for (const book of availableBooks) {
      const hasComparisons = 
        comparisonResults[book.id] && 
        (comparisonResults[book.id].beats.size > 0 || comparisonResults[book.id].losesTo.size > 0);
      
      if (!hasComparisons) {
        return true; // Found an unranked book
      }
    }
    
    return false; // All books are ranked
  };
  // Podcast source selector removed - now always fetches from both sources

  // Load spoiler status from cross-platform storage on native (runs once on mount)
  useEffect(() => {
    if (isNativePlatform) {
      loadSpoilerRevealedFromStorage().then(loaded => {
        if (loaded.size > 0) {
          setSpoilerRevealed(loaded);
        }
      });
    }
  }, []);

  // Persist spoiler revealed status to storage
  useEffect(() => {
    saveSpoilerRevealedToStorage(spoilerRevealed);
  }, [spoilerRevealed]);

  // Detect screenshot mode from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isScreenshot = params.get('screenshot') === '1';
      const overlayText = params.get('text');
      console.log('[Screenshot Mode] Checking URL params:', { isScreenshot, overlayText, search: window.location.search });
      if (isScreenshot) {
        setScreenshotMode(true);
        // Also mark intro as seen to prevent about screen from showing
        localStorage.setItem('hasSeenIntro', 'true');
        if (overlayText) {
          setScreenshotOverlayText(decodeURIComponent(overlayText));
        }
      }
    }
  }, []);

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

        // Fetch my following count
        const { count: followingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id);
        setMyFollowingCount(followingCount || 0);

        // Restore saved selectedIndex if valid, otherwise reset to 0
        if (appBooks.length > 0) {
          if (typeof window !== 'undefined') {
            const savedIndex = localStorage.getItem('lastSelectedBookIndex');
            const parsedIndex = savedIndex ? parseInt(savedIndex, 10) : null;
            if (parsedIndex !== null && !isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < appBooks.length) {
              setSelectedIndex(parsedIndex);
            } else {
              // If saved index is invalid or out of bounds, reset to 0
              setSelectedIndex(0);
            }
          } else {
            // Server-side: ensure index is valid
            if (selectedIndex >= appBooks.length) {
              setSelectedIndex(0);
            }
          }
        } else {
          // No books, reset to 0
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

  // Load another user's books when viewingUserId changes
  useEffect(() => {
    if (!viewingUserId || !user) {
      setViewingUserBooks([]);
      setViewingUserName('');
      setViewingUserFullName(null);
      setViewingUserAvatar(null);
      setViewingUserIsPrivate(false);
      setIsFollowingViewingUser(false);
      setViewingUserFollowingCount(0);
      return;
    }

    const userId = viewingUserId; // Store in local variable after null check
    const currentUserId = user.id; // Store user.id for async function

    setIsLoadingViewingUserBooks(true);

    async function loadUserBooks() {
      try {
        // First, get user info from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, avatar_url, is_public')
          .eq('id', userId)
          .single();

        if (!userError && userData) {
          setViewingUserFullName(userData.full_name);
          setViewingUserAvatar(userData.avatar_url);
          setViewingUserName(userData.full_name || userData.email || userId);
          setViewingUserIsPrivate(userData.is_public === false);
        } else {
          // Fallback if users table doesn't have the user
          const emailMatch = userId.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          setViewingUserName(emailMatch ? userId.split('@')[0] : userId.substring(0, 8));
          setViewingUserFullName(null);
          setViewingUserAvatar(null);
          setViewingUserIsPrivate(false);
        }

        // If the user is private, don't load their books
        if (userData?.is_public === false) {
          setViewingUserBooks([]);
          setIsLoadingViewingUserBooks(false);
          return;
        }

        // Check if current user follows this user
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)
          .single();

        setIsFollowingViewingUser(!!followData);

        // Get viewed user's following count
        const { count: viewedUserFollowingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);
        setViewingUserFollowingCount(viewedUserFollowingCount || 0);

        // Then get their books
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading user books:', error);
          setIsLoadingViewingUserBooks(false);
          return;
        }

        const appBooks = (data || []).map(convertBookToApp);
        setViewingUserBooks(appBooks);
      } catch (err) {
        console.error('Error loading user books:', err);
      } finally {
        setIsLoadingViewingUserBooks(false);
      }
    }

    loadUserBooks();
  }, [viewingUserId, user]);

  // Set default view to bookshelf covers when user has no books (first-time user)
  useEffect(() => {
    if (isLoaded && books.length === 0 && !showBookshelf && !showBookshelfCovers && !showNotesView && !showAccountPage && !showFollowingPage) {
      // First-time user: default to bookshelf covers view
      setShowBookshelfCovers(true);
      setBookshelfGrouping('reading_status'); // Ensure it's grouped by status
    }
  }, [isLoaded, books.length, showBookshelf, showBookshelfCovers, showNotesView, showAccountPage]);

  // Show intro screen for new users who haven't seen it (separate from page state)
  useEffect(() => {
    if (isLoaded && user && books.length === 0) {
      const hasSeenIntro = localStorage.getItem('hasSeenIntro');
      console.log('[Intro Debug] Checking intro:', { isLoaded, userId: user.id, booksLength: books.length, hasSeenIntro });
      if (!hasSeenIntro) {
        console.log('[Intro Debug] Showing intro screen for new user');
        setShowAboutScreen(true);
      }
    }
  }, [isLoaded, user, books.length]);

  // Save page state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      savePageState({
        showBookshelf,
        showBookshelfCovers,
        showNotesView,
        showAccountPage,
        showFollowingPage,
        showFeedPage,
      });
    }
  }, [isLoaded, showBookshelf, showBookshelfCovers, showNotesView, showAccountPage, showFollowingPage, showFeedPage]);

  // Load Grok usage logs when account page is shown
  useEffect(() => {
    if (!showAccountPage || !user) return;

    const loadGrokLogs = async () => {
      setIsLoadingGrokLogs(true);
      try {
        const logs = await getGrokUsageLogs(user.id);
        setGrokUsageLogs(logs);
      } catch (err) {
        console.error('[Account] Error loading Grok usage logs:', err);
        setGrokUsageLogs([]);
      } finally {
        setIsLoadingGrokLogs(false);
      }
    };

    loadGrokLogs();
  }, [showAccountPage, user]);

  // Load privacy setting when account page is shown
  useEffect(() => {
    if (!showAccountPage || !user) return;
    let cancelled = false;

    const loadPrivacySetting = async () => {
      setIsLoadingPrivacySetting(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_public')
          .eq('id', user.id)
          .maybeSingle();

        if (!cancelled) {
          if (!error && data && typeof data.is_public === 'boolean') {
            setIsProfilePublic(data.is_public);
          } else {
            setIsProfilePublic(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Account] Error loading privacy setting:', err);
          setIsProfilePublic(true);
        }
      } finally {
        if (!cancelled) setIsLoadingPrivacySetting(false);
      }
    };

    loadPrivacySetting();
    return () => {
      cancelled = true;
    };
  }, [showAccountPage, user]);

  // Load followed users when following page is shown
  useEffect(() => {
    if (!showFollowingPage || !user) return;

    const loadFollowingUsers = async () => {
      setIsLoadingFollowing(true);
      try {
        // Get list of users the current user is following with timestamps
        const { data: followsData, error: followsError } = await supabase
          .from('follows')
          .select('following_id, created_at')
          .eq('follower_id', user.id);

        if (followsError) {
          console.error('[Following] Error fetching follows:', followsError);
          setFollowingUsers([]);
          return;
        }

        if (!followsData || followsData.length === 0) {
          setFollowingUsers([]);
          return;
        }

        // Create a map of following_id to created_at
        const followedAtMap = new Map(followsData.map(f => [f.following_id, f.created_at]));

        // Get user details for each followed user
        const followingIds = followsData.map(f => f.following_id);
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, email')
          .in('id', followingIds);

        if (usersError) {
          console.error('[Following] Error fetching user details:', usersError);
          setFollowingUsers([]);
          return;
        }

        // Merge user data with followed_at timestamp
        const usersWithFollowedAt = (usersData || []).map(u => ({
          ...u,
          followed_at: followedAtMap.get(u.id) || new Date().toISOString(),
        }));

        setFollowingUsers(usersWithFollowedAt);
      } catch (err) {
        console.error('[Following] Error loading following users:', err);
        setFollowingUsers([]);
      } finally {
        setIsLoadingFollowing(false);
      }
    };

    loadFollowingUsers();
  }, [showFollowingPage, user]);

  // Update count of books with trivia questions
  useEffect(() => {
    const refreshCount = () => {
      if (isLoaded && user) {
        countBooksWithTriviaQuestions().then(count => {
          setBooksWithTriviaQuestions(count);
        }).catch(err => {
          console.error('[App] Error counting books with trivia questions:', err);
        });
      }
    };
    
    // Set the global callback so saveTriviaQuestionsToCache can trigger refresh
    setTriviaQuestionsCountRefreshCallback(refreshCount);
    
    // Initial load
    refreshCount();
    
    // Cleanup
    return () => {
      setTriviaQuestionsCountRefreshCallback(null);
    };
  }, [isLoaded, user, books.length, triviaQuestionsRefreshTrigger]); // Update when books change or refresh is triggered

  // Fire confetti when trivia game completes
  useEffect(() => {
    // Only fire confetti when game transitions from incomplete to complete
    if (triviaGameComplete && !prevTriviaGameCompleteRef.current) {
      // Play confetti sound
      const confettiSound = new Audio(getAssetPath('/confetti-pop-sound.mp3'));
      confettiSound.volume = 0.5; // Set volume to 50%
      confettiSound.play().catch(err => {
        console.warn('Failed to play confetti sound:', err);
      });

      // Check if confetti is available
      if (typeof window !== 'undefined' && (window as any).confetti) {
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
        };

        function fire(particleRatio: number, opts: any) {
          (window as any).confetti(
            Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio),
            })
          );
        }

        fire(0.25, {
          spread: 26,
          startVelocity: 55,
        });

        fire(0.2, {
          spread: 60,
        });

        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
        });

        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
        });

        fire(0.1, {
          spread: 120,
          startVelocity: 45,
        });
      }
    }
    
    // Update ref to track previous state
    prevTriviaGameCompleteRef.current = triviaGameComplete;
  }, [triviaGameComplete]);

  // Load trivia first play timestamp from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('triviaFirstPlayTimestamp');
      if (saved) {
        const timestamp = parseInt(saved, 10);
        if (!isNaN(timestamp)) {
          setTriviaFirstPlayTimestamp(timestamp);
        }
      }
    } catch (err) {
      console.warn('[Trivia Timer] Error loading timestamp from localStorage:', err);
    }
  }, []);

  // Calculate countdown to next batch of questions (24 hours)
  useEffect(() => {
    if (!triviaFirstPlayTimestamp) {
      setNextQuestionsCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const timeUntilNext = (triviaFirstPlayTimestamp! + twentyFourHours) - now;

      if (timeUntilNext <= 0) {
        // 24 hours expired - reset timestamp to now to start new period
        const newTimestamp = Date.now();
        setTriviaFirstPlayTimestamp(newTimestamp);
        try {
          localStorage.setItem('triviaFirstPlayTimestamp', newTimestamp.toString());
        } catch (err) {
          console.warn('[Trivia Timer] Error saving timestamp to localStorage:', err);
        }
        // Update countdown for new period
        const newTimeUntilNext = twentyFourHours;
        const hours = Math.floor(newTimeUntilNext / (60 * 60 * 1000));
        const minutes = Math.floor((newTimeUntilNext % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((newTimeUntilNext % (60 * 1000)) / 1000);
        setNextQuestionsCountdown({ hours, minutes, seconds });
      } else {
        const hours = Math.floor(timeUntilNext / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntilNext % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeUntilNext % (60 * 1000)) / 1000);
        
        setNextQuestionsCountdown({ hours, minutes, seconds });
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [triviaFirstPlayTimestamp]);

  // All hooks must be called before any conditional returns
  const activeBook = books[selectedIndex] || null;
  const [editingDimension, setEditingDimension] = useState<typeof RATING_DIMENSIONS[number] | null>(null);

  // Memoize filtered feed items for pagination
  const filteredFeedItems = useMemo(() => {
    let items = personalizedFeedItems;
    // Filter by read status
    if (feedFilter === 'unread') {
      items = items.filter(item => !item.read);
    }
    // Filter by type
    if (feedTypeFilter !== 'all') {
      items = items.filter(item => item.type === feedTypeFilter);
    }
    return items;
  }, [personalizedFeedItems, feedFilter, feedTypeFilter]);

  const displayedFeedItems = filteredFeedItems.slice(0, feedDisplayCount);
  const hasMoreFeedItems = feedDisplayCount < filteredFeedItems.length;

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

  const bookPageSectionsResolved = useMemo(() => {
    if (!activeBook) return true;

    const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
    const research = researchData.get(activeBook.id) || null;
    const hasResearch = !!(research && research.pillars && research.pillars.length > 0);
    const influences = bookInfluences.get(activeBook.id) || [];
    const hasInfluences = influences.length > 0;
    const domainData = bookDomain.get(activeBook.id);
    const hasDomain = !!(domainData && domainData.facts && domainData.facts.length > 0);
    const contextInsights = bookContext.get(activeBook.id) || [];
    const hasContext = contextInsights.length > 0;

    const isLoadingFacts = loadingFactsForBookId === activeBook.id && !hasFacts;
    const isLoadingResearch = loadingResearchForBookId === activeBook.id && !hasResearch;
    const isLoadingInfluences = loadingInfluencesForBookId === activeBook.id && !hasInfluences;
    const isLoadingDomain = loadingDomainForBookId === activeBook.id && !hasDomain;
    const isLoadingContext = loadingContextForBookId === activeBook.id && !hasContext;
    const isInsightsLoading = isLoadingFacts || isLoadingResearch || isLoadingInfluences || isLoadingDomain || isLoadingContext;

    const hasEpisodes = combinedPodcastEpisodes.length > 0;
    const isPodcastsLoading = loadingPodcastsForBookId === activeBook.id && !hasEpisodes;

    const videos = youtubeVideos.get(activeBook.id) || [];
    const hasVideos = videos.length > 0;
    const isVideosLoading = loadingVideosForBookId === activeBook.id && !hasVideos;

    const articles = analysisArticles.get(activeBook.id) || [];
    const hasRealArticles = articles.length > 0 && articles.some(article => {
      const isFallback = article.title?.includes('Search Google Scholar') ||
                         (article.url && article.url.includes('scholar.google.com/scholar?q='));
      return !isFallback;
    });
    const hasOnlyFallback = articles.length > 0 && !hasRealArticles;
    const hasArticles = hasRealArticles;
    const isAnalysisLoading = loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;

    const related = relatedBooks.get(activeBook.id);
    const hasData = related !== undefined;
    const isRelatedLoading = loadingRelatedForBookId === activeBook.id && !hasData;

    return !(isInsightsLoading || isPodcastsLoading || isVideosLoading || isAnalysisLoading || isRelatedLoading);
  }, [
    activeBook?.id,
    activeBook?.author_facts,
    combinedPodcastEpisodes.length,
    researchData,
    bookInfluences,
    bookDomain,
    bookContext,
    youtubeVideos,
    analysisArticles,
    relatedBooks,
    loadingFactsForBookId,
    loadingResearchForBookId,
    loadingInfluencesForBookId,
    loadingDomainForBookId,
    loadingContextForBookId,
    loadingPodcastsForBookId,
    loadingVideosForBookId,
    loadingAnalysisForBookId,
    loadingRelatedForBookId,
  ]);
  
  // Save bookshelf grouping preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookshelfGrouping', bookshelfGrouping);
    }
  }, [bookshelfGrouping]);

  // Save selected book index to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && books.length > 0 && selectedIndex >= 0 && selectedIndex < books.length) {
      localStorage.setItem('lastSelectedBookIndex', selectedIndex.toString());
    }
  }, [selectedIndex, books.length]);

  // Expose one-time feed backfill on window (run window.backfillFeed() in console)
  useEffect(() => {
    if (typeof window === 'undefined' || !user || books.length === 0) return;
    (window as any).backfillFeed = async () => {
      console.log(`[backfillFeed] Starting backfill for ${books.length} books...`);
      let totalCreated = 0;
      let totalErrors: string[] = [];
      for (let i = 0; i < books.length; i++) {
        const book = books[i];
        console.log(`[backfillFeed] (${i + 1}/${books.length}) ${book.title}...`);
        const result = await generateFeedItemsForBook(
          user.id,
          book.id,
          book.title,
          book.author || '',
          book.cover_url || null,
          book.reading_status || null,
          book.created_at
        );
        totalCreated += result.created;
        totalErrors.push(...result.errors);
      }
      console.log(`[backfillFeed] ✅ Done! Created ${totalCreated} feed items across ${books.length} books (${totalErrors.length} errors)`);
      if (totalErrors.length > 0) console.warn('[backfillFeed] Errors:', totalErrors);
      return { totalCreated, totalErrors };
    };
    return () => { delete (window as any).backfillFeed; };
  }, [user, books]);

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
  // Determine which books to use for bookshelf display
  const booksForBookshelf = viewingUserId ? viewingUserBooks : books;
  
  const groupedBooksForBookshelf = useMemo(() => {
    if (bookshelfGrouping === 'reading_status') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'Reading', books: [] },
        { label: 'Want to read', books: [] },
        { label: 'Read it', books: [] },
        { label: 'TBD', books: [] },
      ];
      
      booksForBookshelf.forEach(book => {
        const status = book.reading_status;
        if (status === 'reading') {
          groups[0].books.push(book);
        } else if (status === 'want_to_read') {
          groups[1].books.push(book);
        } else if (status === 'read_it') {
          groups[2].books.push(book);
        } else {
          // null or undefined reading_status goes to TBD
          groups[3].books.push(book);
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

      // Keep Reading group visible even when empty (only for own bookshelf and only if they have at least one book)
      return groups.filter(group => group.books.length > 0 || (group.label === 'Reading' && !viewingUserId && booksForBookshelf.length > 0));
    } else if (bookshelfGrouping === 'rating') {
      // Group by rating score ranges
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: '5 stars', books: [] },
        { label: '4 stars', books: [] },
        { label: '3 stars', books: [] },
        { label: '2 stars', books: [] },
        { label: '1 star', books: [] },
        { label: 'Unrated', books: [] },
      ];
      
      booksForBookshelf.forEach(book => {
        const score = calculateScore(book.ratings);
        
        if (score === 0) {
          groups[5].books.push(book); // Unrated
        } else if (score >= 4.5) {
          groups[0].books.push(book); // 5 stars
        } else if (score >= 3.5) {
          groups[1].books.push(book); // 4 stars
        } else if (score >= 2.5) {
          groups[2].books.push(book); // 3 stars
        } else if (score >= 1.5) {
          groups[3].books.push(book); // 2 stars
        } else {
          groups[4].books.push(book); // 1 star
        }
      });
      
      // Sort each group by rating descending (already sorted within each group by score ranges)
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const scoreA = calculateScore(a.ratings);
          const scoreB = calculateScore(b.ratings);
          return scoreB - scoreA; // Descending order
        });
      });
      
      return groups.filter(group => group.books.length > 0);
    } else if (bookshelfGrouping === 'added') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'Today', books: [] },
        { label: 'This week', books: [] },
        { label: 'This month', books: [] },
        { label: 'This year', books: [] },
        { label: 'Later', books: [] },
      ];
      
      booksForBookshelf.forEach(book => {
        const createdDate = new Date(book.created_at);
        
        if (createdDate >= todayStart) {
          groups[0].books.push(book);
        } else if (createdDate >= oneWeekAgo) {
          groups[1].books.push(book);
        } else if (createdDate >= oneMonthAgo) {
          groups[2].books.push(book);
        } else if (createdDate >= oneYearAgo) {
          groups[3].books.push(book);
        } else {
          groups[4].books.push(book);
        }
      });
      
      // Sort each group by created_at descending (newest first)
      groups.forEach(group => {
        group.books.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Descending order
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
      
      booksForBookshelf.forEach(book => {
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
    } else if (bookshelfGrouping === 'author') {
      const groups: { label: string; books: BookWithRatings[] }[] = [
        { label: 'A-D', books: [] },
        { label: 'E-H', books: [] },
        { label: 'I-M', books: [] },
        { label: 'N-S', books: [] },
        { label: 'T-Z', books: [] },
      ];
      
      booksForBookshelf.forEach(book => {
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
    } else if (bookshelfGrouping === 'genre') {
      // Group by actual genre name (case-insensitive)
      const genreMap = new Map<string, BookWithRatings[]>();
      const genreDisplayNames = new Map<string, string>(); // Store original case for display
      
      booksForBookshelf.forEach(book => {
        const genre = book.genre || 'No Genre';
        const genreLower = genre.toLowerCase();
        
        // Use lowercase as key for case-insensitive grouping
        if (!genreMap.has(genreLower)) {
          genreMap.set(genreLower, []);
          genreDisplayNames.set(genreLower, genre); // Store first occurrence's case for display
        }
        genreMap.get(genreLower)!.push(book);
      });
      
      // Convert to groups array and sort by genre name
      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(genreMap.entries())
        .map(([genreLower, books]) => ({
          label: genreDisplayNames.get(genreLower) || genreLower, // Use original case for display
          books: books.sort((a, b) => {
            // Sort books within each genre by title
          const titleA = (a.title || '').toUpperCase();
          const titleB = (b.title || '').toUpperCase();
          return titleA.localeCompare(titleB);
          })
        }))
        .sort((a, b) => {
          // Sort groups by genre name (case-insensitive, put "No Genre" at the end)
          const labelA = a.label.toLowerCase();
          const labelB = b.label.toLowerCase();
          if (labelA === 'no genre') return 1;
          if (labelB === 'no genre') return -1;
          return labelA.localeCompare(labelB);
        });
      
      return groups;
    } else if (bookshelfGrouping === 'publication_year') {
      // Group by decades using first_issue_year (fallback to publish_year)
      const decadeMap = new Map<string, BookWithRatings[]>();
      
      booksForBookshelf.forEach(book => {
        const year = book.first_issue_year || book.publish_year;
        let decadeLabel: string;
        
        if (year && typeof year === 'number' && year > 0) {
          // Calculate decade: e.g., 2023 -> "2020s", 1995 -> "1990s"
          const decade = Math.floor(year / 10) * 10;
          decadeLabel = `${decade}s`;
        } else {
          // Books without publication year
          decadeLabel = 'Unknown';
        }
        
        if (!decadeMap.has(decadeLabel)) {
          decadeMap.set(decadeLabel, []);
        }
        decadeMap.get(decadeLabel)!.push(book);
      });
      
      // Convert to groups array
      const groups: { label: string; books: BookWithRatings[] }[] = Array.from(decadeMap.entries())
        .map(([decadeLabel, books]) => ({
          label: decadeLabel,
          books: books.sort((a, b) => {
            // Sort books within each decade by year descending (newest first)
            // Use first_issue_year if available, otherwise publish_year
            const yearA = a.first_issue_year || a.publish_year || 0;
            const yearB = b.first_issue_year || b.publish_year || 0;
            return yearB - yearA; // Descending order
          })
        }))
        .sort((a, b) => {
          // Sort decades descending (newest first)
          // Put "Unknown" at the end
          if (a.label === 'Unknown') return 1;
          if (b.label === 'Unknown') return -1;
          
          // Extract decade number from label (e.g., "2020s" -> 2020)
          const decadeA = parseInt(a.label.replace('s', '')) || 0;
          const decadeB = parseInt(b.label.replace('s', '')) || 0;
          return decadeB - decadeA; // Descending order
        });
      
      return groups;
    }
    // Default fallback (should never happen)
    return [];
  }, [booksForBookshelf, bookshelfGrouping, viewingUserId]);
  
  // When editing, show the first dimension that needs rating, or first dimension if all are rated
  const currentEditingDimension = useMemo((): typeof RATING_DIMENSIONS[number] | null => {
    if (!activeBook || !isEditing || selectingReadingStatusInRating) return null;
    if (editingDimension) return editingDimension;
    // Find first unrated dimension, or default to first dimension
    return RATING_DIMENSIONS.find(d => activeBook.ratings[d] === null) || RATING_DIMENSIONS[0];
  }, [activeBook, isEditing, editingDimension, selectingReadingStatusInRating]);
  
  const showRatingOverlay = activeBook && isEditing;
  const showReadingStatusSelection = selectingReadingStatusInRating || selectingReadingStatusForExisting;

  useEffect(() => {
    setIsEditing(false);
    setIsConfirmingDelete(false);
    // Check if we should open notes after navigating from notes list
    if (openNotesAfterNavRef.current) {
      openNotesAfterNavRef.current = false;
      setIsShowingNotes(true);
    } else {
      setIsShowingNotes(false);
    }
    setNewlyAddedNoteTimestamp(null);
    setEditingDimension(null);
    setSelectedInsightCategory('trivia'); // Reset to trivia when book changes
    setIsInsightCategoryDropdownOpen(false); // Close dropdown when book changes

    setIsMetaExpanded(true);
    setIsSummaryExpanded(false); // Reset summary expansion when book changes
    const timer = setTimeout(() => {
      setIsMetaExpanded(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [selectedIndex]);

  // Close bookshelf grouping dropdown when clicking outside
  useEffect(() => {
    if (!isBookshelfGroupingDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (bookshelfGroupingDropdownRef.current && !bookshelfGroupingDropdownRef.current.contains(e.target as Node)) {
        setIsBookshelfGroupingDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBookshelfGroupingDropdownOpen]);

  // Close feed type dropdown when clicking outside
  useEffect(() => {
    if (!isFeedTypeDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (feedTypeDropdownRef.current && !feedTypeDropdownRef.current.contains(e.target as Node)) {
        setIsFeedTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFeedTypeDropdownOpen]);

  // Close insight category dropdown when clicking outside
  useEffect(() => {
    if (!isInsightCategoryDropdownOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.insight-category-dropdown')) {
        setIsInsightCategoryDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isInsightCategoryDropdownOpen]);

  // Load note text when book changes
  useEffect(() => {
    if (activeBook) {
      // Format notes for display with timestamps visible
      const formattedNotes = formatNotesForDisplay(activeBook.notes ?? null);
      setNoteText(formattedNotes);
      lastSavedNoteTextRef.current = formattedNotes;
      noteTextOnFocusRef.current = formattedNotes; // Track initial state
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
      // Store previous gradient BEFORE any state changes
      const prevGradient = backgroundGradient;
      setPreviousGradient(prevGradient);
      setIsGradientTransitioning(true);
      
      // Extract new gradient asynchronously
      extractColorsFromImage(currentBook.cover_url).then(gradient => {
        // Set new gradient - this will trigger the fade in
        setBackgroundGradient(gradient);
        // After new gradient fully fades in, fade out the old one
        setTimeout(() => {
          setPreviousGradient(null);
          setIsGradientTransitioning(false);
        }, 450); // Wait for new gradient to fully fade in (400ms) + small buffer
      }).catch(() => {
        // Fallback if extraction fails
        setBackgroundGradient('241,245,249,226,232,240');
        setTimeout(() => {
          setPreviousGradient(null);
          setIsGradientTransitioning(false);
        }, 450);
      });
    } else {
      // No cover - use default gradient
      const prevGradient = backgroundGradient;
      setPreviousGradient(prevGradient);
      setIsGradientTransitioning(true);
      setBackgroundGradient('241,245,249,226,232,240'); // Default slate colors
      setTimeout(() => {
        setPreviousGradient(null);
        setIsGradientTransitioning(false);
      }, 450);
    }
  }, [selectedIndex, books]);

  // Track which books we're currently fetching facts for to prevent duplicate concurrent fetches
  const fetchingFactsForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch author facts for existing books when they're selected
  // Now uses cache table instead of books table
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.author_facts) {
      setLoadingFactsForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingFactsForBookId(null);
      return;
    }

      const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if facts already exist in local state - if so, don't fetch again
    const hasFacts = currentBook.author_facts && 
                     Array.isArray(currentBook.author_facts) && 
                     currentBook.author_facts.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingFactsForBooksRef.current.has(bookId);
    
    if (hasFacts) {
      // Facts already loaded in state, no need to fetch again
        setLoadingFactsForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingFactsForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingFactsForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingFactsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Author Facts] 🔄 Fetching author facts for "${bookTitle}" by ${bookAuthor}...`);
      getAuthorFacts(bookTitle, bookAuthor).then(async (result) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingFactsForBookId(null);
        fetchingFactsForBooksRef.current.delete(bookId);
        
        if (result.facts.length > 0) {
          console.log(`[Author Facts] ✅ Received ${result.facts.length} facts for "${bookTitle}"`);
          
          // Update local state for display (cache is already saved by getAuthorFacts)
          // Only update if the book is still the active one
            setBooks(prev => prev.map(book => 
              book.id === bookId 
              ? { ...book, author_facts: result.facts, first_issue_year: result.first_issue_year || book.first_issue_year }
                : book
            ));
          
          // Save first_issue_year to database if we got it
          if (result.first_issue_year && user) {
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ first_issue_year: result.first_issue_year, updated_at: new Date().toISOString() })
                .eq('id', bookId)
                .eq('user_id', user.id);
              
              if (updateError) {
                console.error('[Author Facts] ❌ Error saving first_issue_year:', updateError);
              } else {
                console.log(`[Author Facts] 💾 Saved first_issue_year ${result.first_issue_year} to database for "${bookTitle}"`);
              }
          } catch (err) {
              console.error('[Author Facts] ❌ Error saving first_issue_year:', err);
            }
          }
        } else {
          console.log(`[Author Facts] ⚠️ No facts received for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingFactsForBookId(null);
          console.error('Error fetching author facts:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingFactsForBooksRef.current.delete(bookId);
      });
    }, 1500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingFactsForBookId(null);
      fetchingFactsForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Control trivia theme music playback
  useEffect(() => {
    if (triviaAudioRef.current) {
      const audio = triviaAudioRef.current;
      // Set volume based on mute state
      audio.muted = isTriviaMuted;
      
      // Play when trivia game is active (has questions and not complete)
      if (isPlayingTrivia && triviaQuestions.length > 0 && !triviaGameComplete && !isTriviaReady && !isTriviaLoading) {
        audio.loop = true;
        // Resume from current position if already loaded, otherwise start from beginning
        audio.play().catch(err => {
          console.warn('Failed to play trivia theme:', err);
        });
      } else if (!isPlayingTrivia) {
        // Only pause when game is closed (not when in ready/loading state)
        audio.pause();
        // Don't reset currentTime so it can resume when reopened
      } else if (triviaGameComplete || isTriviaReady || isTriviaLoading) {
        // Pause when game ends or is in ready/loading state, but keep position
        audio.pause();
      }
    }
  }, [isPlayingTrivia, triviaQuestions.length, triviaGameComplete, isTriviaReady, isTriviaLoading, isTriviaMuted]);

  // Pause music when browser goes to background
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleVisibilityChange = () => {
      if (triviaAudioRef.current) {
        const audio = triviaAudioRef.current;
        audio.muted = isTriviaMuted; // Update mute state
        if (document.hidden) {
          // Browser went to background - pause music
          audio.pause();
        } else {
          // Browser came back to foreground - resume if game is active
          if (isPlayingTrivia && triviaQuestions.length > 0 && !triviaGameComplete && !isTriviaReady && !isTriviaLoading) {
            audio.loop = true;
            audio.play().catch(err => {
              console.warn('Failed to resume trivia theme:', err);
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlayingTrivia, triviaQuestions.length, triviaGameComplete, isTriviaReady, isTriviaLoading, isTriviaMuted]);

  // Track which books we're currently fetching influences for to prevent duplicate concurrent fetches
  const fetchingInfluencesForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book influences for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_influences) {
      setLoadingInfluencesForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingInfluencesForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if influences already exist in local state
    const influences = bookInfluences.get(bookId);
    const hasInfluences = influences && influences.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingInfluencesForBooksRef.current.has(bookId);
    
    if (hasInfluences) {
      // Influences already loaded in state, no need to fetch again
      setLoadingInfluencesForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingInfluencesForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingInfluencesForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingInfluencesForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Book Influences] 🔄 Fetching influences for "${bookTitle}" by ${bookAuthor}...`);
      getBookInfluences(bookTitle, bookAuthor).then((influences) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingInfluencesForBookId(null);
        fetchingInfluencesForBooksRef.current.delete(bookId);
        
        if (influences.length > 0) {
          console.log(`[Book Influences] ✅ Received ${influences.length} influences for "${bookTitle}"`);
          
          // Store in state
          setBookInfluences(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, influences);
            return newMap;
          });
        } else {
          console.log(`[Book Influences] ⚠️ No influences received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setBookInfluences(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingInfluencesForBookId(null);
          console.error('Error fetching book influences:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingInfluencesForBooksRef.current.delete(bookId);
      });
    }, 2000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingInfluencesForBookId(null);
      fetchingInfluencesForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching domain insights for to prevent duplicate concurrent fetches
  const fetchingDomainForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book domain insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_domain) {
      setLoadingDomainForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingDomainForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if domain insights already exist in local state
    const domainData = bookDomain.get(bookId);
    const hasDomain = domainData && domainData.facts && domainData.facts.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingDomainForBooksRef.current.has(bookId);
    
    if (hasDomain) {
      // Domain insights already loaded in state, no need to fetch again
      setLoadingDomainForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingDomainForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingDomainForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingDomainForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Book Domain] 🔄 Fetching domain insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookDomain(bookTitle, bookAuthor).then((domainData) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingDomainForBookId(null);
        fetchingDomainForBooksRef.current.delete(bookId);
        
        if (domainData && domainData.facts.length > 0) {
          console.log(`[Book Domain] ✅ Received ${domainData.facts.length} domain insights for "${bookTitle}" with label: ${domainData.label}`);
          
          // Store in state
          setBookDomain(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, domainData);
            return newMap;
          });
        } else {
          console.log(`[Book Domain] ⚠️ No domain insights received for "${bookTitle}"`);
          // Store empty data to prevent future fetches
          setBookDomain(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, { label: 'Domain', facts: [] });
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingDomainForBookId(null);
          console.error('Error fetching book domain insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDomainForBooksRef.current.delete(bookId);
      });
    }, 2500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingDomainForBookId(null);
      fetchingDomainForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching context for to prevent duplicate concurrent fetches
  const fetchingContextForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch book context insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.book_context) {
      setLoadingContextForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingContextForBookId(null);
      return;
    }

    const bookId = currentBook.id;
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
    
    // Check if context insights already exist in local state
    const contextInsights = bookContext.get(bookId);
    const hasContext = contextInsights && contextInsights.length > 0;
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingContextForBooksRef.current.has(bookId);
    
    if (hasContext) {
      // Context insights already loaded in state, no need to fetch again
      setLoadingContextForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingContextForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingContextForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingContextForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
        if (cancelled) return;
        
      console.log(`[Book Context] 🔄 Fetching context insights for "${bookTitle}" by ${bookAuthor}...`);
      getBookContext(bookTitle, bookAuthor).then((contextInsights) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingContextForBookId(null);
        fetchingContextForBooksRef.current.delete(bookId);
        
        if (contextInsights.length > 0) {
          console.log(`[Book Context] ✅ Received ${contextInsights.length} context insights for "${bookTitle}"`);
          
          // Store in state
          setBookContext(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, contextInsights);
            return newMap;
          });
        } else {
          console.log(`[Book Context] ⚠️ No context insights received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setBookContext(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingContextForBookId(null);
          console.error('Error fetching book context insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingContextForBooksRef.current.delete(bookId);
      });
    }, 3000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingContextForBookId(null);
      fetchingContextForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching "Did you know?" insights for to prevent duplicate concurrent fetches
  const fetchingDidYouKnowForBooksRef = useRef<Set<string>>(new Set());

  // Fetch "Did you know?" insights for existing books when they're selected
  useEffect(() => {
    // Skip if feature flag is disabled
    if (!featureFlags.insights.did_you_know) {
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;

    // Check if "Did you know?" insights already exist in local state
    const didYouKnowData = didYouKnow.get(bookId);
    const hasDidYouKnow = didYouKnowData && didYouKnowData.length > 0;

    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingDidYouKnowForBooksRef.current.has(bookId);

    if (hasDidYouKnow) {
      // "Did you know?" insights already loaded in state, no need to fetch again
      setLoadingDidYouKnowForBookId(null);
      return;
    }

    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingDidYouKnowForBookId(bookId);
      return;
    }

    let cancelled = false;

    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingDidYouKnowForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingDidYouKnowForBookId(bookId);

    // Add a short delay to avoid rate limits when scrolling through books
    // Shorter delay than other insights since this is the only enabled insight type by default
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;

      console.log(`[Did You Know] 🔄 Fetching "Did you know?" insights for "${bookTitle}" by ${bookAuthor}...`);
      getDidYouKnow(bookTitle, bookAuthor).then((insights) => {
        if (cancelled) return;

        // Clear loading state and remove from fetching set
        setLoadingDidYouKnowForBookId(null);
        fetchingDidYouKnowForBooksRef.current.delete(bookId);

        if (insights.length > 0) {
          console.log(`[Did You Know] ✅ Received ${insights.length} "Did you know?" insights for "${bookTitle}"`);

          // Store in state
          setDidYouKnow(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, insights);
            return newMap;
          });
        } else {
          console.log(`[Did You Know] ⚠️ No "Did you know?" insights received for "${bookTitle}"`);
          // Store empty array to prevent future fetches
          setDidYouKnow(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingDidYouKnowForBookId(null);
          console.error('Error fetching "Did you know?" insights:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingDidYouKnowForBooksRef.current.delete(bookId);
      });
    }, 1500); // Shorter delay since this is the primary insight type

    return () => {
      cancelled = true;
      setLoadingDidYouKnowForBookId(null);
      fetchingDidYouKnowForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching podcasts for to prevent duplicate concurrent fetches
  const fetchingPodcastsForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch podcast episodes for existing books when they're selected
  // Now uses cache table instead of books table
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
        setLoadingPodcastsForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const bookTitle = currentBook.title;
    const bookAuthor = currentBook.author;
    
    // Check if episodes already exist in local state
    const hasEpisodes = (currentBook.podcast_episodes_curated && currentBook.podcast_episodes_curated.length > 0) ||
                        (currentBook.podcast_episodes_apple && currentBook.podcast_episodes_apple.length > 0);
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingPodcastsForBooksRef.current.has(bookId);
    
    if (hasEpisodes) {
      // Episodes already loaded in state, no need to fetch again
      setLoadingPodcastsForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingPodcastsForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark this book as being fetched (to prevent concurrent fetches)
    fetchingPodcastsForBooksRef.current.add(bookId);

    // Set loading state
    setLoadingPodcastsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      console.log(`[Podcast Episodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor).then((allEpisodes) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingPodcastsForBookId(null);
        fetchingPodcastsForBooksRef.current.delete(bookId);
        
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
          
          // Update local state for display (cache is already saved by getPodcastEpisodes)
            setBooks(prev => prev.map(book => 
              book.id === bookId 
              ? { 
                  ...book, 
                  podcast_episodes_curated: curated,
                  podcast_episodes_apple: apple
                }
                : book
            ));
        } else {
          console.log(`[Podcast Episodes] ⚠️ No episodes found for "${bookTitle}"`);
        }
      }).catch(err => {
        if (!cancelled) {
          setLoadingPodcastsForBookId(null);
          console.error('Error fetching podcast episodes:', err);
        }
        // Remove from fetching set on error so we can retry
        fetchingPodcastsForBooksRef.current.delete(bookId);
      });
    }, 2000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingPodcastsForBookId(null);
      fetchingPodcastsForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching analysis for to prevent duplicate concurrent fetches
  const fetchingAnalysisForBooksRef = useRef<Set<string>>(new Set());

  // Load analysis articles from Google Scholar
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    const bookId = currentBook.id;

    // Check if analysis already exists in state
    const hasAnalysis = analysisArticles.has(bookId);
    const isCurrentlyFetching = fetchingAnalysisForBooksRef.current.has(bookId);
    
    if (hasAnalysis) {
      setLoadingAnalysisForBookId(null);
      return;
    }

    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingAnalysisForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingAnalysisForBooksRef.current.add(bookId);

    setLoadingAnalysisForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Analysis Articles] 🔄 Fetching from Google Scholar for "${bookTitle}" by ${bookAuthor}...`);
      getGoogleScholarAnalysis(bookTitle, bookAuthor).then((articles) => {
        if (cancelled) return;
        
        // Clear loading state and remove from fetching set
        setLoadingAnalysisForBookId(null);
        fetchingAnalysisForBooksRef.current.delete(bookId);
        
        // Store in state (including empty arrays to prevent future fetches)
          setAnalysisArticles(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, articles);
            return newMap;
          });

        if (articles.length > 0) {
          console.log(`[Analysis Articles] ✅ Received ${articles.length} articles for "${bookTitle}"`);
        } else {
          console.log(`[Analysis Articles] ⚠️ No articles found for "${bookTitle}" (cached for future requests)`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingAnalysisForBookId(null);
        console.error('Error fetching analysis articles:', err);
        // Remove from fetching set on error so we can retry
        fetchingAnalysisForBooksRef.current.delete(bookId);
      });
    }, 2000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingAnalysisForBookId(null);
      fetchingAnalysisForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching videos for to prevent duplicate concurrent fetches
  const fetchingVideosForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch YouTube videos for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingVideosForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const videos = youtubeVideos.get(bookId);
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingVideosForBooksRef.current.has(bookId);
    
    // If videos already exist in state, don't fetch again
    if (videos !== undefined) {
      setLoadingVideosForBookId(null);
      return;
    }
    
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingVideosForBookId(bookId);
      return;
    }
    
    // Force fetch to check cache - this ensures cached data is loaded on initial page load

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingVideosForBooksRef.current.add(bookId);

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
        
        // Clear loading state and remove from fetching set
        setLoadingVideosForBookId(null);
        fetchingVideosForBooksRef.current.delete(bookId);
        
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
          // Store empty array to prevent future fetches
          setYoutubeVideos(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, []);
            return newMap;
          });
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingVideosForBookId(null);
        console.error('Error fetching YouTube videos:', err);
        // Remove from fetching set on error so we can retry
        fetchingVideosForBooksRef.current.delete(bookId);
      });
    }, 2500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingVideosForBookId(null);
      fetchingVideosForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Track which books we're currently fetching related books for to prevent duplicate concurrent fetches
  const fetchingRelatedForBooksRef = useRef<Set<string>>(new Set());
  
  // Fetch related books when activeBook changes
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingRelatedForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const related = relatedBooks.get(bookId);
    
    // If related books already exist in state (including empty array), don't fetch again
    if (related !== undefined) {
      setLoadingRelatedForBookId(null);
      return;
    }
    
    // Check if we're currently fetching for this book (to prevent concurrent fetches)
    const isCurrentlyFetching = fetchingRelatedForBooksRef.current.has(bookId);
    if (isCurrentlyFetching) {
      // Fetch already in progress, just wait
      setLoadingRelatedForBookId(bookId);
      return;
    }

    let cancelled = false;
    
    // Mark as being fetched (to prevent concurrent fetches)
    fetchingRelatedForBooksRef.current.add(bookId);

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
        
        // Clear loading state and remove from fetching set
        setLoadingRelatedForBookId(null);
        fetchingRelatedForBooksRef.current.delete(bookId);
        
        if (books.length > 0) {
          console.log(`[Related Books] ✅ Received ${books.length} related books for "${bookTitle}"`);
        } else {
          console.log(`[Related Books] ⚠️ No related books found for "${bookTitle}"`);
        }
        
        // Always store in state (even if empty) to mark as fetched
        setRelatedBooks(prev => {
          const newMap = new Map(prev);
          newMap.set(bookId, books);
          return newMap;
        });
      }).catch((err) => {
        if (cancelled) return;
        setLoadingRelatedForBookId(null);
        console.error('Error fetching related books:', err);
        // Remove from fetching set on error so we can retry
        fetchingRelatedForBooksRef.current.delete(bookId);
      });
    }, 3000); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingRelatedForBookId(null);
      fetchingRelatedForBooksRef.current.delete(bookId); // Clean up on unmount
      clearTimeout(fetchTimer);
    };
  }, [activeBook?.id]); // Depend on activeBook.id to trigger when book changes or books are first loaded

  // Fetch research when activeBook changes
  // DISABLED: getBookResearch call is temporarily disabled
  useEffect(() => {
    // Early return to disable research fetching
    setLoadingResearchForBookId(null);
    return;
    
    /* DISABLED CODE
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingResearchForBookId(null);
      return;
    }

    const bookId = currentBook.id;
    const research = researchData.get(bookId);
    
    // If research already exists, don't fetch again
    if (research && research.pillars && research.pillars.length > 0) {
      return;
    }

    let cancelled = false;

    // Set loading state
    setLoadingResearchForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Book Research] 🔄 Fetching for "${bookTitle}" by ${bookAuthor}...`);
      getBookResearch(bookTitle, bookAuthor).then((research) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingResearchForBookId(null);
        
        if (research && research.pillars && research.pillars.length > 0) {
          console.log(`[Book Research] ✅ Received research with ${research.pillars.length} pillars for "${bookTitle}"`);
          // Store in state
          setResearchData(prev => {
            const newMap = new Map(prev);
            newMap.set(bookId, research);
            return newMap;
          });
        } else {
          console.log(`[Book Research] ⚠️ No research data found for "${bookTitle}"`);
        }
      }).catch((err) => {
        if (cancelled) return;
        setLoadingResearchForBookId(null);
        console.error('Error fetching book research:', err);
      });
    }, 3500); // Delay to avoid rate limits when scrolling

    return () => {
      cancelled = true;
      setLoadingResearchForBookId(null);
      clearTimeout(fetchTimer);
    };
    */
  }, [selectedIndex, books, researchData]); // Depend on selectedIndex, books, and researchData

  // Fetch other users who have the same book (book readers)
  useEffect(() => {
    if (!user) return;

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.canonical_book_id) {
      setBookReaders([]);
      return;
    }

    let cancelled = false;
    setIsLoadingBookReaders(true);

    const fetchBookReaders = async () => {
      try {
        // 1. Get all books with the same canonical_book_id from other users
        const { data: otherUsersBooks, error: booksError } = await supabase
          .from('books')
          .select('user_id')
          .eq('canonical_book_id', currentBook.canonical_book_id)
          .neq('user_id', user.id)
          .limit(20);

        if (booksError || !otherUsersBooks || otherUsersBooks.length === 0) {
          if (!cancelled) {
            setBookReaders([]);
            setIsLoadingBookReaders(false);
          }
          return;
        }

        const userIds = [...new Set(otherUsersBooks.map(b => b.user_id))];

        // 2. Get user profile info from users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, is_public')
          .in('id', userIds)
          .eq('is_public', true);

        if (usersError || !usersData || usersData.length === 0) {
          if (!cancelled) {
            setBookReaders([]);
            setIsLoadingBookReaders(false);
          }
          return;
        }

        // 3. Get list of users current user follows
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const followingIds = new Set(followsData?.map(f => f.following_id) || []);

        // 4. Build readers list with following status, sorted by following first
        const readers: BookReader[] = (usersData || []).map(u => ({
          id: u.id,
          name: u.full_name || 'User',
          avatar: u.avatar_url,
          isFollowing: followingIds.has(u.id),
        })).sort((a, b) => (b.isFollowing ? 1 : 0) - (a.isFollowing ? 1 : 0));

        if (!cancelled) {
          setBookReaders(readers);
          setIsLoadingBookReaders(false);
        }
      } catch (err) {
        console.error('[BookReaders] Error fetching:', err);
        if (!cancelled) {
          setBookReaders([]);
          setIsLoadingBookReaders(false);
        }
      }
    };

    // Small delay to batch with other fetches
    const timer = setTimeout(fetchBookReaders, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeBook?.canonical_book_id, user]);

  // Pre-fetch/create Telegram topic in the background when book loads
  useEffect(() => {
    if (!user || !activeBook?.canonical_book_id) return;

    // Skip if already cached locally
    if (telegramTopics.has(activeBook.canonical_book_id)) return;

    let cancelled = false;

    const prefetchTelegramTopic = async () => {
      try {
        // First check if topic exists in database
        const existing = await getTelegramTopic(activeBook.canonical_book_id!);
        if (existing) {
          if (!cancelled) {
            setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, existing));
          }
          return;
        }

        // Topic doesn't exist - create it in the background
        const topic = await getOrCreateTelegramTopic(
          activeBook.title,
          activeBook.author,
          activeBook.canonical_book_id!,
          activeBook.cover_url || undefined,
          activeBook.genre || undefined
        );

        if (topic && !cancelled) {
          setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
        }
      } catch (err) {
        console.error('[TelegramTopic] Error prefetching:', err);
      }
    };

    // Small delay to not compete with other fetches
    const timer = setTimeout(prefetchTelegramTopic, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeBook?.canonical_book_id, user]);

  // Fetch discussion questions when the discussion modal opens
  useEffect(() => {
    if (!showBookDiscussion || !activeBook || !activeBook.canonical_book_id) {
      return;
    }

    // Don't fetch if we already have questions for this book
    if (discussionQuestions.length > 0) {
      return;
    }

    let cancelled = false;
    setIsLoadingDiscussionQuestions(true);

    const fetchQuestions = async () => {
      try {
        const questions = await getDiscussionQuestions(
          activeBook.title,
          activeBook.author,
          activeBook.canonical_book_id!
        );

        if (!cancelled) {
          setDiscussionQuestions(questions);
          setIsLoadingDiscussionQuestions(false);
        }
      } catch (err) {
        console.error('[DiscussionQuestions] Error fetching:', err);
        if (!cancelled) {
          setIsLoadingDiscussionQuestions(false);
        }
      }
    };

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [showBookDiscussion, activeBook?.canonical_book_id]);

  // Reset discussion questions when the book changes
  useEffect(() => {
    setDiscussionQuestions([]);
  }, [activeBook?.id]);

  // Track which books we've generated feed items for to avoid duplicate generation
  const generatedFeedForBooksRef = useRef<Set<string>>(new Set());

  // Generate feed items when content is cached for a book
  useEffect(() => {
    if (!user) return;

    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title) return;

    const bookId = currentBook.id;

    // Skip if we've already generated feed items for this book
    if (generatedFeedForBooksRef.current.has(bookId)) return;

    // Check if this book has any cached content (indicating content has been fetched)
    // We'll trigger feed generation after a delay to allow content fetching to complete
    const timer = setTimeout(async () => {
      // Double-check we haven't already generated
      if (generatedFeedForBooksRef.current.has(bookId)) return;

      // Check if the book has some cached content
      const hasInfluences = bookInfluences.has(bookId) && (bookInfluences.get(bookId)?.length || 0) > 0;
      const hasContext = bookContext.has(bookId) && (bookContext.get(bookId)?.length || 0) > 0;
      const hasDomain = bookDomain.has(bookId) && (bookDomain.get(bookId)?.facts?.length || 0) > 0;
      const hasFacts = currentBook.author_facts && currentBook.author_facts.length > 0;
      const hasVideos = youtubeVideos.has(bookId) && (youtubeVideos.get(bookId)?.length || 0) > 0;
      const hasDidYouKnow = didYouKnow.has(bookId) && (didYouKnow.get(bookId)?.length || 0) > 0;

      // Only generate if we have at least some content
      if (hasInfluences || hasContext || hasDomain || hasFacts || hasVideos || hasDidYouKnow) {
        console.log(`[Feed Generation] 🔄 Generating feed items for "${currentBook.title}"...`);
        generatedFeedForBooksRef.current.add(bookId);

        const result = await generateFeedItemsForBook(
          user.id,
          bookId,
          currentBook.title,
          currentBook.author || '',
          currentBook.cover_url || null,
          currentBook.reading_status || null,
          currentBook.created_at
        );

        console.log(`[Feed Generation] ✅ Created ${result.created} feed items for "${currentBook.title}"`);
      }
    }, 5000); // Wait 5 seconds for content fetching to complete

    return () => clearTimeout(timer);
  }, [activeBook?.id, user, bookInfluences, bookContext, bookDomain, youtubeVideos, didYouKnow]);

  // Track if feed has been loaded to prevent reload on app resume
  const feedLoadedRef = useRef(false);

  // Load personalized feed when feed page is shown (only if not already loaded)
  useEffect(() => {
    if (!showFeedPage || !user) return;

    // Don't reload if we already have feed items (prevents reload on app resume)
    if (feedLoadedRef.current && personalizedFeedItems.length > 0) {
      console.log('[Feed] ℹ️ Feed already loaded, skipping reload');
      return;
    }

    async function loadPersonalizedFeed() {
      setIsLoadingPersonalizedFeed(true);
      setFeedDisplayCount(8); // Reset pagination
      try {
        console.log('[Feed] 🔄 Loading personalized feed...');
        const items = await getPersonalizedFeed(user!.id);

        // Merge read status from localStorage
        const readItems = getReadFeedItems();
        const itemsWithReadStatus = items.map(item => ({
          ...item,
          read: readItems.has(item.id)
        }));

        setPersonalizedFeedItems(itemsWithReadStatus as PersonalizedFeedItem[]);
        feedLoadedRef.current = true;
        console.log(`[Feed] ✅ Loaded ${items.length} feed items (${readItems.size} marked as read)`);

        // Mark only first 8 items as shown
        const initialItems = items.slice(0, 8);
        if (initialItems.length > 0) {
          markFeedItemsAsShown(initialItems.map(item => item.id));
        }
      } catch (error) {
        console.error('[Feed] ❌ Error loading feed:', error);
      } finally {
        setIsLoadingPersonalizedFeed(false);
      }
    }

    loadPersonalizedFeed();
  }, [showFeedPage, user]);

  // Cleanup feed audio when leaving feed page
  useEffect(() => {
    if (!showFeedPage && feedAudioRef.current) {
      feedAudioRef.current.pause();
      feedAudioRef.current = null;
      setFeedPlayingAudioUrl(null);
    }
  }, [showFeedPage]);

  // Cleanup feed audio on unmount
  useEffect(() => {
    return () => {
      if (feedAudioRef.current) {
        feedAudioRef.current.pause();
        feedAudioRef.current = null;
      }
    };
  }, []);

  // Handle feed podcast play/pause
  function handleFeedPodcastPlay(episode: any) {
    const audioUrl = episode?.audioUrl || (episode?.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);

    if (audioUrl) {
      // Direct audio playback
      if (feedPlayingAudioUrl === audioUrl) {
        // Pause if already playing
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
          setFeedPlayingAudioUrl(null);
        }
      } else {
        // Stop any currently playing audio
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
        }
        // Play new audio
        setFeedPlayingAudioUrl(audioUrl);
        feedAudioRef.current = new Audio(audioUrl);
        feedAudioRef.current.addEventListener('ended', () => {
          setFeedPlayingAudioUrl(null);
        });
        feedAudioRef.current.addEventListener('error', () => {
          console.error('[Feed] Audio playback failed, opening URL:', episode.url);
          window.open(episode.url, '_blank');
          setFeedPlayingAudioUrl(null);
        });
        feedAudioRef.current.play();
      }
    } else if (episode?.url) {
      // No direct audio URL - open in new tab
      if (feedPlayingAudioUrl === episode.url) {
        setFeedPlayingAudioUrl(null);
      } else {
        if (feedAudioRef.current) {
          feedAudioRef.current.pause();
          setFeedPlayingAudioUrl(null);
        }
        setFeedPlayingAudioUrl(episode.url);
        window.open(episode.url, '_blank');
        setTimeout(() => setFeedPlayingAudioUrl(null), 1000);
      }
    }
  }

  // Helper function to generate canonical book ID (matches database function)
  function generateCanonicalBookId(title: string, author: string): string {
    const normalizedTitle = (title || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedAuthor = (author || '').toLowerCase().trim().replace(/\s+/g, ' ');
    return `${normalizedTitle}|${normalizedAuthor}`;
  }

  async function handleAddBook(meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    if (!user) return;

    // Store the book metadata and add the book, then show rating overlay with reading status selection
    setPendingBookMeta(meta);
    setIsAdding(false);
    setShowFeedPage(false);
    // Add book without status first, then show rating overlay
    // Pass meta directly to avoid race conditions with state updates
    await handleAddBookWithStatus(null as any, meta); // Add with null status, will update later
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
        
        // If status changed to "read_it", integrate the book into merge sort game
        if (readingStatus === 'read_it') {
          addBookToMergeSortState(id);
        }
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

  async function handleAddBookWithStatus(readingStatus: ReadingStatus | null, metaOverride?: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>) {
    // Use metaOverride if provided (to avoid race conditions), otherwise use pendingBookMeta
    const meta = metaOverride || pendingBookMeta;
    if (!user || !meta) return;

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
          setShowBookshelfCovers(false);
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
          setShowBookshelfCovers(false);
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
        first_issue_year: meta.first_issue_year ?? null,
        genre: meta.genre ?? null,
        isbn: meta.isbn ?? null,
        cover_url: meta.cover_url ?? null,
        wikipedia_url: meta.wikipedia_url ?? null,
        google_books_url: meta.google_books_url ?? null,
        summary: meta.summary ?? null,
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

          // Create friend_book feed item for social feed
          createFriendBookFeedItem(
            user.id,
            newBook.id,
            newBook.title,
            newBook.author || '',
            newBook.cover_url || null,
            readingStatus,
            newBook.summary || null
          );
          // Switch to books view (in case we're on bookshelf/notes screen)
          setShowBookshelf(false);
          setShowBookshelfCovers(false);
          setShowNotesView(false);
          
          // If status is "read_it", integrate the new book into the merge sort game
          if (readingStatus === 'read_it') {
            addBookToMergeSortState(newBook.id);
          }
          
          // If readingStatus is null, we need to show reading status selection in rating overlay
          if (readingStatus === null) {
            setSelectingReadingStatusInRating(true);
            setTimeout(() => {
              setIsEditing(true);
            }, 100);
          } else if (readingStatus === 'read_it') {
            // If status is "read_it", proceed to rating dimensions
            setPendingBookMeta(null);
            setSelectingReadingStatusInRating(false);
          setTimeout(() => {
            setIsEditing(true);
            setEditingDimension(null); // Will default to first unrated dimension
          }, 100);
          } else {
            // For "reading" or "want_to_read", just close
            setPendingBookMeta(null);
            setSelectingReadingStatusInRating(false);
          }
          return;
        }
        
        // Show user-friendly error message for other errors
        const errorMessage = error?.message || error?.code || 'Unknown error';
        alert(`Failed to add book: ${errorMessage}`);
        return;
      }

      const newBook = convertBookToApp(data);
      triggerSuccessHaptic();
      setBooks(prev => [newBook, ...prev]);
      setSelectedIndex(0);
      setIsAdding(false);
      // Switch to books view (in case we're on bookshelf/notes screen)
      setShowBookshelf(false);
      setShowBookshelfCovers(false);
      setShowNotesView(false);

      // Create friend_book feed item for social feed
      createFriendBookFeedItem(
        user.id,
        newBook.id,
        newBook.title,
        newBook.author || '',
        newBook.cover_url || null,
        readingStatus,
        newBook.summary || null
      );

      // If status is "read_it", integrate the new book into the merge sort game
      if (readingStatus === 'read_it') {
        addBookToMergeSortState(newBook.id);
      }

      // If readingStatus is null, we need to show reading status selection in rating overlay
      if (readingStatus === null) {
        setSelectingReadingStatusInRating(true);
        setTimeout(() => {
          setIsEditing(true);
        }, 100);
      } else if (readingStatus === 'read_it') {
        // If status is "read_it", proceed to rating dimensions
        setPendingBookMeta(null);
        setSelectingReadingStatusInRating(false);
      setTimeout(() => {
        setIsEditing(true);
        setEditingDimension(null); // Will default to first unrated dimension
      }, 100);
          } else {
        // For "reading" or "want_to_read", just close
        setPendingBookMeta(null);
        setSelectingReadingStatusInRating(false);
      }

      // Note: We don't fetch data here anymore - let the useEffect hooks handle it
      // They will check the cache first and only make API calls if needed
      // This prevents duplicate calls when a book is added and then becomes active
      // The useEffect hooks will automatically trigger when the new book becomes activeBook
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

      triggerHeavyHaptic();
      const newBooks = books.filter(b => b.id !== activeBook.id);
      const nextIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
      setIsConfirmingDelete(false);
      setSelectedIndex(newBooks.length > 0 ? nextIndex : 0);
      setBooks(newBooks);
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  }

  // Helper function to format timestamp for notes
  const formatNoteTimestamp = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // Helper function to parse notes into sections with timestamps
  const parseNotes = (notes: string | null): Array<{ timestamp: string; content: string }> => {
    if (!notes || notes.trim() === '') {
      return [];
    }

    const sections: Array<{ timestamp: string; content: string }> = [];
    // Match pattern: {timestamp}\n or {timestamp} at end
    const timestampRegex = /\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\}\n?/g;
    let match;
    const matches: Array<{ timestamp: string; index: number; fullMatch: string }> = [];

    // Collect all timestamp matches first
    while ((match = timestampRegex.exec(notes)) !== null) {
      matches.push({ timestamp: match[1], index: match.index, fullMatch: match[0] });
    }

    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const contentStart = current.index + current.fullMatch.length;
      const contentEnd = next ? next.index : notes.length;
      const content = notes.substring(contentStart, contentEnd).trim();

      // Always create a section, even with empty content
      sections.push({ timestamp: current.timestamp, content });
    }

    return sections;
  };

  // Helper function to format notes for display
  const formatNotesForDisplay = (notes: string | null): string => {
    if (!notes || notes.trim() === '') return '';
    
    const sections = parseNotes(notes);
    if (sections.length === 0) return notes;
    
    return sections.map(section => `{${section.timestamp}}\n${section.content}`).join('\n\n');
  };

  async function handleSaveNote(text?: string, bookId?: string) {
    const targetBookId = bookId || activeBook?.id;
    if (!targetBookId || !user) return;

    const currentText = text !== undefined ? text : noteText;
    const textToSave = currentText.trim() || null;

    try {
      const { error } = await supabase
        .from('books')
        .update({
          notes: textToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetBookId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBooks(prev => prev.map(book =>
        book.id === targetBookId ? { ...book, notes: textToSave } : book
      ));
    } catch (err) {
      console.error('Error saving note:', err);
    }
  }

  // Toggle follow/unfollow for the currently viewed user
  async function handleToggleFollow() {
    if (!viewingUserId || !user) return;

    setIsFollowLoading(true);
    try {
      if (isFollowingViewingUser) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', viewingUserId);

        if (error) {
          console.error('Error unfollowing:', error);
          return;
        }
        setIsFollowingViewingUser(false);
        setMyFollowingCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: viewingUserId,
          });

        if (error) {
          console.error('Error following:', error);
          return;
        }
        setIsFollowingViewingUser(true);
        setMyFollowingCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setIsFollowLoading(false);
    }
  }

  // Show loading animation during initial auth check
  if (authLoading) {
    return <BookLoading />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Show loading animation while loading books (only if user is authenticated)
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
  
  // Previous gradient style (for fade out)
  const previousGradientStyle = previousGradient ? (() => {
    const [pr1, pg1, pb1, pr2, pg2, pb2] = previousGradient.split(',').map(Number);
    return {
      background: `linear-gradient(to bottom right, rgb(${pr1}, ${pg1}, ${pb1}), rgb(${pr2}, ${pg2}, ${pb2}))`,
    };
  })() : null;
  
  // Use background image for bookshelf, notes, account, and following pages
  const shouldUseBackgroundImage = showBookshelf || showBookshelfCovers || showNotesView || showAccountPage || showFollowingPage || showFeedPage;
  const backgroundImageStyle: React.CSSProperties = {
    backgroundImage: `url(${getAssetPath('/bg.webp')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
  
  // Glassmorphic style for cover page buttons (20% less opacity)
  const coverButtonGlassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.36)', // 0.45 * 0.8 = 0.36
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };

  // Standard glassmorphism style (for bookshelf, notes, account pages)
  const standardGlassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.21)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };
  
  // Blue glassmorphism for primary actions
  const blueGlassmorphicStyle: React.CSSProperties = {
    background: 'rgba(59, 130, 246, 0.85)',
    borderRadius: '999px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  };

  // Yellow glassmorphism for profile section
  const yellowGlassmorphicStyle: React.CSSProperties = {
    background: 'rgba(250, 204, 21, 0.25)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(250, 204, 21, 0.2)',
  };

  // Consistent glassmorphism style (less transparent for book page info cards)
  const glassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };
  
  // Less transparent glassmorphism style for book page summary box and section menus
  const bookPageGlassmorphicStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(9.4px)',
    WebkitBackdropFilter: 'blur(9.4px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  };
  
  return (
    <div className="fixed inset-0 text-slate-900 font-sans select-none overflow-hidden flex flex-col"
      style={{
        ...(shouldUseBackgroundImage ? backgroundImageStyle : { background: gradientStyle.background }),
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh', // Use dynamic viewport height for mobile (includes safe areas)
        minHeight: '-webkit-fill-available', // iOS Safari fallback
      } as React.CSSProperties}
    >
      {/* Tap zone for scroll-to-top (iOS status bar pattern) */}
      <div
        className="fixed top-0 left-0 right-0 h-[44px] z-[9999]"
        onClick={scrollToTop}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      />

      {/* Gradient background - new gradient fades in first, then old fades out (only for book pages) */}
      {!shouldUseBackgroundImage && (
        <>
          {/* Previous gradient - stays at full opacity until new one is ready, then fades out */}
          {previousGradient && previousGradientStyle && (
            <motion.div
              key={`gradient-prev-${previousGradient}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pointer-events-none z-0"
              style={{
                ...previousGradientStyle,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100dvh',
                minHeight: '-webkit-fill-available',
              } as React.CSSProperties}
              transition={{ duration: 0.4, ease: "easeInOut", delay: 0.4 }}
              onAnimationComplete={() => {
                // Only clear previous gradient after fade out animation completes
                if (!isGradientTransitioning) {
                  setPreviousGradient(null);
                }
              }}
            />
          )}
          {/* Current gradient - always visible, fades in when updated */}
          <motion.div
            key={`gradient-${books[selectedIndex]?.id || 'default'}-${backgroundGradient}`}
            initial={{ opacity: previousGradient ? 0 : 1 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              ...gradientStyle,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh', // Use dynamic viewport height for mobile (includes safe areas)
              minHeight: '-webkit-fill-available', // iOS Safari fallback
            } as React.CSSProperties}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
          {/* Background image overlay at 25% opacity */}
          <div
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${getAssetPath('/bg.webp')})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.45,
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '-webkit-fill-available',
            } as React.CSSProperties}
          />
        </>
      )}
      {/* Logo text header - shows on main views (bookshelf, feed, following, notes, book details) */}
      {!showAccountPage && !showSortingResults && !viewingUserId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
          }}
          className="fixed top-[20px] left-0 right-0 flex justify-center z-40 pointer-events-none"
        >
          <img
            src={getAssetPath('/logo_text.png')}
            alt="Logo"
            className="h-[20px] object-contain"
          />
        </motion.div>
      )}

      {/* Simple header - fades on scroll and during transitions (hidden on book pages) */}
      {!(!showBookshelf && !showBookshelfCovers && !showNotesView && !showAccountPage && !showSortingResults && !showFollowingPage && !showFeedPage) && (
      <AnimatePresence mode="wait">
        <motion.div
          key={showSortingResults ? 'sorting-results-header' : showNotesView ? 'notes-header' : showBookshelf ? 'bookshelf-header' : 'books-header'}
          initial={{ opacity: 0 }}
          animate={{
            opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
            pointerEvents: scrollY > 60 ? 'none' : 'auto'
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full z-40 fixed top-[50px] left-0 right-0 px-4 py-3 flex items-center justify-between"
          style={{
            background: 'transparent'
          }}
        >
          {/* BOOKS/BOOKSHELF/NOTES text on left with icon */}
          <div className="flex items-center gap-3">
            {viewingUserId ? (
              <motion.button
                initial={{ opacity: 1 }}
                animate={{ opacity: isFadingOutViewingUser ? 0 : 1 }}
                onClick={() => {
                  setIsFadingOutViewingUser(true);
                  setTimeout(() => {
                    setViewingUserId(null);
                    setViewingUserBooks([]);
                    setViewingUserName('');
                    setViewingUserFullName(null);
                    setViewingUserAvatar(null);
                    setIsFadingOutViewingUser(false);
                  }, 300);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ ...standardGlassmorphicStyle, borderRadius: '50%' }}
              >
                <ChevronLeft size={18} className="text-slate-950" />
              </motion.button>
            ) : (showNotesView || showFollowingPage) && (
              <button
                onClick={() => {
                  setScrollY(0);
                  setShowBookshelfCovers(true);
                  setShowNotesView(false);
                  setShowFollowingPage(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                style={{ ...standardGlassmorphicStyle, borderRadius: '50%' }}
              >
                <ChevronLeft size={18} className="text-slate-950" />
              </button>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={
                  viewingUserId ? `user-${viewingUserId}` :
                  isShowingNotes ? 'notes-editor' :
                  showAccountPage ? 'account' :
                  showFollowingPage ? 'following' :
                  showFeedPage ? 'feed' :
                  showSortingResults ? 'sorted' :
                  showNotesView ? 'notes' :
                  showBookshelfCovers ? 'bookshelf-covers' :
                  showBookshelf ? 'bookshelf' :
                  'books'
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                {isShowingNotes && activeBook ? (
                  <Pencil size={24} className="text-slate-950" />
                ) : showAccountPage ? (
                  <User size={24} className="text-slate-950" />
                ) : showFollowingPage ? (
                  <Users size={24} className="text-slate-950" />
                ) : showFeedPage ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/feed.svg")} alt="Feed" className="w-[24px] h-[24px]" />
                  ) : (
                    <Birdhouse size={24} className="text-slate-950" />
                  )
                ) : showSortingResults ? (
                  <Star size={24} className="text-slate-950" />
                ) : showNotesView ? (
                  <Pencil size={24} className="text-slate-950" />
                ) : showBookshelfCovers ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/library.svg")} alt="Library" className="w-[24px] h-[24px]" />
                  ) : (
                    <Library size={24} className="text-slate-950" />
                  )
                ) : showBookshelf ? (
                  featureFlags.hand_drawn_icons ? (
                    <img src={getAssetPath("/library.svg")} alt="Library" className="w-[24px] h-[24px]" />
                  ) : (
                    <Library size={24} className="text-slate-950" />
                  )
                ) : (
                  <BookOpen size={24} className="text-slate-950" />
                )}
                <h1 className="text-2xl font-bold text-slate-950 drop-shadow-sm">
                  {viewingUserId
                    ? (viewingUserFullName || viewingUserName).toUpperCase()
                    : showAccountPage
                      ? 'ACCOUNT'
                      : showFollowingPage
                        ? 'FOLLOWING'
                        : showFeedPage
                          ? 'FEED'
                          : showSortingResults
                            ? 'SORTED RESULTS'
                            : showNotesView
                              ? 'NOTES'
                              : showBookshelfCovers
                                ? 'BOOKSHELF'
                                : showBookshelf
                                  ? 'BOOKSHELF'
                                  : 'BOOKS'}
                </h1>
              </motion.div>
            </AnimatePresence>
          </div>
        
        {/* Back button when on account page or sorting results */}
        {(showAccountPage || showSortingResults) && (
          <button
            onClick={() => {
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
            style={{ ...glassmorphicStyle, borderRadius: '50%' }}
          >
            <ChevronLeft size={18} className="text-slate-950" />
          </button>
        )}

        {/* Info button when on bookshelf (not when viewing another user) */}
        {(showBookshelf || showBookshelfCovers) && !showAccountPage && !showSortingResults && !showFollowingPage && !showNotesView && !showFeedPage && !viewingUserId && (
          <button
            onClick={() => setShowAboutScreen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
            style={{ ...glassmorphicStyle, borderRadius: '50%' }}
          >
            <Info size={18} className="text-slate-950" />
          </button>
        )}
        </motion.div>
      </AnimatePresence>
      )}

      <AnimatePresence mode="wait">
        {showAccountPage ? (
          <motion.main
            key="account"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Account Page */}
            <div className="w-full max-w-[600px] flex flex-col gap-4 px-4 py-8">
              {/* User Info Card */}
              <div className="rounded-2xl p-6" style={standardGlassmorphicStyle}>
                <div className="flex items-center gap-4 mb-6">
                  {userAvatar ? (
                    <img 
                      src={userAvatar} 
                      alt={userName}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white/50"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center border-2 border-white/50">
                      <span className="text-2xl font-bold text-slate-600">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{userName}</h2>
                    <p className="text-sm text-slate-600">{user?.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Total Books</p>
                    <p className="text-2xl font-bold text-slate-950">{books.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 mb-1">Books with Ratings</p>
                    <p className="text-2xl font-bold text-slate-950">
                      {books.filter(book => {
                        const values = Object.values(book.ratings).filter(v => v != null) as number[];
                        return values.length > 0;
                      }).length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Privacy</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Public lets others view your bookshelf and see your added books in their feed.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user || isSavingPrivacySetting) return;
                      const nextValue = !isProfilePublic;
                      setIsProfilePublic(nextValue);
                      setIsSavingPrivacySetting(true);
                      try {
                        const { data, error } = await supabase
                          .from('users')
                          .update({ is_public: nextValue })
                          .eq('id', user.id)
                          .select('id')
                          .maybeSingle();

                        if (error || !data) {
                          const { error: upsertError } = await supabase
                            .from('users')
                            .upsert({
                              id: user.id,
                              email: user.email,
                              full_name: user.user_metadata?.full_name || null,
                              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
                              is_public: nextValue,
                            }, { onConflict: 'id' });

                          if (upsertError) {
                            console.error('[Account] Error saving privacy setting:', upsertError);
                            setIsProfilePublic(!nextValue);
                          }
                        }
                      } catch (err) {
                        console.error('[Account] Error saving privacy setting:', err);
                        setIsProfilePublic(!nextValue);
                      } finally {
                        setIsSavingPrivacySetting(false);
                      }
                    }}
                    disabled={isLoadingPrivacySetting || isSavingPrivacySetting}
                    className={`min-w-[88px] px-3 py-2 text-xs font-bold rounded-full transition-all ${
                      isProfilePublic
                        ? 'text-white active:scale-95'
                        : 'text-slate-700 hover:opacity-80 active:scale-95'
                    } ${isLoadingPrivacySetting || isSavingPrivacySetting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={isProfilePublic ? blueGlassmorphicStyle : glassmorphicStyle}
                  >
                    {isLoadingPrivacySetting ? 'Loading...' : isProfilePublic ? 'Public' : 'Private'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Private hides your bookshelf and removes your added books from other users' feeds.
                </p>
              </div>

              {/* Grok API Usage Logs */}
              <div className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
                <h3 className="text-sm font-bold text-slate-950 mb-3">Grok API Usage</h3>
                {isLoadingGrokLogs ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="w-16 h-4 bg-slate-300/50 rounded animate-pulse" />
                      <div className="w-12 h-4 bg-slate-300/50 rounded animate-pulse" />
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="py-1 border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="w-28 h-3 bg-slate-300/50 rounded animate-pulse" />
                          <div className="w-20 h-3 bg-slate-300/50 rounded animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="w-16 h-3 bg-slate-300/50 rounded animate-pulse" />
                          <div className="w-12 h-3 bg-slate-300/50 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : grokUsageLogs.length === 0 ? (
                  <p className="text-xs text-slate-600">No API requests yet</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs mb-3 pb-2 border-b border-slate-200">
                      <span className="text-slate-600">Total Cost:</span>
                      <span className="font-bold text-slate-950">
                        ${grokUsageLogs.reduce((sum, log) => sum + log.estimatedCost, 0).toFixed(4)}
                      </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto ios-scroll space-y-1">
                      {grokUsageLogs.map((log, idx) => {
                        const date = new Date(log.timestamp);
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={idx} className="text-xs text-slate-700 py-1 border-b border-slate-100 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{log.function}</span>
                              <span className="text-slate-500">{dateStr} {timeStr}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-slate-600">
                                {log.totalTokens.toLocaleString()} tokens
                              </span>
                              <span className="font-medium text-slate-950">
                                ${log.estimatedCost.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={async () => {
                  await signOut();
                  setShowAccountPage(false);
                }}
                className="flex items-center gap-2 text-xs font-bold text-blue-700 hover:bg-blue-50 active:scale-95 transition-all px-3 py-1.5 rounded"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.main>
        ) : showFollowingPage ? (
          <motion.main
            key="following"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Following Page */}
            <div className="w-full max-w-[600px] flex flex-col gap-4 px-4 py-8">
              {isLoadingFollowing ? (
                <motion.div
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-full rounded-2xl p-4 flex items-center gap-4"
                  style={standardGlassmorphicStyle}
                >
                  {/* Avatar skeleton */}
                  <div className="w-12 h-12 rounded-full bg-slate-300/50 animate-pulse" />
                  {/* Name/email skeleton */}
                  <div className="flex-1 min-w-0">
                    <div className="w-32 h-5 bg-slate-300/50 rounded animate-pulse mb-2" />
                    <div className="w-24 h-4 bg-slate-300/50 rounded animate-pulse" />
                  </div>
                  {/* Chevron skeleton */}
                  <div className="w-5 h-5 bg-slate-300/50 rounded animate-pulse" />
                </motion.div>
              ) : followingUsers.length === 0 ? (
                <div className="rounded-2xl p-6 text-center" style={standardGlassmorphicStyle}>
                  <Users size={48} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600">You're not following anyone yet.</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Find readers in the community and follow them to see their books here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Sort Button */}
                  <div className="flex justify-start mb-2">
                    <button
                      onClick={() => {
                        const order: Array<'recent_desc' | 'recent_asc' | 'name_desc' | 'name_asc'> = ['recent_desc', 'recent_asc', 'name_asc', 'name_desc'];
                        const currentIndex = order.indexOf(followingSortOrder);
                        const nextIndex = (currentIndex + 1) % order.length;
                        setFollowingSortOrder(order[nextIndex]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 hover:opacity-80 active:scale-95"
                      style={standardGlassmorphicStyle}
                    >
                      <span>
                        {followingSortOrder === 'recent_desc' ? 'Recent ↓' :
                         followingSortOrder === 'recent_asc' ? 'Recent ↑' :
                         followingSortOrder === 'name_asc' ? 'Name A-Z' : 'Name Z-A'}
                      </span>
                    </button>
                  </div>
                  {[...followingUsers].sort((a, b) => {
                    const nameA = (a.full_name || a.email).toLowerCase();
                    const nameB = (b.full_name || b.email).toLowerCase();
                    if (followingSortOrder === 'recent_desc') {
                      return new Date(b.followed_at).getTime() - new Date(a.followed_at).getTime();
                    } else if (followingSortOrder === 'recent_asc') {
                      return new Date(a.followed_at).getTime() - new Date(b.followed_at).getTime();
                    } else if (followingSortOrder === 'name_asc') {
                      return nameA.localeCompare(nameB);
                    } else {
                      return nameB.localeCompare(nameA);
                    }
                  }).map((followedUser) => (
                    <button
                      key={followedUser.id}
                      onClick={() => {
                        setViewingUserId(followedUser.id);
                        setShowFollowingPage(false);
                        setShowFeedPage(false);
                        setShowBookshelf(false);
                        setShowBookshelfCovers(true);
                        setShowNotesView(false);
                        setShowAccountPage(false);
                        setShowSortingResults(false);
                      }}
                      className="w-full rounded-2xl p-4 flex items-center gap-4 hover:opacity-90 active:scale-[0.98] transition-all text-left"
                      style={standardGlassmorphicStyle}
                    >
                      {followedUser.avatar_url ? (
                        <img
                          src={followedUser.avatar_url}
                          alt={followedUser.full_name || followedUser.email}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-300 flex items-center justify-center border-2 border-white/50">
                          <span className="text-lg font-bold text-purple-700">
                            {(followedUser.full_name || followedUser.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-950 truncate">
                          {followedUser.full_name || followedUser.email.split('@')[0]}
                        </p>
                        {followedUser.full_name && (
                          <p className="text-sm text-slate-600 truncate">{followedUser.email}</p>
                        )}
                      </div>
                      <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.main>
        ) : showFeedPage ? (
          <motion.main
            key="feed"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);

              // Infinite scroll: load more when within 300px of bottom
              if (
                hasMoreFeedItems &&
                !isLoadingMoreFeed &&
                target.scrollHeight - target.scrollTop - target.clientHeight < 300
              ) {
                setIsLoadingMoreFeed(true);
                const nextCount = Math.min(feedDisplayCount + 8, filteredFeedItems.length);
                const newItems = filteredFeedItems.slice(feedDisplayCount, nextCount);
                if (newItems.length > 0) {
                  markFeedItemsAsShown(newItems.map(item => item.id));
                }
                setFeedDisplayCount(nextCount);
                setIsLoadingMoreFeed(false);
              }
            }}
          >
            {/* Feed Page */}
            <div className="w-full flex flex-col gap-4 px-3 pt-8">
              {/* Feed filter pills */}
              <div key={`filters-${feedFilter}`} className="flex items-center gap-2 mb-1">
                {/* Read status filter */}
                {/* All button */}
                <button
                  onClick={() => setFeedFilter('all')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                  style={feedFilter === 'all' ? {
                    background: '#0f172a',
                    color: 'white',
                  } : {
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#475569',
                  }}
                >
                  All
                </button>
                {/* Unread button */}
                {(() => {
                  const unreadCount = personalizedFeedItems.filter(item => !item.read).length;
                  return (
                    <button
                      onClick={() => setFeedFilter('unread')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                      style={feedFilter === 'unread' ? {
                        background: '#0f172a',
                        color: 'white',
                      } : {
                        background: 'rgba(255, 255, 255, 0.45)',
                        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                        backdropFilter: 'blur(9.4px)',
                        WebkitBackdropFilter: 'blur(9.4px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#475569',
                      }}
                    >
                      {unreadCount > 0 && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: feedFilter === 'unread' ? 'white' : '#3b82f6' }}
                        />
                      )}
                      Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
                    </button>
                  );
                })()}
                {/* Type filter dropdown */}
                <div className="relative" ref={feedTypeDropdownRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFeedTypeDropdownOpen(!isFeedTypeDropdownOpen);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-slate-700"
                    style={feedCardStyle}
                  >
                    <span>
                      {feedTypeFilter === 'all' ? 'All Types' :
                       feedTypeFilter === 'fact' ? 'Facts' :
                       feedTypeFilter === 'context' ? 'Context' :
                       feedTypeFilter === 'drilldown' ? 'Insights' :
                       feedTypeFilter === 'influence' ? 'Influences' :
                       feedTypeFilter === 'podcast' ? 'Podcasts' :
                       feedTypeFilter === 'article' ? 'Articles' :
                       feedTypeFilter === 'related_book' ? 'Books' :
                       feedTypeFilter === 'video' ? 'Videos' :
                       feedTypeFilter === 'friend_book' ? 'Friends' : 'All Types'}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isFeedTypeDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isFeedTypeDropdownOpen && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsFeedTypeDropdownOpen(false)}
                      />
                      {/* Menu */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-1 z-40 rounded-lg min-w-[120px] overflow-hidden"
                        style={feedCardStyle}
                      >
                        {[
                          { value: 'all', label: 'All Types', enabled: true },
                          { value: 'fact', label: 'Facts', enabled: featureFlags.insights.author_facts },
                          { value: 'context', label: 'Context', enabled: featureFlags.insights.book_context },
                          { value: 'drilldown', label: 'Insights', enabled: featureFlags.insights.book_domain },
                          { value: 'influence', label: 'Influences', enabled: featureFlags.insights.book_influences },
                          { value: 'did_you_know', label: 'Did You Know?', enabled: featureFlags.insights.did_you_know },
                          { value: 'podcast', label: 'Podcasts', enabled: true },
                          { value: 'article', label: 'Articles', enabled: true },
                          { value: 'related_book', label: 'Books', enabled: true },
                          { value: 'video', label: 'Videos', enabled: true },
                          { value: 'friend_book', label: 'Friends', enabled: true },
                        ].filter(option => option.enabled).map((option, idx, filteredArray) => (
                          <button
                            key={option.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedTypeFilter(option.value as typeof feedTypeFilter);
                              setFeedDisplayCount(8);
                              setIsFeedTypeDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                              feedTypeFilter === option.value
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-white/30'
                            } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === filteredArray.length - 1 ? 'rounded-b-lg' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </div>
              </div>

              {/* Loading skeleton */}
              {isLoadingPersonalizedFeed && (
                <>
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={`skeleton-${i}`}
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                      className="w-full rounded-2xl overflow-hidden"
                      style={feedCardStyle}
                    >
                      {/* Header skeleton */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-slate-300/50" />
                        <div className="flex-1">
                          <div className="w-24 h-4 bg-slate-300/50 rounded mb-1" />
                          <div className="w-32 h-3 bg-slate-300/50 rounded" />
                        </div>
                        <div className="w-12 h-3 bg-slate-300/50 rounded" />
                      </div>
                      {/* Content skeleton */}
                      <div className="px-4 pb-4">
                        <div className="bg-white/40 rounded-xl p-3 mb-3">
                          <div className="w-full h-4 bg-slate-300/50 rounded mb-2" />
                          <div className="w-3/4 h-4 bg-slate-300/50 rounded" />
                        </div>
                        {/* Source book skeleton */}
                        <div className="flex items-center gap-3 bg-white/30 rounded-xl p-2">
                          <div className="w-10 h-14 bg-slate-300/50 rounded-lg" />
                          <div className="flex-1">
                            <div className="w-12 h-3 bg-slate-300/50 rounded mb-1" />
                            <div className="w-24 h-4 bg-slate-300/50 rounded mb-1" />
                            <div className="w-20 h-3 bg-slate-300/50 rounded" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}

              {/* Empty state - no feed items at all */}
              {!isLoadingPersonalizedFeed && personalizedFeedItems.length === 0 && (
                <div
                  className="w-full rounded-2xl overflow-hidden p-8 text-center"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Birdhouse size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-800 font-medium mb-2">Your feed is empty</p>
                  <p className="text-sm text-slate-500">Add books and mark them as read to see personalized content here.</p>
                </div>
              )}

              {/* Empty state - filters resulted in no items */}
              {!isLoadingPersonalizedFeed && personalizedFeedItems.length > 0 && filteredFeedItems.length === 0 && (
                <div
                  className="w-full rounded-2xl overflow-hidden p-8 text-center"
                  style={{
                    background: 'rgba(255, 255, 255, 0.45)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Birdhouse size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-slate-800 font-medium mb-2">No matching items</p>
                  <p className="text-sm text-slate-500">Try adjusting your filters to see more content.</p>
                </div>
              )}

              {/* Dynamic Feed Items */}
              <AnimatePresence mode="popLayout">
              {!isLoadingPersonalizedFeed && displayedFeedItems.map((item) => {
                // Helper to render read toggle button
                // Unread = blue dot, Read = empty circle
                const ReadToggle = () => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newRead = !item.read;
                      setFeedItemReadStatus(item.id, newRead);
                      setPersonalizedFeedItems(prev =>
                        prev.map(fi => fi.id === item.id ? { ...fi, read: newRead } : fi)
                      );
                    }}
                    className="ml-1 p-1.5 rounded-full hover:bg-white/30 transition-colors flex items-center justify-center"
                    title={item.read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {item.read ? (
                      <Circle size={14} className="text-slate-400" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
                const cardOpacity = item.read ? 'opacity-60' : '';
                const openSourceBookOverlay = () => {
                  const bookForModal: BookWithRatings = {
                    id: `feed-source-${item.id}`,
                    user_id: user?.id || '',
                    title: item.source_book_title || 'Book',
                    author: item.source_book_author || 'Unknown Author',
                    cover_url: item.source_book_cover_url || null,
                    publish_year: null,
                    wikipedia_url: null,
                    google_books_url: null,
                    genre: null,
                    first_issue_year: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    reading_status: null,
                    ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                  };
                  setViewingBookFromOtherUser(bookForModal);
                };

                // Render based on type
                switch (item.type) {
                  case 'fact':
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                            <Lightbulb size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Insights</p>
                            <p className="text-xs text-slate-500">Interesting facts about this book</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-white/40 rounded-xl px-3 py-2 mb-3">
                            <p className="text-sm text-slate-700">{item.content.fact}</p>
                          </div>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">About</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'context':
                    const contextData = item.content.insight;
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(20, 184, 166, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
                            <Info size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Context</p>
                            <p className="text-xs text-slate-500">The world behind your book</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-white/40 rounded-xl p-3 mb-3">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {typeof contextData === 'string' ? contextData : contextData?.text || JSON.stringify(contextData)}
                            </p>
                          </div>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">Context for</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'drilldown':
                    const drilldownData = item.content.insight;
                    const domainLabel = item.content.domain_label || 'Domain';
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(244, 63, 94, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                            {featureFlags.hand_drawn_icons ? (
                              <img src={getAssetPath("/search.svg")} alt="Search" className="w-[20px] h-[20px] invert" />
                            ) : (
                              <Search size={20} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Deep Dive</p>
                            <p className="text-xs text-slate-500">{domainLabel}</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-3 mb-3 border border-rose-100">
                            <p className="text-sm text-slate-700 leading-relaxed">
                              {typeof drilldownData === 'string' ? drilldownData : drilldownData?.text || JSON.stringify(drilldownData)}
                            </p>
                          </div>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">From</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'influence':
                    const influenceData = item.content.influence;
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            <BookMarked size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Influences</p>
                            <p className="text-xs text-slate-500">Books that shaped your read</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-white/40 rounded-xl px-3 py-2 mb-3">
                            <p className="text-sm text-slate-700">
                              {typeof influenceData === 'string' ? influenceData : influenceData?.title || JSON.stringify(influenceData)}
                            </p>
                          </div>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">Influenced</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'podcast':
                    const episode = item.content.episode;
                    const podcastAudioUrl = episode?.audioUrl || (episode?.url && episode.url.match(/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i) ? episode.url : null);
                    const isPodcastPlaying = feedPlayingAudioUrl === (podcastAudioUrl || episode?.url);
                    return (
                      <motion.div key={item.id} initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                            <Headphones size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Podcasts</p>
                            <p className="text-xs text-slate-500">Podcast about this book</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="flex gap-3 mb-3">
                            {/* Podcast thumbnail */}
                            <div className="relative w-20 h-20 flex-shrink-0">
                              {episode?.thumbnail ? (
                                <img src={episode.thumbnail} alt={episode.title} className="w-full h-full rounded-xl object-cover" />
                              ) : (
                                <div className="w-full h-full rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center">
                                  <Headphones size={28} className="text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-sm line-clamp-2">{episode?.title || 'Podcast Episode'}</p>
                              <p className="text-xs text-slate-500 mt-1">{episode?.podcast_name || 'Podcast'}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFeedPodcastPlay(episode);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                                >
                                  {isPodcastPlaying ? (
                                    <>
                                      <VolumeX size={12} />
                                      Stop
                                    </>
                                  ) : (
                                    <>
                                      <Play size={12} />
                                      Preview
                                    </>
                                  )}
                                </button>
                                {episode?.url && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(episode.url, '_blank');
                                    }}
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium active:scale-95 transition-transform"
                                  >
                                    <ExternalLink size={12} />
                                    Link
                                  </button>
                                )}
                                {episode?.length && (
                                  <span className="text-xs text-slate-400">{episode.length}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Episode description preview */}
                          {episode?.episode_summary && (
                            <div className="mb-3">
                              <p className={`text-sm text-slate-700 leading-relaxed ${!feedPodcastExpandedMap.get(item.id) ? 'line-clamp-2' : ''}`}>
                                {episode.episode_summary}
                              </p>
                              {episode.episode_summary.length > 100 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFeedPodcastExpandedMap(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(item.id, !prev.get(item.id));
                                      return newMap;
                                    });
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                                >
                                  {feedPodcastExpandedMap.get(item.id) ? 'Show less' : 'Read more'}
                                </button>
                              )}
                            </div>
                          )}
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">About</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'video':
                    const video = item.content.video;
                    const videoId = video?.videoId || video?.id;
                    const isVideoPlaying = feedPlayingVideoId === videoId;
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <Play size={20} className="text-white ml-0.5" fill="white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Videos</p>
                            <p className="text-xs text-slate-500">Videos about the book and its author</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        {isVideoPlaying ? (
                          <div className="relative w-full aspect-video bg-black">
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                            <button
                              onClick={() => setFeedPlayingVideoId(null)}
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                            >
                              <X size={16} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setFeedPlayingVideoId(videoId)} className="block w-full text-left">
                            <div className="relative w-full aspect-video bg-slate-900">
                              {video?.thumbnail && (
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                              )}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                                  <Play size={24} className="text-white ml-1" fill="white" />
                                </div>
                              </div>
                            </div>
                          </button>
                        )}
                        <div className="px-4 py-3">
                          <p className="font-bold text-slate-900 text-sm mb-3 line-clamp-2">{video?.title || 'YouTube Video'}</p>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">About</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'related_book':
                    const relatedBook = item.content.related_book;
                    const handleRelatedBookClick = () => {
                      if (!relatedBook) return;
                      // Create a BookWithRatings object from the related book
                      const bookForModal: BookWithRatings = {
                        id: `related-${item.id}`,
                        user_id: user?.id || '',
                        title: relatedBook.title || 'Related Book',
                        author: relatedBook.author || 'Unknown Author',
                        cover_url: relatedBook.cover_url || null,
                        publish_year: null,
                        wikipedia_url: null,
                        google_books_url: null,
                        genre: null,
                        first_issue_year: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        reading_status: null,
                        ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                      };
                      setViewingBookFromOtherUser(bookForModal);
                    };
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <BookMarked size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Related Books</p>
                            <p className="text-xs text-slate-500">Similar books you might enjoy</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <button
                            onClick={handleRelatedBookClick}
                            className="w-full text-left active:scale-[0.98] transition-transform"
                          >
                            <div className="flex gap-4">
                              {relatedBook?.cover_url ? (
                                <img src={relatedBook.cover_url} alt={relatedBook.title} className="w-24 h-36 object-cover rounded-lg flex-shrink-0 shadow-md" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                              ) : (
                                <div className="w-24 h-36 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md">
                                  <BookOpen size={28} className="text-slate-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <p className="font-bold text-slate-900 text-lg leading-tight">{decodeHtmlEntities(relatedBook?.title || 'Related Book')}</p>
                                <p className="text-sm text-slate-600 mt-0.5">{decodeHtmlEntities(relatedBook?.author || 'Unknown Author')}</p>
                                {relatedBook?.reason && (
                                  <p className="text-sm text-slate-700 mt-2 leading-snug">{decodeHtmlEntities(relatedBook.reason)}</p>
                                )}
                              </div>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'article':
                    const article = item.content.article;
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                            <FileText size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Articles</p>
                            <p className="text-xs text-slate-500">Academic article about this book</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          <div className="bg-white/40 rounded-xl p-3 mb-3">
                            <p className="font-semibold text-slate-800 text-sm mb-1">{decodeHtmlEntities(article?.title || 'Article')}</p>
                            {article?.snippet && (
                              <p className="text-xs text-slate-600 line-clamp-2">{decodeHtmlEntities(article.snippet)}</p>
                            )}
                            {article?.url && (
                              <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
                                <ExternalLink size={12} />
                                Read article
                              </a>
                            )}
                          </div>
                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">About</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  case 'friend_book':
                    const handleFriendBookAdd = () => {
                      const bookForModal: BookWithRatings = {
                        id: `friend-${item.id}`,
                        user_id: user?.id || '',
                        title: item.source_book_title || 'Book',
                        author: item.source_book_author || 'Unknown Author',
                        cover_url: item.source_book_cover_url || null,
                        publish_year: null,
                        wikipedia_url: null,
                        google_books_url: null,
                        genre: null,
                        first_issue_year: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        reading_status: null,
                        ratings: { writing: null, insights: null, flow: null, world: null, characters: null },
                      };
                      setViewingBookFromOtherUser(bookForModal);
                    };
                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                            <Users size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">A friend added a book</p>
                            <p className="text-xs text-slate-500">{item.content.action || 'added'}</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        {item.source_book_cover_url ? (
                          <div className="relative w-full aspect-[3/4]">
                            <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-full h-full object-cover" />
                            <button
                              onClick={handleFriendBookAdd}
                              className="absolute bottom-2 right-2 text-white text-xs font-bold rounded-full transition-all active:scale-95 px-3 py-1.5"
                              style={blueGlassmorphicStyle}
                            >
                              Add book
                            </button>
                          </div>
                        ) : null}
                        <div className="px-4 py-3">
                          <p className="font-bold text-slate-900">{item.source_book_title}</p>
                          <p className="text-sm text-slate-600">{item.source_book_author}</p>
                          {item.content.description && (
                            <div className="mt-2">
                              <p className={`text-sm text-slate-700 leading-relaxed ${
                                expandedFeedDescriptions.has(item.id) ? '' : 'line-clamp-4'
                              }`}>
                                {item.content.description}
                              </p>
                              {item.content.description.length > 200 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFeedDescriptions(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) {
                                        next.delete(item.id);
                                      } else {
                                        next.add(item.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="text-blue-600 text-sm font-medium mt-1"
                                >
                                  {expandedFeedDescriptions.has(item.id) ? 'Show less' : 'Read more'}
                                </button>
                              )}
                            </div>
                          )}
                          {!item.source_book_cover_url && (
                            <button
                              onClick={handleFriendBookAdd}
                              className="mt-3 text-white text-xs font-bold rounded-full transition-all active:scale-95 px-3 py-1.5"
                              style={blueGlassmorphicStyle}
                            >
                              Add book
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );

                  case 'did_you_know':
                    // "Did you know?" item with 3 notes shown together with pagination dots
                    const didYouKnowNotes: string[] = item.content.notes || [];
                    const currentNoteIdx = didYouKnowNoteIndex.get(item.id) || 0;

                    // Helper functions for navigation
                    const goToNextNote = () => {
                      setDidYouKnowNoteIndex(prev => {
                        const newMap = new Map(prev);
                        newMap.set(item.id, (currentNoteIdx + 1) % didYouKnowNotes.length);
                        return newMap;
                      });
                    };
                    const goToPrevNote = () => {
                      setDidYouKnowNoteIndex(prev => {
                        const newMap = new Map(prev);
                        newMap.set(item.id, currentNoteIdx > 0 ? currentNoteIdx - 1 : didYouKnowNotes.length - 1);
                        return newMap;
                      });
                    };

                    // Swipe detection state (using data attributes to avoid React state in render)
                    let touchStartX = 0;
                    let touchStartY = 0;

                    return (
                      <motion.div key={item.id} layout initial={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ duration: 0.3 }} className={`w-full rounded-2xl overflow-hidden ${cardOpacity}`} style={feedCardStyle}>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(6, 182, 212, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                            <Lightbulb size={20} className="text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 text-sm">Insights</p>
                            <p className="text-xs text-slate-500">Interesting facts about this book</p>
                          </div>
                          <p className="text-xs text-slate-400">{timeAgo(item.created_at)}</p>
                          <ReadToggle />
                        </div>
                        <div className="px-4 pb-4">
                          {/* Notes carousel with pagination dots inside - tap to advance, swipe to navigate */}
                          <div
                            className="rounded-xl p-4 mb-3 min-h-[100px] cursor-pointer select-none active:opacity-80 transition-opacity"
                            style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              backdropFilter: 'blur(9.4px)',
                              WebkitBackdropFilter: 'blur(9.4px)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                            onClick={(e) => {
                              // Don't trigger if clicking on pagination dots
                              if ((e.target as HTMLElement).closest('button')) return;
                              goToNextNote();
                            }}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              touchStartX = touch.clientX;
                              touchStartY = touch.clientY;
                            }}
                            onTouchEnd={(e) => {
                              const touch = e.changedTouches[0];
                              const deltaX = touch.clientX - touchStartX;
                              const deltaY = touch.clientY - touchStartY;
                              const minSwipeDistance = 50;

                              // Only handle horizontal swipes (ignore vertical scrolling)
                              if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                                e.preventDefault();
                                if (deltaX < 0) {
                                  // Swipe left = next
                                  goToNextNote();
                                } else {
                                  // Swipe right = previous
                                  goToPrevNote();
                                }
                              }
                            }}
                          >
                            <AnimatePresence mode="wait">
                              <motion.p
                                key={currentNoteIdx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="text-sm text-slate-700 leading-relaxed"
                              >
                                {didYouKnowNotes[currentNoteIdx] || ''}
                              </motion.p>
                            </AnimatePresence>

                            {/* Pagination dots inside the note box */}
                            {didYouKnowNotes.length > 1 && (
                              <div className="flex justify-center gap-2 mt-4 pt-3 border-t border-slate-200/50">
                                {didYouKnowNotes.map((_, idx) => (
                                  <button
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDidYouKnowNoteIndex(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(item.id, idx);
                                        return newMap;
                                      });
                                    }}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                      idx === currentNoteIdx
                                        ? 'bg-blue-500 w-4'
                                        : 'bg-slate-300 hover:bg-slate-400'
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={openSourceBookOverlay}
                            className="w-full text-left flex items-center gap-3 bg-white/30 rounded-xl p-2 active:scale-[0.98] transition-transform"
                          >
                            {item.source_book_cover_url ? (
                              <img src={item.source_book_cover_url} alt={item.source_book_title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }} />
                            ) : (
                              <div className="w-10 h-14 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center"><BookOpen size={16} className="text-slate-400" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500">About</p>
                              <p className="text-sm font-medium text-slate-800 truncate">{item.source_book_title}</p>
                              <p className="text-xs text-slate-500 truncate">{item.source_book_author}</p>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    );

                  default:
                    return null;
                }
              })}
              </AnimatePresence>

              {/* Load more indicator */}
              {hasMoreFeedItems && !isLoadingPersonalizedFeed && (
                <div className="w-full flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                </div>
              )}

              {/* End of feed */}
              {!isLoadingPersonalizedFeed && !hasMoreFeedItems && displayedFeedItems.length > 0 && (
                <p className="text-center text-xs text-slate-400 py-4">You've reached the end</p>
              )}

            </div>
          </motion.main>
        ) : showSortingResults ? (
          <motion.main
            key="sorting-results"
            ref={(el) => { scrollContainerRef.current = el; }}
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
            {/* Sorting Results View */}
            <div className="w-full max-w-[600px] flex flex-col gap-4 px-4 py-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-slate-950">RANKED BY YOU</h1>
                <button
                  onClick={() => {
                    // Reset merge sort state to replay
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('bookMergeSortState');
                      localStorage.removeItem('bookComparisonResults');
                    }
                    // Close results view and start new game
                    setShowSortingResults(false);
                    // The Play button will now be available again
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                >
                  <Play size={14} />
                  <span>Replay</span>
                </button>
              </div>
              {(() => {
                const availableBooks = books.filter(b => b.reading_status === 'read_it');
                const sortedBooks = getSortedBooks(availableBooks);
                
                if (sortedBooks.length === 0) {
                  return (
                    <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-white/30 shadow-lg text-center">
                      <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-800 text-sm font-medium">No books to display</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    {sortedBooks.map((book: BookWithRatings, index: number) => (
                      <motion.div
                        key={book.id || `sorted-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/30 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                        onClick={() => {
                          const bookIndex = books.findIndex(b => b.id === book.id);
                          if (bookIndex !== -1) {
                            setSelectedIndex(bookIndex);
                            setShowSortingResults(false);
                          }
                        }}
                      >
                        <div className="flex gap-4 items-center">
                          {/* Rank Number */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-lg">
                            {index + 1}
                          </div>
                          
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
                          
                          {/* Book Info */}
                          <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-slate-950 mb-1 line-clamp-1">{book.title}</h2>
                            <p className="text-xs text-slate-600 mb-1">{book.author}</p>
                            {(() => {
                              const avgScore = calculateAvg(book.ratings);
                              if (avgScore) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <Star size={12} className="fill-amber-400 text-amber-400" />
                                    <span className="text-xs font-bold text-slate-700">{avgScore}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.main>
        ) : showNotesView ? (
          <motion.main
            key="notes"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Notes View */}
            <div className="w-full max-w-[600px] flex flex-col gap-4 px-4 py-8">
              {(() => {
                // Filter books with notes and sort by title
                const booksWithNotes = books
                  .filter(book => book.notes && book.notes.trim().length > 0)
                  .sort((a, b) => a.title.localeCompare(b.title));

                if (booksWithNotes.length === 0) {
                  return (
                    <div className="w-full rounded-2xl p-8 text-center" style={glassmorphicStyle}>
                      <Pencil size={32} className="mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-800 text-sm font-medium">No notes yet</p>
                      <p className="text-slate-600 text-xs mt-1">Add notes to your books to see them here</p>
                    </div>
                  );
                }

                return booksWithNotes.map((book, index) => (
                  <motion.div
                    key={book.id || `note-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-4 cursor-pointer hover:shadow-xl transition-shadow"
                    style={glassmorphicStyle}
                    onClick={() => {
                      // Only navigate if not editing
                      if (editingNoteBookId !== book.id) {
                        // Find book index and navigate to it, then open notes
                        const bookIndex = books.findIndex(b => b.id === book.id);
                        if (bookIndex !== -1) {
                          setShowNotesView(false);
                          setShowBookshelf(false);
                          setShowBookshelfCovers(false);
                          setShowAccountPage(false);
                          setShowFollowingPage(false);
                          setShowFeedPage(false);
                          if (bookIndex === selectedIndex) {
                            // Already on this book, just open notes directly
                            setIsShowingNotes(true);
                          } else {
                            // Different book — ref tells the selectedIndex useEffect to open notes
                            openNotesAfterNavRef.current = true;
                            setSelectedIndex(bookIndex);
                          }
                        }
                      }
                    }}
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
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
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
                            <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                              {book.notes}
                            </p>
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
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isFadingOutViewingUser ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Arrow Animation Overlay - only show on own bookshelf when grouped by status and no books in Reading */}
            {!viewingUserId && bookshelfGrouping === 'reading_status' && books.filter(b => b.reading_status === 'reading').length === 0 && <ArrowAnimation isBookshelfEmpty={booksForBookshelf.length === 0} />}

            {/* Bookshelf Covers View */}
            <div
              className="w-full flex flex-col items-center px-4"
            >
              {isLoadingViewingUserBooks ? (
                <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                  {/* Profile Skeleton */}
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-2xl p-4 mb-4"
                    style={glassmorphicStyle}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar skeleton */}
                      <div className="w-16 h-16 rounded-full bg-slate-300/50 animate-pulse" />
                      {/* Stats skeleton */}
                      <div className="flex-1 flex gap-6">
                        <div className="text-center">
                          <div className="w-8 h-7 bg-slate-300/50 rounded animate-pulse mx-auto mb-1" />
                          <div className="w-10 h-4 bg-slate-300/50 rounded animate-pulse mx-auto" />
                        </div>
                        <div className="text-center">
                          <div className="w-8 h-7 bg-slate-300/50 rounded animate-pulse mx-auto mb-1" />
                          <div className="w-14 h-4 bg-slate-300/50 rounded animate-pulse mx-auto" />
                        </div>
                      </div>
                      {/* Follow button skeleton */}
                      <div className="w-24 h-10 bg-slate-300/50 rounded-xl animate-pulse" />
                    </div>
                  </motion.div>
                  {/* Grouping selector skeleton */}
                  <div className="flex items-center justify-between px-4 mb-1.5">
                    <motion.div
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                      className="w-20 h-10 bg-slate-300/30 rounded-lg animate-pulse"
                    />
                  </div>
                  {/* Bookshelf group skeleton */}
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                    className="rounded-2xl p-4"
                    style={glassmorphicStyle}
                  >
                    <div className="w-24 h-5 bg-slate-300/50 rounded animate-pulse mb-4" />
                    <div className="flex gap-3 overflow-hidden">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex-shrink-0 w-[100px]">
                          <div className="w-full aspect-[2/3] bg-slate-300/50 rounded-lg animate-pulse mb-2" />
                          <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse mb-1" />
                          <div className="w-2/3 h-3 bg-slate-300/50 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                  {/* Second group skeleton */}
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                    className="rounded-2xl p-4"
                    style={glassmorphicStyle}
                  >
                    <div className="w-32 h-5 bg-slate-300/50 rounded animate-pulse mb-4" />
                    <div className="flex gap-3 overflow-hidden">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex-shrink-0 w-[100px]">
                          <div className="w-full aspect-[2/3] bg-slate-300/50 rounded-lg animate-pulse mb-2" />
                          <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse mb-1" />
                          <div className="w-2/3 h-3 bg-slate-300/50 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              ) : (
              <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                {/* Profile Panel */}
                {!viewingUserId ? (
                  <div
                    className="rounded-2xl p-4 mb-4"
                    style={glassmorphicStyle}
                  >
                    <div className="flex items-center gap-4">
                      {/* Profile Picture - 2x size */}
                      <div className="relative">
                        <button
                          onClick={() => setShowProfileMenu(!showProfileMenu)}
                          className="active:scale-95 transition-transform"
                        >
                          {userAvatar ? (
                            <img
                              src={userAvatar}
                              alt={userName}
                              className="w-16 h-16 rounded-full object-cover border-2 border-white/50"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center border-2 border-white/50">
                              <span className="text-2xl font-bold text-slate-600">
                                {userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </button>
                      </div>
                      {/* Stats */}
                      <div className="flex-1 flex gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-950">{books.length}</p>
                          <p className="text-sm text-slate-600">Books</p>
                        </div>
                        <button
                          onClick={() => setShowNotesView(true)}
                          className="text-center hover:opacity-70 active:scale-95 transition-all"
                        >
                          <p className="text-2xl font-bold text-slate-950">{books.filter(b => b.notes && b.notes.trim()).length}</p>
                          <p className="text-sm text-slate-600">Notes</p>
                        </button>
                        <button
                          onClick={() => setShowFollowingPage(true)}
                          className="text-center hover:opacity-70 active:scale-95 transition-all"
                        >
                          <p className="text-2xl font-bold text-slate-950">{myFollowingCount}</p>
                          <p className="text-sm text-slate-600">Following</p>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl p-4 mb-4"
                    style={glassmorphicStyle}
                  >
                    <div className="flex items-center gap-4">
                      {/* Profile Picture - 2x size */}
                      {viewingUserAvatar ? (
                        <img
                          src={viewingUserAvatar}
                          alt={viewingUserFullName || viewingUserName}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-purple-300 flex items-center justify-center border-2 border-white/50">
                          <span className="text-2xl font-bold text-purple-700">
                            {(viewingUserFullName || viewingUserName).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Stats */}
                      <div className="flex-1 flex gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-950">{viewingUserBooks.length}</p>
                          <p className="text-sm text-slate-600">Books</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-950">{viewingUserFollowingCount}</p>
                          <p className="text-sm text-slate-600">Following</p>
                        </div>
                      </div>
                      {/* Follow Button */}
                      <motion.button
                        onClick={handleToggleFollow}
                        disabled={isFollowLoading}
                        animate={isFollowLoading ? {
                          opacity: [1, 0.5, 1],
                          scale: [1, 0.97, 1],
                        } : {
                          opacity: 1,
                          scale: 1,
                        }}
                        transition={isFollowLoading ? {
                          duration: 0.6,
                          repeat: Infinity,
                          ease: "easeInOut",
                        } : {
                          duration: 0.2,
                        }}
                        className={`w-24 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
                          isFollowingViewingUser
                            ? 'text-blue-700'
                            : 'text-white'
                        }`}
                        style={isFollowingViewingUser ? {
                          background: 'rgba(219, 234, 254, 0.6)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        } : {
                          background: 'rgba(59, 130, 246, 0.85)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        {isFollowingViewingUser ? 'Following' : 'Follow'}
                      </motion.button>
                    </div>
                  </div>
                )}
                {/* Grouping Selector - Dropdown and Play Button (hidden when bookshelf is empty) */}
                {booksForBookshelf.length > 0 && (
                <div className="flex items-center justify-between px-4 mb-1.5">
                  <div className="relative" ref={bookshelfGroupingDropdownRef}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBookshelfGroupingDropdownOpen(!isBookshelfGroupingDropdownOpen);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 hover:opacity-80"
                      style={glassmorphicStyle}
                    >
                      <span>
                        {bookshelfGrouping === 'reading_status' ? 'Status' :
                         bookshelfGrouping === 'added' ? 'Added' :
                         bookshelfGrouping === 'rating' ? 'Rating' :
                         bookshelfGrouping === 'title' ? 'Title' :
                         bookshelfGrouping === 'author' ? 'Author' :
                         bookshelfGrouping === 'genre' ? 'Genre' :
                         bookshelfGrouping === 'publication_year' ? 'Year' : 'Status'}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform ${isBookshelfGroupingDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isBookshelfGroupingDropdownOpen && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setIsBookshelfGroupingDropdownOpen(false)}
                        />
                        {/* Menu */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 mt-1 z-40 rounded-lg min-w-[140px] overflow-hidden"
                          style={glassmorphicStyle}
                        >
                          {[
                            { value: 'reading_status', label: 'Status' },
                            { value: 'added', label: 'Added' },
                            { value: 'rating', label: 'Rating' },
                            { value: 'title', label: 'Title' },
                            { value: 'author', label: 'Author' },
                            { value: 'genre', label: 'Genre' },
                            { value: 'publication_year', label: 'Year' },
                          ].map((option, idx) => (
                            <button
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookshelfGrouping(option.value as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year');
                                setIsBookshelfGroupingDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                                idx > 0 ? 'border-t border-white/20' : ''
                              } ${
                                bookshelfGrouping === option.value
                                  ? 'text-slate-950 bg-white/20'
                                  : 'text-slate-700 hover:bg-white/20 active:bg-white/30'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </div>
                  {/* Play/Results Button - only show when grouping by rating */}
                  {bookshelfGrouping === 'rating' && (() => {
                    const availableBooks = books.filter(b => b.reading_status === 'read_it');
                    const isComplete = availableBooks.length >= 2 && !getNextMergePair(availableBooks);
                    
                    return (
                              <button
                                onClick={() => {
                          if (isComplete) {
                            // Show results in glassmorphic dialog
                            setIsPlayingGame(true);
                            setShowGameResults(true);
                            setIsGameCompleting(false);
                          } else {
                            // Initialize game
                            if (availableBooks.length < 2) {
                              alert('You need at least 2 books with "Read it" status to play!');
                              return;
                            }
                            
                            // Get next merge sort comparison pair
                            const mergePair = getNextMergePair(availableBooks);
                            if (!mergePair) {
                              // Sorting is complete - just return, don't show alert
                              return;
                            }
                            
                            const [book1, book2] = mergePair;
                            setGameBook1(book1);
                            setGameBook2(book2);
                            setGameShownBooks(new Set([book1.id, book2.id]));
                            setGameRound(1);
                            setIsPlayingGame(true);
                            setShowGameResults(false);
                            setIsGameCompleting(false);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                      >
                        {isComplete ? (
                          <>
                            <Star size={16} />
                            <span>Results</span>
                          </>
                        ) : (
                          <>
                            <Play size={16} />
                            <span>Play</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
                )}

                {/* Empty state - show when no books */}
                {booksForBookshelf.length === 0 && !viewingUserId ? (
                  <div
                    className="flex flex-col items-center justify-center text-center py-[30px] rounded-2xl"
                    style={glassmorphicStyle}
                  >
                    <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto" />
                    <button
                      onClick={() => setIsAdding(true)}
                      className="px-6 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
                      style={{
                        background: 'rgba(59, 130, 246, 0.85)',
                        backdropFilter: 'blur(9.4px)',
                        WebkitBackdropFilter: 'blur(9.4px)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      Add first book
                    </button>
                  </div>
                ) : booksForBookshelf.length === 0 && viewingUserId ? (
                  <div
                    className="flex flex-col items-center justify-center text-center space-y-6 py-[30px] rounded-2xl"
                    style={glassmorphicStyle}
                  >
                    <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto" />
                    <p className="text-sm text-slate-600">
                      {viewingUserIsPrivate ? "This user's bookshelf is private." : "This user hasn't added any books yet."}
                    </p>
                  </div>
                ) : null}

                {groupedBooksForBookshelf.map((group, groupIdx) => (
                  <motion.div
                    key={group.label || `group-${groupIdx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIdx * 0.1, duration: 0.4 }}
                    className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                    style={{
                      ...glassmorphicStyle,
                      padding: '0.8rem 0',
                    }}
                  >
                    {/* Shelf Label */}
                    <h2 className="text-xl font-bold text-slate-950 px-[4vw] flex items-center gap-2">
                      {group.label} ({group.books.length})
                      {bookshelfGrouping === 'reading_status' && (
                        <>
                          {group.label === 'Read it' && <CheckCircle2 size={20} className="text-slate-950" />}
                          {group.label === 'Reading' && <BookOpen size={20} className="text-slate-950" />}
                          {group.label === 'Want to read' && <BookMarked size={20} className="text-slate-950" />}
                          {group.label === 'TBD' && <span className="w-5 h-5" />}
                        </>
                      )}
                    </h2>
                    
                    {/* Covers Grid */}
                    <div className="px-[4vw] grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                      {/* Empty Reading group placeholder */}
                      {group.label === 'Reading' && group.books.length === 0 && !viewingUserId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex flex-col items-center cursor-pointer group"
                          onClick={() => {
                            // Check if there are "Want to read" books
                            const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');
                            if (wantToReadBooks.length > 0) {
                              setShowReadingBookPicker(true);
                            } else {
                              // No want to read books, open search
                              setIsAdding(true);
                            }
                          }}
                        >
                          {/* Placeholder Cover */}
                          <div
                            className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg mb-2 group-hover:scale-105 transition-all flex items-center justify-center"
                            style={glassmorphicStyle}
                          >
                            <Plus size={32} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </motion.div>
                      )}
                      {group.books.map((book, idx) => {
                                  const bookIndex = booksForBookshelf.findIndex(b => b.id === book.id);
                        const avgScore = calculateAvg(book.ratings);

                        return (
                          <motion.div
                            key={book.id || `book-${groupIdx}-${idx}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: (groupIdx * 0.05) + (idx * 0.02),
                              duration: 0.3,
                            }}
                            className="flex flex-col items-center cursor-pointer group"
                            onClick={() => {
                              if (viewingUserId) {
                                // When viewing another user's bookshelf, show quick view
                                setViewingBookFromOtherUser(book);
                              } else if (bookIndex !== -1) {
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
                                <CachedImage
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                  fallback={
                                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                      <BookOpen size={32} className="text-white opacity-30" />
                                    </div>
                                  }
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
                            {/* Book Title or Author */}
                            <p className="text-xs font-medium text-slate-800 text-center line-clamp-2 px-1">
                              {bookshelfGrouping === 'author' ? (book.author || 'Unknown Author') : book.title}
                            </p>
                  </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
              )}
            </div>
          </motion.main>
        ) : showBookshelf ? (
          <motion.main
            key="bookshelf"
            ref={(el) => { scrollContainerRef.current = el; }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center relative pt-20 overflow-y-auto ios-scroll"
            style={{ backgroundColor: 'transparent', paddingBottom: 'calc(1rem + 50px + 4rem)' }}
            onScroll={(e) => {
              const target = e.currentTarget;
              setScrollY(target.scrollTop);
            }}
          >
            {/* Bookshelf View */}
            <div 
              className="w-full flex flex-col items-center px-4"
            >
              {booksForBookshelf.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-20">
                  <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto mb-4" />
                  {viewingUserId ? (
                    <p className="text-sm text-slate-600">
                      {viewingUserIsPrivate ? "This user's bookshelf is private." : "This user hasn't added any books yet."}
                    </p>
                  ) : (
                    <button
                      onClick={() => setIsAdding(true)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg font-bold hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      Add first book
                    </button>
                  )}
                </div>
              ) : (
              <div className="w-full max-w-[1600px] flex flex-col gap-2.5 py-8">
                {/* Grouping Selector - Dropdown */}
                <div className="flex items-center justify-start px-4 mb-1.5">
                  <div className="relative" ref={bookshelfGroupingDropdownRef}>
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBookshelfGroupingDropdownOpen(!isBookshelfGroupingDropdownOpen);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 hover:opacity-80"
                      style={glassmorphicStyle}
                    >
                      <span>
                        {bookshelfGrouping === 'reading_status' ? 'Status' :
                         bookshelfGrouping === 'added' ? 'Added' :
                         bookshelfGrouping === 'rating' ? 'Rating' :
                         bookshelfGrouping === 'title' ? 'Title' :
                         bookshelfGrouping === 'author' ? 'Author' :
                         bookshelfGrouping === 'genre' ? 'Genre' :
                         bookshelfGrouping === 'publication_year' ? 'Year' : 'Status'}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform ${isBookshelfGroupingDropdownOpen ? 'rotate-180' : ''}`}
                      />
                  </button>
                    {isBookshelfGroupingDropdownOpen && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setIsBookshelfGroupingDropdownOpen(false)}
                        />
                        {/* Menu */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 mt-1 z-40 rounded-lg min-w-[140px] overflow-hidden"
                          style={glassmorphicStyle}
                        >
                          {[
                            { value: 'reading_status', label: 'Status' },
                            { value: 'added', label: 'Added' },
                            { value: 'rating', label: 'Rating' },
                            { value: 'title', label: 'Title' },
                            { value: 'author', label: 'Author' },
                            { value: 'genre', label: 'Genre' },
                            { value: 'publication_year', label: 'Year' },
                          ].map((option, idx) => (
                  <button
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookshelfGrouping(option.value as 'reading_status' | 'added' | 'rating' | 'title' | 'author' | 'genre' | 'publication_year');
                                setIsBookshelfGroupingDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                                idx > 0 ? 'border-t border-white/20' : ''
                              } ${
                                bookshelfGrouping === option.value
                                  ? 'text-slate-950 bg-white/20'
                                  : 'text-slate-700 hover:bg-white/20 active:bg-white/30'
                              }`}
                            >
                              {option.label}
                  </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </div>
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
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
                          <span className="text-lg font-bold text-slate-950 mb-1">
                            {totalBooks}
                          </span>
                          <span className="text-xs text-slate-600 font-medium">Total</span>
                        </div>

                        {/* Average Score KPI */}
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
                          <div className="flex items-center gap-1 mb-1">
                            <Star size={16} className="fill-amber-400 text-amber-400" />
                            <span className="text-lg font-bold text-slate-950">
                              {avgScore > 0 ? avgScore.toFixed(1) : '—'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600 font-medium">Avg Score</span>
                        </div>

                        {/* Total Unrated KPI */}
                        <div className="rounded-xl p-4 flex flex-col items-center min-w-[100px]" style={glassmorphicStyle}>
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
                    key={group.label || `group-${groupIdx}`}
                    className="flex flex-col gap-4 rounded-2xl overflow-hidden"
                    style={{
                      ...glassmorphicStyle,
                      padding: '2rem 0',
                    }}
                  >
                    {/* Shelf Label */}
                    <h2 className="text-xl font-bold text-slate-950 px-[10vw] flex items-center gap-2">
                      {group.label}
                      {bookshelfGrouping === 'reading_status' && (
                        <>
                          {group.label === 'Read it' && <CheckCircle2 size={20} className="text-slate-950" />}
                          {group.label === 'Reading' && <BookOpen size={20} className="text-slate-950" />}
                          {group.label === 'Want to read' && <BookMarked size={20} className="text-slate-950" />}
                          {group.label === 'TBD' && <span className="w-5 h-5" />}
                        </>
                      )}
                    </h2>
                    
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
                      const hash = (book.id || `${idx}`).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
                          key={book.id || `book-${groupIdx}-${idx}`}
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
                              if (viewingUserId) {
                                // When viewing another user's bookshelf, show quick view
                                setViewingBookFromOtherUser(book);
                              } else if (bookIndex !== -1) {
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
                                  {bookshelfGrouping === 'author' 
                                    ? (book.author || 'Unknown Author').toUpperCase()
                                    : book.title.toUpperCase()}
                                </div>
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
              )}
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
              scrollContainerRef.current = el;
              if (el) {
                // Enable rubber band bounce effect
                el.style.overscrollBehaviorY = 'auto';
                (el.style as any).webkitOverflowScrolling = 'touch';
              }
            }}
            className="flex-1 flex flex-col items-center justify-start p-4 relative pt-28 overflow-y-auto pb-20 ios-scroll min-h-0"
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
          {/* Back button and book info header */}
          <motion.div
            className="fixed top-[62px] left-4 right-4 z-50 flex items-center gap-3"
            animate={{
              opacity: scrollY > 20 ? Math.max(0, 1 - (scrollY - 20) / 40) : 1,
              pointerEvents: scrollY > 60 ? 'none' : 'auto'
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <button
              onClick={() => {
                setScrollY(0); // Reset scroll when switching views
                setShowBookshelfCovers(true);
                setShowBookshelf(false);
                setShowNotesView(false);
                setShowAccountPage(false);
                setShowSortingResults(false);
              }}
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center hover:opacity-80 active:scale-95 transition-all"
              style={{ ...glassmorphicStyle, borderRadius: '50%' }}
            >
              <ChevronLeft size={18} className="text-slate-950" />
            </button>
            {activeBook && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate uppercase">{activeBook.title}</p>
                <p className="text-xs text-slate-900 truncate">{activeBook.author}</p>
              </div>
            )}
          </motion.div>
        {booksForBookshelf.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <img src={getAssetPath("/logo.png")} alt="BOOK" className="object-contain mx-auto mb-4" />
            {viewingUserId ? (
              <p className="text-sm text-slate-600">
                {viewingUserIsPrivate ? "This user's bookshelf is private." : "This user hasn't added any books yet."}
              </p>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg font-bold hover:bg-blue-700 active:scale-95 transition-all"
              >
                Add first book
              </button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-6 pb-8">
            <div
              className="relative w-[340px] aspect-[2/3] overflow-hidden group rounded-lg"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
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
                      <motion.div key={activeBook.id || 'active-book'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="relative w-full h-full rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
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
                    className="absolute inset-0 w-full h-full rounded-lg p-4 flex flex-col"
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-950">
                      {activeBook ? `${activeBook.title} notes` : 'Notes'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Add a new note with current timestamp
                          const newTimestamp = formatNoteTimestamp();
                          const existingNotes = activeBook?.notes || '';
                          const newNote = existingNotes
                            ? `${existingNotes}\n\n{${newTimestamp}}\n`
                            : `{${newTimestamp}}\n`;

                          // Track the new note for animation and focus
                          setNewlyAddedNoteTimestamp(newTimestamp);

                          // Save immediately
                          if (activeBook && user) {
                            supabase
                              .from('books')
                              .update({ notes: newNote, updated_at: new Date().toISOString() })
                              .eq('id', activeBook.id)
                              .eq('user_id', user.id)
                              .then(({ error }) => {
                                if (!error) {
                                  setBooks(prev => prev.map(book =>
                                    book.id === activeBook.id ? { ...book, notes: newNote } : book
                                  ));
                                }
                              });
                          }
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
                        style={{ ...glassmorphicStyle, borderRadius: '50%' }}
                      >
                        <Plus size={16} className="text-slate-700" />
                      </button>
                      <button
                        onClick={() => {
                          setIsShowingNotes(false);
                          setNewlyAddedNoteTimestamp(null);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all"
                        style={{ ...glassmorphicStyle, borderRadius: '50%' }}
                      >
                        <X size={16} className="text-slate-700" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto ios-scroll space-y-3">
                    {(() => {
                      const sections = parseNotes(activeBook?.notes || null);
                      if (sections.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Pencil size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">No notes yet</p>
                            <p className="text-xs mt-1">Tap + to add a note</p>
                          </div>
                        );
                      }
                      return sections.map((section, idx) => {
                        const isNewNote = section.timestamp === newlyAddedNoteTimestamp;
                        return (
                        <motion.div
                          key={`${section.timestamp}-${idx}`}
                          initial={isNewNote ? { opacity: 0, y: -10 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="bg-slate-50 rounded-xl p-3 border border-slate-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-slate-400 font-medium">
                              {section.timestamp}
                            </p>
                            <button
                              onClick={() => {
                                // Delete this note
                                const updatedSections = sections.filter((_, i) => i !== idx);
                                const newNotesText = updatedSections.length > 0
                                  ? updatedSections.map(s => `{${s.timestamp}}\n${s.content}`).join('\n\n')
                                  : null;

                                if (activeBook && user) {
                                  supabase
                                    .from('books')
                                    .update({ notes: newNotesText, updated_at: new Date().toISOString() })
                                    .eq('id', activeBook.id)
                                    .eq('user_id', user.id)
                                    .then(({ error }) => {
                                      if (!error) {
                                        setBooks(prev => prev.map(book =>
                                          book.id === activeBook.id ? { ...book, notes: newNotesText } : book
                                        ));
                                      }
                                    });
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-500 active:scale-95 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <textarea
                            defaultValue={section.content}
                            autoFocus={isNewNote}
                            onFocus={() => {
                              // Clear the new note flag after focus to prevent re-animation
                              if (isNewNote) {
                                setNewlyAddedNoteTimestamp(null);
                              }
                            }}
                            onChange={(e) => {
                              const textarea = e.target;
                              const newContent = textarea.value;
                              // Auto-resize height
                              textarea.style.height = 'auto';
                              textarea.style.height = textarea.scrollHeight + 'px';
                              // Clear existing timeout
                              if (noteSaveTimeoutRef.current) {
                                clearTimeout(noteSaveTimeoutRef.current);
                              }
                              // Debounced auto-save
                              noteSaveTimeoutRef.current = setTimeout(() => {
                                // Rebuild the notes string with updated content for this section
                                const updatedSections = [...sections];
                                updatedSections[idx] = { ...section, content: newContent };
                                const newNotesText = updatedSections
                                  .map(s => `{${s.timestamp}}\n${s.content}`)
                                  .join('\n\n');

                                if (activeBook && user) {
                                  supabase
                                    .from('books')
                                    .update({ notes: newNotesText, updated_at: new Date().toISOString() })
                                    .eq('id', activeBook.id)
                                    .eq('user_id', user.id)
                                    .then(({ error }) => {
                                      if (!error) {
                                        setBooks(prev => prev.map(book =>
                                          book.id === activeBook.id ? { ...book, notes: newNotesText } : book
                                        ));
                                      }
                                    });
                                }
                              }, 1000);
                            }}
                            ref={(el) => {
                              // Auto-resize on mount
                              if (el) {
                                el.style.height = 'auto';
                                el.style.height = el.scrollHeight + 'px';
                              }
                            }}
                            placeholder="Write your note..."
                            className="w-full resize-none border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 bg-transparent"
                            style={{ minHeight: '24px', overflow: 'hidden' }}
                          />
                        </motion.div>
                        );
                      });
                    })()}
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isConfirmingDelete && !isShowingNotes && (
                  <>
                    {/* Backdrop to close on click outside */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-[59]"
                      onClick={() => setIsConfirmingDelete(false)}
                    />
                    {/* Tooltip menu */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-16 right-4 z-[60] rounded-xl overflow-hidden"
                      style={standardGlassmorphicStyle}
                    >
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-3 w-full text-left text-red-600 font-semibold text-sm hover:bg-white/30 active:scale-95 transition-all"
                      >
                        <Trash2 size={16} />
                        Delete Book
                      </button>
                      <div className="h-px bg-slate-200/50" />
                      <button
                        onClick={() => setIsConfirmingDelete(false)}
                        className="flex items-center gap-2 px-4 py-3 w-full text-left text-slate-700 font-medium text-sm hover:bg-white/30 active:scale-95 transition-all"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {(showRatingOverlay || showReadingStatusSelection) && !isConfirmingDelete && !isShowingNotes && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 20 }} 
                    className="absolute bottom-16 left-4 right-4 z-40 flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden"
                    style={standardGlassmorphicStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {showReadingStatusSelection ? (
                      // Reading Status Selection
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }} 
                        className="w-full flex flex-col items-center justify-center"
                        style={{ minHeight: '120px' }}
                      >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-950 mb-4">Reading Status</h3>
                        <div className="flex flex-row gap-3 w-full justify-center">
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'read_it');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                // If this is a new book, proceed to rating dimensions
                                if (selectingReadingStatusInRating && pendingBookMeta) {
                                  setEditingDimension(null);
                                } else {
                                  setIsEditing(false);
                                }
                              }
                            }}
                            className="flex flex-col items-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px]"
                          >
                            <CheckCircle2 size={28} className="text-slate-950" />
                            <span className="text-xs font-bold text-slate-950">Read it</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'reading');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                setIsEditing(false);
                              }
                            }}
                            className="flex flex-col items-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px]"
                          >
                            <BookOpen size={28} className="text-slate-950" />
                            <span className="text-xs font-bold text-slate-950">Reading</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (activeBook) {
                                await handleUpdateReadingStatus(activeBook.id, 'want_to_read');
                                setSelectingReadingStatusInRating(false);
                                setSelectingReadingStatusForExisting(false);
                                setPendingBookMeta(null);
                                setIsEditing(false);
                              }
                            }}
                            className="flex flex-col items-center gap-2 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl active:scale-95 transition-all flex-1 max-w-[100px]"
                          >
                            <BookMarked size={28} className="text-slate-950" />
                            <span className="text-xs font-bold text-slate-950">Want to</span>
                          </button>
                        </div>
                      </motion.div>
                    ) : currentEditingDimension ? (
                      // Rating Dimensions
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
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Click outside to close rating overlay or reading status selection */}
              {(showRatingOverlay || selectingReadingStatusForExisting) && (
                <div 
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingDimension(null);
                    setSelectingReadingStatusForExisting(false);
                    setSelectingReadingStatusInRating(false);
                  }}
                />
              )}


              {/* Delete button - bottom right */}
              <AnimatePresence>
                {!isShowingNotes && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() => setIsConfirmingDelete(true)}
                    className="absolute bottom-4 right-4 z-30 p-2.5 rounded-full shadow-lg text-black hover:text-red-600 active:scale-90 transition-all"
                    style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                  >
                    <Trash2 size={20} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Bottom left button row: Rate | Read Status | Notes */}
              <AnimatePresence>
                {!isShowingNotes && activeBook && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="absolute bottom-4 left-4 z-30 flex items-center gap-2"
                  >
                    {/* Rating button */}
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setEditingDimension(null); // Will default to first unrated or first dimension
                      }}
                      className="px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 active:scale-90 transition-transform"
                      style={coverButtonGlassmorphicStyle}
                    >
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      <span className="font-black text-sm text-slate-950">
                        {calculateAvg(activeBook.ratings) || 'Rate'}
                      </span>
                    </button>

                    {/* Reading Status button */}
                    <button
                      onClick={() => {
                        // Open reading status selection interface
                        setSelectingReadingStatusForExisting(true);
                        setIsEditing(true);
                      }}
                      className="w-10 h-10 rounded-full shadow-lg text-black hover:text-blue-600 active:scale-95 transition-all flex items-center justify-center"
                      style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                    >
                      {activeBook.reading_status === 'read_it' ? (
                        <CheckCircle2 size={18} className="text-slate-950" />
                      ) : activeBook.reading_status === 'reading' ? (
                        <BookOpen size={18} className="text-slate-950" />
                      ) : activeBook.reading_status === 'want_to_read' ? (
                        <BookMarked size={18} className="text-slate-950" />
                      ) : (
                        <BookOpen size={18} className="text-slate-950 opacity-50" />
                      )}
                    </button>

                    {/* Notes button */}
                    <button
                      onClick={() => setIsShowingNotes(true)}
                      className="w-10 h-10 rounded-full shadow-lg text-black hover:text-blue-600 active:scale-90 transition-all flex items-center justify-center"
                      style={{ ...coverButtonGlassmorphicStyle, borderRadius: '50%' }}
                    >
                      <Pencil size={18} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {books.length > 1 && !isShowingNotes && (
                <>
                  <button onClick={() => { triggerMediumHaptic(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : books.length - 1)); }} className="absolute left-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={36} /></button>
                  <button onClick={() => { triggerMediumHaptic(); setSelectedIndex(prev => (prev < books.length - 1 ? prev + 1 : 0)); }} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-white drop-shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={36} /></button>
                </>
              )}
            </div>

            {/* Info box - always open, below cover and above facts */}
            {!showRatingOverlay && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`info-${activeBook?.id || 'default'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="w-full mt-3"
                >
                  <div className="rounded-2xl px-4 py-3 mx-auto" style={bookPageGlassmorphicStyle}>
                  {/* Line 1: Title */}
                  <h2 className="text-sm font-black text-slate-950 leading-tight line-clamp-2 mb-2">{activeBook.title}</h2>
                  {/* Line 2: Summary/Synopsis */}
                  {activeBook.summary && (
                    <div className="mb-2">
                      <p
                        className={`text-xs text-black leading-relaxed ${!isSummaryExpanded ? 'line-clamp-5' : ''} cursor-pointer`}
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                      >
                        {activeBook.summary}
                      </p>
                      {activeBook.summary.length > 300 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSummaryExpanded(!isSummaryExpanded);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
                        >
                          {isSummaryExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Line 3: Author */}
                  <p className="text-xs font-bold text-slate-800 mb-2">{activeBook.author}</p>
                  {/* Line 4: All Labels */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeBook.first_issue_year && (
                      <>
                        <span className="bg-blue-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-blue-800">
                          First Issue: {activeBook.first_issue_year}
                        </span>
                      </>
                    )}
                    {activeBook.publish_year && !activeBook.first_issue_year && (
                      <>
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800">
                          {activeBook.publish_year}
                        </span>
                      </>
                    )}
                    {activeBook.genre && (
                      <>
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800">
                          {activeBook.genre}
                        </span>
                      </>
                    )}
                    {activeBook.isbn && (
                      <>
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-slate-800">
                          ISBN: {activeBook.isbn}
                        </span>
                      </>
                    )}
                    {(activeBook.wikipedia_url || activeBook.google_books_url) && (
                      <>
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
              </AnimatePresence>
            )}

            {/* Readers section - profile pictures and chat button */}
            {!showRatingOverlay && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="w-full mt-2"
              >
                <div className="rounded-2xl px-4 py-3" style={bookPageGlassmorphicStyle}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isLoadingBookReaders ? (
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="flex items-center gap-2"
                        >
                          <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-300/50" style={{ zIndex: 5 - i }} />
                            ))}
                          </div>
                          <div className="w-16 h-3 bg-slate-300/50 rounded ml-1" />
                        </motion.div>
                      ) : (
                        <>
                          {/* Stacked profile pictures - current user first */}
                          <div className="flex -space-x-2">
                            {/* Current user always first */}
                            {userAvatar ? (
                              <img
                                src={userAvatar}
                                alt={userName}
                                className="w-8 h-8 rounded-full border-2 border-emerald-400 object-cover"
                                style={{ zIndex: 6 }}
                                title={`${userName} (you)`}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600"
                                style={{ zIndex: 6 }}
                                title={`${userName} (you)`}
                              >
                                {userName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {/* Other readers */}
                            {bookReaders.slice(0, 4).map((reader, index) => (
                              reader.avatar ? (
                                <img
                                  key={reader.id}
                                  src={reader.avatar}
                                  alt={reader.name}
                                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                  style={{ zIndex: 5 - index }}
                                  title={reader.name}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div
                                  key={reader.id}
                                  className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-600"
                                  style={{ zIndex: 5 - index }}
                                  title={reader.name}
                                >
                                  {reader.name.charAt(0).toUpperCase()}
                                </div>
                              )
                            ))}
                            {bookReaders.length > 4 && (
                              <div
                                className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600"
                                style={{ zIndex: 0 }}
                              >
                                +{bookReaders.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-slate-600 ml-1">
                            {bookReaders.length + 1} {bookReaders.length === 0 ? 'reader' : 'readers'}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Buttons container */}
                    <div className="flex items-center gap-2">
                      {isLoadingBookReaders ? (
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="flex items-center gap-2"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-300/50" />
                          <div className="w-8 h-8 rounded-full bg-slate-300/50" />
                        </motion.div>
                      ) : (
                        <>
                          {/* Telegram discussion button */}
                          <button
                            onClick={async () => {
                              if (!activeBook?.canonical_book_id) return;
                              setIsLoadingTelegramTopic(true);
                              try {
                                // Check if we already have the topic cached locally
                                const cachedTopic = telegramTopics.get(activeBook.canonical_book_id);
                                if (cachedTopic) {
                                  window.open(cachedTopic.inviteLink, '_blank');
                                  return;
                                }

                                // Get or create the topic
                                const topic = await getOrCreateTelegramTopic(
                                  activeBook.title,
                                  activeBook.author,
                                  activeBook.canonical_book_id,
                                  activeBook.cover_url || undefined,
                                  activeBook.genre || undefined
                                );

                                if (topic) {
                                  // Cache locally
                                  setTelegramTopics(prev => new Map(prev).set(activeBook.canonical_book_id!, topic));
                                  // Open the invite link
                                  window.open(topic.inviteLink, '_blank');
                                }
                              } catch (err) {
                                console.error('Error opening Telegram topic:', err);
                              } finally {
                                setIsLoadingTelegramTopic(false);
                              }
                            }}
                            disabled={isLoadingTelegramTopic || !activeBook?.canonical_book_id}
                            className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-all disabled:opacity-50"
                            style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              backdropFilter: 'blur(9.4px)',
                              WebkitBackdropFilter: 'blur(9.4px)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            {isLoadingTelegramTopic ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full"
                              />
                            ) : (
                              <MessagesSquare size={16} className="text-slate-700" />
                            )}
                          </button>

                          {/* Discussion button */}
                          <button
                            onClick={() => setShowBookDiscussion(true)}
                            className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-all"
                            style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              backdropFilter: 'blur(9.4px)',
                              WebkitBackdropFilter: 'blur(9.4px)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            <Lightbulb size={16} className="text-slate-700" />
                          </button>

                          {/* Infographic button */}
                          <button
                            onClick={async () => {
                              if (!activeBook) return;
                              // Check if we already have the infographic
                              if (bookInfographics.has(activeBook.id)) {
                                setShowInfographicModal(true);
                                return;
                              }
                              // Fetch the infographic
                              setLoadingInfographicForBookId(activeBook.id);
                              const infographic = await getGrokBookInfographic(activeBook.title, activeBook.author);
                              setLoadingInfographicForBookId(null);
                              if (infographic) {
                                setBookInfographics(prev => new Map(prev).set(activeBook.id, infographic));
                                setShowInfographicModal(true);
                              }
                            }}
                            disabled={loadingInfographicForBookId === activeBook?.id}
                            className="flex items-center justify-center w-8 h-8 rounded-full active:scale-95 transition-all disabled:opacity-50"
                            style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              backdropFilter: 'blur(9.4px)',
                              WebkitBackdropFilter: 'blur(9.4px)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            {loadingInfographicForBookId === activeBook?.id ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full"
                              />
                            ) : (
                              <MapIcon size={16} className="text-slate-700" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Insights Section - Show below cover with spacing */}
            {!showRatingOverlay && (
              <>
                {!bookPageSectionsResolved ? (
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-full space-y-6"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={`book-page-skeleton-${i}`} className="rounded-xl p-4" style={glassmorphicStyle}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-24 h-3 bg-slate-300/50 rounded" />
                          <div className="w-12 h-3 bg-slate-300/50 rounded" />
                        </div>
                        <div className="space-y-2">
                          <div className="w-full h-4 bg-slate-300/50 rounded" />
                          <div className="w-5/6 h-4 bg-slate-300/50 rounded" />
                          <div className="w-3/4 h-4 bg-slate-300/50 rounded" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="w-full space-y-6"
                  >
                {/* Insights: Show if we have facts, research, or are loading */}
                {(() => {
                  const isNotRead = activeBook.reading_status !== 'read_it';
                  const revealedSections = spoilerRevealed.get(activeBook.id) || new Set<string>();
                  const isInsightsRevealed = revealedSections.has('insights');
                  const shouldBlurInsights = isNotRead && !isInsightsRevealed;
                  const hasFacts = activeBook.author_facts && activeBook.author_facts.length > 0;
                  const research = researchData.get(activeBook.id) || null;
                  const hasResearch = research && research.pillars && research.pillars.length > 0;
                  const influences = bookInfluences.get(activeBook.id) || [];
                  const hasInfluences = influences.length > 0;
                  const domainData = bookDomain.get(activeBook.id);
                  const hasDomain = domainData && domainData.facts && domainData.facts.length > 0;
                  const domainLabel = domainData?.label || 'Domain';
                  const contextInsights = bookContext.get(activeBook.id) || [];
                  const hasContext = contextInsights.length > 0;
                  const didYouKnowInsights = didYouKnow.get(activeBook.id) || [];
                  const hasDidYouKnow = didYouKnowInsights.length > 0;
                  const isLoadingFacts = !bookPageSectionsResolved && loadingFactsForBookId === activeBook.id && !hasFacts;
                  const isLoadingResearch = !bookPageSectionsResolved && loadingResearchForBookId === activeBook.id && !hasResearch;
                  const isLoadingInfluences = !bookPageSectionsResolved && loadingInfluencesForBookId === activeBook.id && !hasInfluences;
                  const isLoadingDomain = !bookPageSectionsResolved && loadingDomainForBookId === activeBook.id && !hasDomain;
                  const isLoadingContext = !bookPageSectionsResolved && loadingContextForBookId === activeBook.id && !hasContext;
                  const isLoadingDidYouKnow = !bookPageSectionsResolved && loadingDidYouKnowForBookId === activeBook.id && !hasDidYouKnow;
                  
                  // Get available categories (only show enabled insight types)
                  const categories: { id: string; label: string; count: number }[] = [];
                  if (featureFlags.insights.author_facts && (hasFacts || isLoadingFacts)) {
                    categories.push({ id: 'trivia', label: 'Trivia', count: activeBook.author_facts?.length || 0 });
                  }
                  if (featureFlags.insights.book_influences && (hasInfluences || isLoadingInfluences)) {
                    categories.push({ id: 'influences', label: 'Influences', count: influences.length });
                  }
                  if (featureFlags.insights.book_domain && (hasDomain || isLoadingDomain)) {
                    categories.push({ id: 'domain', label: domainLabel, count: domainData?.facts?.length || 0 });
                  }
                  if (featureFlags.insights.book_context && (hasContext || isLoadingContext)) {
                    categories.push({ id: 'context', label: 'Context', count: contextInsights.length });
                  }
                  if (featureFlags.insights.did_you_know && (hasDidYouKnow || isLoadingDidYouKnow)) {
                    categories.push({ id: 'did_you_know', label: 'Did you know?', count: didYouKnowInsights.length });
                  }
                  if (hasResearch) {
                    research.pillars.forEach(pillar => {
                      categories.push({ 
                        id: pillar.pillar_name.toLowerCase().replace(/\s+/g, '_'), 
                        label: pillar.pillar_name, 
                        count: pillar.content_items.length 
                      });
                    });
                  }
                  
                  // Only render if loading or has data (for enabled insight types)
                  const hasEnabledInsights =
                    (featureFlags.insights.author_facts && (isLoadingFacts || hasFacts)) ||
                    (featureFlags.insights.book_influences && (isLoadingInfluences || hasInfluences)) ||
                    (featureFlags.insights.book_domain && (isLoadingDomain || hasDomain)) ||
                    (featureFlags.insights.book_context && (isLoadingContext || hasContext)) ||
                    (featureFlags.insights.did_you_know && (isLoadingDidYouKnow || hasDidYouKnow)) ||
                    (isLoadingResearch || hasResearch); // Research doesn't have a feature flag
                  if (!hasEnabledInsights) return null;
                  
                  // Determine current category data
                  const currentCategory = categories.find(c => c.id === selectedInsightCategory) || categories[0];
                  let currentInsights: { text: string; sourceUrl?: string; label: string }[] = [];
                  let isLoading = false;
                  
                  if (currentCategory?.id === 'trivia') {
                    currentInsights = (activeBook.author_facts || []).map(fact => ({ text: fact, label: 'Trivia' }));
                    isLoading = isLoadingFacts;
                  } else if (currentCategory?.id === 'influences') {
                    currentInsights = influences.map(influence => ({ text: influence, label: 'Influences' }));
                    isLoading = isLoadingInfluences;
                  } else if (currentCategory?.id === 'domain') {
                    const domainDataForBook = bookDomain.get(activeBook.id);
                    const domainLabelForBook = domainDataForBook?.label || 'Domain';
                    currentInsights = (domainDataForBook?.facts || []).map(insight => ({ text: insight, label: domainLabelForBook }));
                    isLoading = isLoadingDomain;
                  } else if (currentCategory?.id === 'context') {
                    currentInsights = contextInsights.map(insight => ({ text: insight, label: 'Context' }));
                    isLoading = isLoadingContext;
                  } else if (currentCategory?.id === 'did_you_know') {
                    // For "Did you know?", combine all 3 notes per item into separate insights
                    currentInsights = didYouKnowInsights.flatMap(item =>
                      item.notes.map(note => ({ text: note, label: 'Did you know?' }))
                    );
                    isLoading = isLoadingDidYouKnow;
                  } else if (currentCategory && hasResearch) {
                    const pillar = research.pillars.find(p => p.pillar_name.toLowerCase().replace(/\s+/g, '_') === currentCategory.id);
                    if (pillar) {
                      currentInsights = pillar.content_items.map(item => ({ 
                        text: item.deep_insight, 
                        sourceUrl: item.source_url,
                        label: pillar.pillar_name
                      }));
                    }
                    isLoading = isLoadingResearch;
                  }
                  
                  return (
                    <div className="w-full space-y-2">
                      {/* Insights Header with Category Selector - hidden when featureFlags.bookPageSectionHeaders.insights is true */}
                      {!featureFlags.bookPageSectionHeaders.insights && (
                        <div className="flex items-center justify-center mb-2 relative z-[40]">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm relative" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">INSIGHTS:</span>
                            {categories.length > 1 && (
                              <>
                                <span className="text-[10px] font-bold text-slate-400">/</span>
                                <div className="relative insight-category-dropdown z-[40]">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsInsightCategoryDropdownOpen(!isInsightCategoryDropdownOpen);
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition-colors text-blue-700 hover:bg-blue-50"
                                  >
                                    {currentCategory?.label || 'Trivia'}
                                    <ChevronDown
                                      size={12}
                                      className={`transition-transform ${isInsightCategoryDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                  </button>
                                  {isInsightCategoryDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-white/95 backdrop-blur-md border border-white/30 rounded-lg shadow-xl z-[40] min-w-[120px] overflow-hidden">
                                      {categories.map((cat) => (
                                        <button
                                          key={cat.id || `cat-${cat.label}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedInsightCategory(cat.id);
                                            setIsInsightCategoryDropdownOpen(false);
                                          }}
                                          className={`w-full text-left text-[10px] font-bold px-3 py-2 transition-colors ${
                                            selectedInsightCategory === cat.id
                                              ? 'text-blue-700 bg-blue-100'
                                              : 'text-slate-600 hover:bg-slate-100'
                                          }`}
                                        >
                                          {cat.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            {categories.length === 1 && (
                              <>
                                <span className="text-[10px] font-bold text-slate-400">/</span>
                                <span className="text-[10px] font-bold text-blue-700">{currentCategory?.label || 'Trivia'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Content with spoiler protection */}
                      <div
                        className={`relative ${shouldBlurInsights ? 'cursor-pointer' : ''}`}
                        onClick={(e) => {
                          if (shouldBlurInsights) {
                            e.stopPropagation();
                            setSpoilerRevealed(prev => {
                              const newMap = new Map(prev);
                              const revealed = newMap.get(activeBook.id) || new Set<string>();
                              revealed.add('insights');
                              newMap.set(activeBook.id, revealed);
                              return newMap;
                            });
                          }
                        }}
                      >
                        {shouldBlurInsights && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm">
                              <Lightbulb size={14} className="text-slate-600" />
                              <span className="text-xs font-medium text-slate-600">Spoiler alert, tap to reveal</span>
                            </div>
                          </div>
                        )}
                        <div className={`[&_p]:transition-[filter] [&_p]:duration-300 [&_span]:transition-[filter] [&_span]:duration-300 ${shouldBlurInsights ? '[&_p]:blur-[5px] [&_span]:blur-[5px] select-none pointer-events-none' : ''}`}>
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-3 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-20 h-3 bg-slate-300/50 rounded animate-pulse mt-1" />
                              </div>
                            </motion.div>
                          ) : currentInsights.length > 0 ? (
                            <InsightsCards
                              insights={currentInsights}
                              bookId={`${activeBook.id}-${selectedInsightCategory}`}
                              isLoading={false}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Podcast Episodes - Show below author facts */}
                {(() => {
                  const episodes = combinedPodcastEpisodes;
                  const hasEpisodes = episodes.length > 0;
                  // Only show loading if we don't have episodes yet. Once loaded, always show.
                  const isLoading = !bookPageSectionsResolved && activeBook && loadingPodcastsForBookId === activeBook.id && !hasEpisodes;
                  
                  // Only show the podcast section if loading or has episodes
                  if (!isLoading && !hasEpisodes) return null;
                  
                  return (
                    <div className="w-full space-y-2">
                      {/* Podcast Header - hidden when featureFlags.bookPageSectionHeaders.podcasts is true */}
                      {!featureFlags.bookPageSectionHeaders.podcasts && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">PODCASTS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">Curated + Apple</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
                      <div>
                          {isLoading ? (
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-12 h-12 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                  <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
                                  <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-2/3 h-3 bg-slate-300/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <PodcastEpisodes
                              episodes={episodes}
                              bookId={activeBook?.id || ''}
                              isLoading={false}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* YouTube Videos - Show below podcasts */}
                {(() => {
                  const videos = youtubeVideos.get(activeBook.id) || [];
                  const hasVideos = videos.length > 0;
                  const isLoading = !bookPageSectionsResolved && loadingVideosForBookId === activeBook.id && !hasVideos;

                  // Only show the videos section if loading or has videos
                  if (!isLoading && !hasVideos) return null;

                  return (
                    <div className="w-full space-y-2">
                      {/* Videos Header - hidden when featureFlags.bookPageSectionHeaders.youtube is true */}
                      {!featureFlags.bookPageSectionHeaders.youtube && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">VIDEOS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">YouTube</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
                      <div>
                          {isLoading ? (
                            // Show loading placeholder
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl overflow-hidden"
                              style={glassmorphicStyle}
                            >
                              <div className="relative w-full bg-slate-300/50 animate-pulse" style={{ paddingBottom: '56.25%' }}>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Play size={32} className="text-slate-400/50" />
                                </div>
                              </div>
                              <div className="p-4 space-y-2">
                                <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            <YouTubeVideos
                              videos={videos}
                              bookId={activeBook.id}
                              isLoading={false}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* Analysis Articles - Show below videos */}
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
                  const isLoading = !bookPageSectionsResolved && loadingAnalysisForBookId === activeBook.id && !hasArticles && !hasOnlyFallback;

                  // Only show the analysis section if loading or has articles
                  if (!isLoading && !hasArticles) return null;

                  return (
                    <div className="w-full space-y-2">
                      {/* Analysis Header - hidden when featureFlags.bookPageSectionHeaders.articles is true */}
                      {!featureFlags.bookPageSectionHeaders.articles && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">ANALYSIS:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">Google Scholar</span>
                          </div>
                        </div>
                      )}
                      {/* Content */}
                      <div>
                          {isLoading ? (
                            // Show loading placeholder
                            <motion.div
                              animate={{ opacity: [0.5, 0.8, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="rounded-xl p-4"
                              style={glassmorphicStyle}
                            >
                              <div className="space-y-2">
                                <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
                                <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse mt-3" />
                                <div className="w-5/6 h-3 bg-slate-300/50 rounded animate-pulse" />
                              </div>
                            </motion.div>
                          ) : (
                            // Show articles
                            <AnalysisArticles
                              articles={articles}
                              bookId={activeBook.id}
                              isLoading={false}
                            />
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* Related Books - Show below analysis */}
                {(() => {
                  const related = relatedBooks.get(activeBook.id);
                  // Check if we have data (including empty array which means we fetched but got no results)
                  const hasData = related !== undefined; // undefined means not fetched yet, [] means fetched but empty
                  const hasRelated = related && related.length > 0;
                  const isLoading = !bookPageSectionsResolved && loadingRelatedForBookId === activeBook.id && !hasData;

                  // Only show the related books section if loading or has related books
                  // Don't show if we've fetched and got empty results
                  if (!isLoading && !hasRelated) return null;

                  return (
                    <div className="w-full space-y-2">
                      {/* Related Books Header - hidden when featureFlags.bookPageSectionHeaders.relatedBooks is true */}
                      {!featureFlags.bookPageSectionHeaders.relatedBooks && (
                        <div className="flex items-center justify-center mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm" style={bookPageGlassmorphicStyle}>
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">RELATED:</span>
                            <span className="text-[10px] font-bold text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-blue-700">Grok</span>
                          </div>
                        </div>
                      )}
                      {isLoading ? (
                        // Show loading placeholder
                        <motion.div
                          animate={{ opacity: [0.5, 0.8, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="rounded-xl p-4"
                          style={glassmorphicStyle}
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-16 h-20 bg-slate-300/50 rounded-lg animate-pulse flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="w-3/4 h-4 bg-slate-300/50 rounded animate-pulse" />
                              <div className="w-1/2 h-3 bg-slate-300/50 rounded animate-pulse" />
                              <div className="w-20 h-6 bg-slate-300/50 rounded-lg animate-pulse mt-2" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="w-full h-3 bg-slate-300/50 rounded animate-pulse" />
                            <div className="w-4/5 h-3 bg-slate-300/50 rounded animate-pulse" />
                          </div>
                        </motion.div>
                      ) : (
                        <RelatedBooks
                          books={related || []}
                          bookId={activeBook.id}
                          isLoading={false}
                          onAddBook={handleAddBook}
                        />
                      )}
                    </div>
                  );
                })()}

                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
          </motion.main>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-4 left-0 right-0 z-[50] flex justify-center px-4 pointer-events-none">
        <div 
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 pointer-events-auto"
          style={glassmorphicStyle}
        >
          {/* Bookshelf button - left (circular, grid view) */}
          <button
            onClick={() => {
              if (
                showBookshelfCovers &&
                !showFeedPage &&
                !showNotesView &&
                !showAccountPage &&
                !showSortingResults &&
                !showFollowingPage &&
                !viewingUserId
              ) {
                return; // Already on bookshelf, do nothing
              }
              setScrollY(0); // Reset scroll when switching views
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowBookshelfCovers(true);
              setShowBookshelf(false);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
              setShowFeedPage(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showBookshelfCovers
                ? 'bg-white/40 hover:bg-white/50'
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/library.svg")} alt="Library" className="w-[18px] h-[18px]" />
            ) : (
              <Library size={18} className="text-slate-700" />
            )}
          </button>

          {/* Game button - trivia game */}
          <div className="relative group">
            {(() => {
              const minBooks = 5;
              const minBooksWithQuestions = 5;
              const hasEnoughBooks = books.length >= minBooks;
              const hasEnoughQuestions = booksWithTriviaQuestions >= minBooksWithQuestions;
              const isDisabled = !hasEnoughBooks || !hasEnoughQuestions;
              
              // Calculate remaining books needed (whichever is higher)
              const remainingBooks = Math.max(
                hasEnoughBooks ? 0 : minBooks - books.length,
                hasEnoughQuestions ? 0 : minBooksWithQuestions - booksWithTriviaQuestions
              );
              
              return (
                <>
                  <button
                    onClick={() => {
                      if (isDisabled) return;
                      
                      // Don't navigate away - just open trivia dialog on top of current page
                      // If we have questions and are mid-game, resume from where we left off
                      if (triviaQuestions.length > 0 && currentTriviaQuestionIndex < triviaQuestions.length && !triviaGameComplete) {
                        // Resume mid-game - don't reset state, just reopen
                        setIsPlayingTrivia(true);
                        setIsTriviaReady(false);
                      } else {
                        // Start new game - reset everything
                        setIsPlayingTrivia(true);
                        setIsTriviaReady(true);
                        setCurrentTriviaQuestionIndex(0);
                        setTriviaScore(0);
                        setSelectedTriviaAnswer(null);
                        setTriviaAnswerFeedback(null);
                        setTriviaGameComplete(false);
                        setTriviaSelectedAnswers(new Map());
                        setIsTriviaTransitioning(false);
                        setTriviaShuffledAnswers([]);
                      }
                    }}
                    disabled={isDisabled}
                    className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
                      isPlayingTrivia
                        ? 'bg-white/40 hover:bg-white/50'
                        : 'bg-white/20 hover:bg-white/30'
                    }`}
                  >
                    {featureFlags.hand_drawn_icons ? (
                      <img src={getAssetPath("/Trophy.svg")} alt="Trivia" className="w-[18px] h-[18px]" />
                    ) : (
                      <Trophy size={18} className="text-slate-700" />
                    )}
                  </button>
                  {isDisabled && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                      style={{
                        background: '#1d1d1f',
                        color: '#fff',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                      }}
                    >
                      Add {remainingBooks} more {remainingBooks === 1 ? 'book' : 'books'} to unlock trivia!
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Clubs button */}
          <div className="relative group">
            <button
              onClick={() => {}}
              className="w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center bg-white/20 hover:bg-white/30"
            >
              {featureFlags.hand_drawn_icons ? (
                <img src={getAssetPath("/shield.svg")} alt="Clubs" className="w-[18px] h-[18px]" />
              ) : (
                <ShieldUser size={18} className="text-slate-700" />
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
              style={{
                background: '#1d1d1f',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: '700',
                boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
              }}
            >
              Clubs coming soon
            </div>
          </div>

          {/* Feed button */}
          <button
            onClick={() => {
              if (showFeedPage) return; // Already on feed, do nothing
              setScrollY(0);
              setViewingUserId(null);
              setViewingUserBooks([]);
              setViewingUserName('');
              setViewingUserFullName(null);
              setViewingUserAvatar(null);
              setShowFeedPage(true);
              setShowBookshelf(false);
              setShowBookshelfCovers(false);
              setShowNotesView(false);
              setShowAccountPage(false);
              setShowSortingResults(false);
            }}
            className={`w-11 h-11 rounded-full active:scale-95 transition-all flex items-center justify-center ${
              showFeedPage
                ? 'bg-white/40 hover:bg-white/50'
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/feed.svg")} alt="Feed" className="w-[18px] h-[18px]" />
            ) : (
              <Birdhouse size={18} className="text-slate-700" />
            )}
          </button>

          {/* Search button - right (circular) */}
          <button
            onClick={() => setIsAdding(true)}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center ml-auto"
          >
            {featureFlags.hand_drawn_icons ? (
              <img src={getAssetPath("/search.svg")} alt="Search" className="w-[18px] h-[18px]" />
            ) : (
              <Search size={18} className="text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Game Overlay */}
      <AnimatePresence>
        {(isPlayingGame && (gameBook1 && gameBook2 || isGameCompleting || showGameResults)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !showGameResults) {
                setIsPlayingGame(false);
                setShowGameResults(false);
                setIsGameCompleting(false);
              }
            }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>
              
              <div className="px-4 pb-6 max-h-[90vh] overflow-y-auto">
                {/* Game Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-950">
                    {showGameResults ? 'Ranked Results' : 'Pick Your Favorite'}
                  </h2>
                  <button
                    onClick={() => {
                      setIsPlayingGame(false);
                      setShowGameResults(false);
                      setIsGameCompleting(false);
                    }}
                    className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md hover:bg-white/85 border border-white/30 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                  >
                    <ChevronLeft size={16} className="text-slate-700 rotate-90" />
                  </button>
                </div>
              
                {/* Progress Bar - Show merge sort progress */}
                {!showGameResults && (() => {
                  const availableBooks = books.filter(b => b.reading_status === 'read_it');
                  const n = availableBooks.length;
                  const totalComparisons = getTotalMergeComparisons(n);
                  const comparedCount = getCurrentComparisonCount();
                  const progress = totalComparisons > 0 ? (comparedCount / totalComparisons) * 100 : 0;
                  
                  return (
                    <div className="mb-4">
                      <div className="text-xs text-slate-600 text-center mb-2">
                        {comparedCount} / ~{totalComparisons} comparisons ({Math.round(progress)}%)
                      </div>
                      <div className="w-full h-2 bg-slate-300/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-blue-600 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })()}
              
                {/* Two Books Side by Side - Hide when completing or showing results */}
                {!isGameCompleting && !showGameResults && gameBook1 && gameBook2 && (
                <div className="grid grid-cols-2 gap-4 relative">
                {/* Book 1 */}
                <AnimatePresence mode="wait">
                  <motion.button
                    key={gameBook1?.id || 'game-book-1'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                    // Record comparison: book1 beats book2
                    if (gameBook1 && gameBook2) {
                      const availableBooks = books.filter(b => b.reading_status === 'read_it');
                      recordMergeComparisonForGame(gameBook1.id, gameBook2.id, availableBooks);
                    }
                    
                    // Replace both books with next merge sort comparison
                    const availableBooks = books.filter(b => b.reading_status === 'read_it');
                    const nextPair = getNextMergePair(availableBooks);
                    
                    if (!nextPair) {
                      // Merge sort complete - show results immediately
                      setGameBook1(null);
                      setGameBook2(null);
                      setShowGameResults(true);
                      return;
                    }
                    
                    const [newBook1, newBook2] = nextPair;
                    setGameBook1(newBook1);
                    setGameBook2(newBook2);
                    setGameShownBooks(new Set([newBook1.id, newBook2.id]));
                    setGameRound(prev => prev + 1);
                  }}
                  className="flex items-center justify-center p-2 rounded-2xl hover:bg-white/20 transition-colors"
                >
                  {gameBook1 && (
                    <>
                      {gameBook1.cover_url ? (
                        <img 
                          src={gameBook1.cover_url} 
                          alt={gameBook1.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className={`w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-br ${getGradient(gameBook1.id)} rounded-lg shadow-lg`}>
                          <BookOpen size={48} className="text-white opacity-50" />
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
                </AnimatePresence>
                
                {/* Book 2 */}
                <AnimatePresence mode="wait">
                  <motion.button
                    key={gameBook2?.id || 'game-book-2'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                    // Record comparison: book2 beats book1
                    if (gameBook1 && gameBook2) {
                      const availableBooks = books.filter(b => b.reading_status === 'read_it');
                      recordMergeComparisonForGame(gameBook2.id, gameBook1.id, availableBooks);
                    }
                    
                    // Replace both books with next merge sort comparison
                    const availableBooks = books.filter(b => b.reading_status === 'read_it');
                    const nextPair = getNextMergePair(availableBooks);
                    
                    if (!nextPair) {
                      // Merge sort complete - show results immediately
                      setGameBook1(null);
                      setGameBook2(null);
                      setShowGameResults(true);
                      return;
                    }
                    
                    const [newBook1, newBook2] = nextPair;
                    setGameBook1(newBook1);
                    setGameBook2(newBook2);
                    setGameShownBooks(new Set([newBook1.id, newBook2.id]));
                    setGameRound(prev => prev + 1);
                  }}
                  className="flex items-center justify-center p-2 rounded-2xl hover:bg-white/20 transition-colors"
                >
                  {gameBook2 && (
                    <>
                      {gameBook2.cover_url ? (
                        <img 
                          src={gameBook2.cover_url} 
                          alt={gameBook2.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                        />
                      ) : (
                        <div className={`w-full aspect-[2/3] flex items-center justify-center bg-gradient-to-br ${getGradient(gameBook2.id)} rounded-lg shadow-lg`}>
                          <BookOpen size={48} className="text-white opacity-50" />
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
                </AnimatePresence>
                </div>
                )}
                
                {/* Completion Spinner - Show on top of empty dialog */}
                <AnimatePresence>
                  {isGameCompleting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center min-h-[400px] rounded-3xl"
                    >
                      <div className="text-center">
                        <Lottie animationData={spinnerAnimation} loop={true} className="w-24 h-24 mx-auto" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Ranked Results List - Expand vertically after spinner */}
                <AnimatePresence>
                  {showGameResults && (() => {
                  const availableBooks = books.filter(b => b.reading_status === 'read_it');
                  // Reference resultsUpdateTrigger to force re-render after manual reorder
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                  const _trigger = resultsUpdateTrigger;
                  const sortedBooks = getSortedBooks(availableBooks);
                  
                  if (sortedBooks.length === 0) {
                    return (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className="flex items-center justify-center min-h-[200px] text-slate-700"
                      >
                        <p className="text-xs">No books to display</p>
                      </motion.div>
                    );
                  }
                  
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="space-y-3 mt-4"
                    >
                      {sortedBooks.map((book: BookWithRatings, index: number) => {
                        const isDragging = draggedBookId === book.id;
                        const isDragOver = dragOverIndex === index && draggedBookId !== book.id;

                        return (
                          <motion.div
                            key={book.id || `drag-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ 
                              opacity: isDragging ? 0.5 : isDragOver ? 0.8 : 1, 
                              y: 0,
                              scale: isDragOver ? 1.02 : 1
                            }}
                            transition={{ delay: index * 0.05 }}
                            draggable
                            onDragStart={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              setDraggedBookId(book.id);
                              dragEvent.dataTransfer.effectAllowed = 'move';
                              dragEvent.dataTransfer.setData('text/plain', book.id);
                            }}
                            onDragOver={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              dragEvent.preventDefault();
                              dragEvent.dataTransfer.dropEffect = 'move';
                              if (draggedBookId !== book.id) {
                                setDragOverIndex(index);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverIndex === index) {
                                setDragOverIndex(null);
                              }
                            }}
                            onDrop={(e) => {
                              const dragEvent = e as unknown as React.DragEvent;
                              dragEvent.preventDefault();
                              const droppedBookId = dragEvent.dataTransfer.getData('text/plain');
                              
                              if (droppedBookId && droppedBookId !== book.id) {
                                // Find the old index of the dragged book
                                const oldIndex = sortedBooks.findIndex(b => b.id === droppedBookId);
                                
                                if (oldIndex !== -1 && oldIndex !== index) {
                                  // Create new order by moving the book
                                  const newSortedBooks = [...sortedBooks];
                                  const [movedBook] = newSortedBooks.splice(oldIndex, 1);
                                  newSortedBooks.splice(index, 0, movedBook);
                                  
                                  // Update comparison results to reflect new order
                                  updateComparisonResultsForManualMove(droppedBookId, index, newSortedBooks);
                                  
                                  // Force re-render by updating trigger state
                                  setResultsUpdateTrigger(prev => prev + 1);
                                }
                              }
                              
                              setDraggedBookId(null);
                              setDragOverIndex(null);
                            }}
                            onDragEnd={() => {
                              setDraggedBookId(null);
                              setDragOverIndex(null);
                            }}
                            className={`bg-white/80 backdrop-blur-md rounded-xl p-4 border border-white/30 shadow-sm transition-all ${
                              isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab hover:bg-white/85'
                            } ${isDragOver ? 'border-blue-400 border-2' : ''}`}
                            onClick={(e) => {
                              // Only navigate if not dragging
                              if (!draggedBookId) {
                                const bookIndex = books.findIndex(b => b.id === book.id);
                                if (bookIndex !== -1) {
                                  setSelectedIndex(bookIndex);
                                  setIsPlayingGame(false);
                                  setShowGameResults(false);
                                  setShowBookshelf(false);
                                  setShowBookshelfCovers(false);
                                  setShowNotesView(false);
                                  // Reset scroll to top
                                  setScrollY(0);
                                  const main = document.querySelector('main');
                                  if (main) {
                                    main.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }
                              }
                            }}
                          >
                          <div className="flex gap-4 items-center">
                            {/* Drag Handle */}
                            <div className="flex-shrink-0 text-slate-400 cursor-grab active:cursor-grabbing">
                              <GripVertical size={20} />
                            </div>
                            
                            {/* Rank Number */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            
                            {/* Book Cover */}
                            <div className="flex-shrink-0">
                              {book.cover_url ? (
                                <img 
                                  src={book.cover_url} 
                                  alt={book.title}
                                  className="w-16 h-24 object-cover rounded-lg shadow-sm"
                                />
                              ) : (
                                <div className={`w-16 h-24 rounded-lg flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                                  <BookOpen size={24} className="text-white opacity-50" />
                                </div>
                              )}
                            </div>
                            
                            {/* Book Info */}
                            <div className="flex-1 min-w-0">
                              <h2 className="text-xs font-bold text-slate-950 mb-1 line-clamp-1">{book.title}</h2>
                              <p className="text-xs text-slate-700 mb-1">{book.author}</p>
                              {book.genre && (
                                <p className="text-xs text-slate-600 mb-1">{book.genre}</p>
                              )}
                              {(() => {
                                const avgScore = calculateAvg(book.ratings);
                                if (avgScore) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Star size={12} className="fill-amber-400 text-amber-400" />
                                      <span className="text-xs font-bold text-slate-950">{avgScore}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </motion.div>
                        );
                      })}
                      
                      {/* Replay/Rank More Button - At bottom of list */}
                      {(() => {
                        const availableBooks = books.filter(b => b.reading_status === 'read_it');
                        const hasUnranked = hasUnrankedBooks(availableBooks);
                        const buttonText = hasUnranked ? 'Rank More' : 'Replay';
                        const buttonAction = hasUnranked ? () => {
                          // Continue ranking - just close results and start next comparison
                          setShowGameResults(false);
                          setIsGameCompleting(false);
                          
                          // Start next comparison
                          setTimeout(() => {
                            const availableBooks = books.filter(b => b.reading_status === 'read_it');
                            if (availableBooks.length >= 2) {
                              const mergePair = getNextMergePair(availableBooks);
                              if (mergePair) {
                                const [book1, book2] = mergePair;
                                setGameBook1(book1);
                                setGameBook2(book2);
                                setGameShownBooks(new Set([book1.id, book2.id]));
                                setGameRound(1);
                              } else {
                                // No more comparisons needed
                                setIsPlayingGame(false);
                              }
                            } else {
                              setIsPlayingGame(false);
                            }
                          }, 100);
                        } : () => {
                          // Reset merge sort state to replay
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('bookMergeSortState');
                            localStorage.removeItem('bookComparisonResults');
                          }
                          // Reset game state first - close results view
                          setShowGameResults(false);
                          setIsGameCompleting(false);
                          
                          // Then start new game after a brief delay to allow animation to reset
                          setTimeout(() => {
                            const availableBooks = books.filter(b => b.reading_status === 'read_it');
                            if (availableBooks.length >= 2) {
                              const mergePair = getNextMergePair(availableBooks);
                              if (mergePair) {
                                const [book1, book2] = mergePair;
                                setGameBook1(book1);
                                setGameBook2(book2);
                                setGameShownBooks(new Set([book1.id, book2.id]));
                                setGameRound(1);
                              } else {
                                // If somehow no pair available, just close
                                setIsPlayingGame(false);
                              }
                            } else {
                              // Not enough books, just close
                              setIsPlayingGame(false);
                            }
                          }, 100);
                        };
                        
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: sortedBooks.length * 0.05 }}
                            className="mt-4 pt-4 border-t border-white/30"
                          >
                            <button
                              onClick={buttonAction}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-sm"
                            >
                              <Play size={16} />
                              <span>{buttonText}</span>
                            </button>
                          </motion.div>
                        );
                      })()}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trivia Game Overlay */}
      <AnimatePresence>
        {isPlayingTrivia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !triviaGameComplete) {
                // Minimize game - preserve state, just close the overlay
                setIsPlayingTrivia(false);
                // Don't reset isTriviaReady if we have questions (mid-game)
                // Only reset if we're in the initial ready state
                if (triviaQuestions.length === 0) {
                  setIsTriviaReady(false);
                }
              }
            }}
          >
            {/* Trivia theme music */}
            <audio
              ref={triviaAudioRef}
              src={getAssetPath('/trivia_theme.mp3')}
              preload="auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Trivia Logo - Anchored to top of trivia box, centered on box x-axis */}
              <AnimatePresence>
                {(isTriviaReady || triviaQuestions.length > 0 || triviaGameComplete) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                    style={{ 
                      top: 'calc(-10rem + 70px)'
                    }}
                  >
                    <img 
                      src={getAssetPath('/trivia.png')} 
                      alt="Trivia" 
                      className="h-40 w-auto object-contain block mx-auto"
                      style={{ marginLeft: 'auto', marginRight: 'auto' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>
              
              <div className="px-4 pb-6 max-h-[90vh] overflow-y-auto">
                  {isTriviaReady && !isTriviaLoading && !triviaGameComplete && triviaQuestions.length === 0 ? (
                  <div className="text-center">
                    <h2 className="text-sm font-bold text-slate-950 mb-0">Ready to play!</h2>
                    <p className="text-xs text-slate-700 mb-4">Tap to test your knowledge</p>
                  <button
                    onClick={async () => {
                      setIsTriviaLoading(true);
                      
                      try {
                        // Check if we need to load questions
                        const shouldFetchNew = triviaQuestions.length === 0;
                        
                        if (shouldFetchNew) {
                          // Load new random questions from cache
                          const questions = await loadRandomTriviaQuestions();
                          if (questions.length === 0) {
                            alert('No trivia questions available yet. Add more books with author facts to generate questions!');
                            setIsTriviaLoading(false);
                            return;
                          }
                          
                          if (questions.length < 11) {
                            console.warn(`[Trivia Game] Only ${questions.length} questions available, using all of them`);
                          }
                          
                          setTriviaQuestions(questions);
                        }
                        
                        // Set first play timestamp if not already set (when user first plays)
                        if (!triviaFirstPlayTimestamp) {
                          const timestamp = Date.now();
                          setTriviaFirstPlayTimestamp(timestamp);
                          try {
                            localStorage.setItem('triviaFirstPlayTimestamp', timestamp.toString());
                          } catch (err) {
                            console.warn('[Trivia Timer] Error saving timestamp to localStorage:', err);
                          }
                        }
                        
                        setIsTriviaReady(false);
                      } catch (err) {
                        console.error('[Trivia Game] Error:', err);
                        alert('Error loading trivia questions. Please try again.');
                        setIsTriviaLoading(false);
                      } finally {
                        setIsTriviaLoading(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-sm"
                  >
                    <Play size={16} />
                    <span>Play</span>
                  </button>
                </div>
              ) : isTriviaLoading ? (
                <div className="w-full">
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-xl p-4"
          style={glassmorphicStyle}
                  >
                    <div className="h-12 flex items-center justify-center">
                      <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
                    </div>
                  </motion.div>
                </div>
              ) : triviaGameComplete ? (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold text-slate-950">Trivia Complete!</h2>
                      <button
                        onClick={() => {
                          setIsPlayingTrivia(false);
                          setTriviaGameComplete(false);
                          setCurrentTriviaQuestionIndex(0);
                          setTriviaScore(0);
                          setSelectedTriviaAnswer(null);
                          setTriviaAnswerFeedback(null);
                          setTriviaSelectedAnswers(new Map());
                          setTriviaShuffledAnswers([]);
                          setIsTriviaReady(false);
                        }}
                        className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md hover:bg-white/85 border border-white/30 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                      >
                        <ChevronLeft size={16} className="text-slate-700 rotate-90" />
                      </button>
                    </div>
                    <div className="rounded-xl p-4 mb-4 shadow-sm" style={standardGlassmorphicStyle}>
                      <p className="text-xs font-medium text-slate-700 text-center mb-2">Your Score</p>
                      <p className="text-slate-950 text-center text-2xl font-bold mb-2">{triviaScore} / {triviaQuestions.length}</p>
                      <p className="text-xs text-slate-600 text-center">
                      {triviaScore === triviaQuestions.length 
                        ? 'Perfect score! 🎉' 
                        : triviaScore >= triviaQuestions.length * 0.8
                        ? 'Great job! 🎯'
                        : triviaScore >= triviaQuestions.length * 0.6
                        ? 'Good effort! 👍'
                        : 'Keep practicing! 📚'}
                    </p>
                  </div>
                  
                    {/* Answers Summary */}
                    <div className="rounded-xl p-4 space-y-3 max-h-[50vh] overflow-y-auto shadow-sm" style={standardGlassmorphicStyle}>
                      <h3 className="text-xs font-medium text-slate-700 mb-3">Answers Summary</h3>
                    {triviaQuestions.map((question, qIdx) => {
                      const selectedAnswer = triviaSelectedAnswers.get(qIdx);
                      const isCorrect = selectedAnswer === question.correct_answer;
                      
                      return (
                        <div key={qIdx} className="border-b border-white/30 pb-3 last:border-b-0 last:pb-0">
                          <p className="text-xs font-bold text-slate-950 mb-2">{qIdx + 1}. {question.question}</p>
                          <div className="space-y-1.5">
                            <div className={`px-3 py-2 rounded-xl ${isCorrect ? 'bg-green-50/80 border border-green-200/30' : 'bg-red-50/80 border border-red-200/30'} backdrop-blur-md shadow-sm`}>
                              <p className="text-[10px] font-bold text-slate-950 mb-1">
                                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                              </p>
                              <p className="text-xs text-slate-800">Your answer: <span className="font-bold">{selectedAnswer || 'No answer'}</span></p>
                            </div>
                            {!isCorrect && (
                              <div className="px-3 py-2 rounded-xl bg-green-50/80 border border-green-200/30 backdrop-blur-md shadow-sm">
                                <p className="text-xs text-slate-800">Correct answer: <span className="font-bold">{question.correct_answer}</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {nextQuestionsCountdown && triviaFirstPlayTimestamp ? (
                    <div className="bg-slate-100/80 backdrop-blur-md rounded-xl p-4 border border-slate-200/30 shadow-sm mt-4">
                      <p className="text-xs text-slate-700 text-center font-medium mb-3">New questions available in:</p>
                      <div className="flex justify-center">
                        <span className="countdown font-mono text-2xl">
                          <span 
                            style={{ 
                              '--value': nextQuestionsCountdown.hours 
                            } as React.CSSProperties} 
                            aria-live="polite" 
                            aria-label={nextQuestionsCountdown.hours.toString()}
                          >
                            {nextQuestionsCountdown.hours}
                          </span>
                          {' : '}
                          <span 
                            style={{ 
                              '--value': nextQuestionsCountdown.minutes,
                              '--digits': 2 
                            } as React.CSSProperties} 
                            aria-live="polite" 
                            aria-label={nextQuestionsCountdown.minutes.toString()}
                          >
                            {String(nextQuestionsCountdown.minutes).padStart(2, '0')}
                          </span>
                          {' : '}
                          <span 
                            style={{ 
                              '--value': nextQuestionsCountdown.seconds,
                              '--digits': 2 
                            } as React.CSSProperties} 
                            aria-live="polite" 
                            aria-label={nextQuestionsCountdown.seconds.toString()}
                          >
                            {String(nextQuestionsCountdown.seconds).padStart(2, '0')}
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : triviaFirstPlayTimestamp ? (
                    <div className="bg-slate-100/80 backdrop-blur-md rounded-xl p-4 border border-slate-200/30 shadow-sm mt-4">
                      <p className="text-xs text-slate-700 text-center font-medium">
                        New questions available on next play!
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              ) : triviaQuestions.length > 0 && currentTriviaQuestionIndex < triviaQuestions.length ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTriviaQuestionIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                    style={{ minHeight: '200px' }}
                  >
                    {(() => {
                      // Shuffle answers only when question changes
                      const currentQuestion = triviaQuestions[currentTriviaQuestionIndex];
                      if (triviaShuffledAnswers.length === 0 || 
                          (triviaShuffledAnswers.length > 0 && 
                           !triviaShuffledAnswers.includes(currentQuestion.correct_answer))) {
                        const allAnswers = [
                          currentQuestion.correct_answer,
                          ...currentQuestion.wrong_answers
                        ].sort(() => Math.random() - 0.5);
                        setTriviaShuffledAnswers(allAnswers);
                      }
                      return null;
                    })()}
                    
                      <div className="rounded-xl p-3 mb-3 shadow-sm" style={standardGlassmorphicStyle}>
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-bold text-slate-950">Trivia Game</h2>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsTriviaMuted(!isTriviaMuted)}
                              className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md hover:bg-white/85 border border-white/30 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                              aria-label={isTriviaMuted ? 'Unmute music' : 'Mute music'}
                            >
                              {isTriviaMuted ? (
                                <VolumeX size={14} className="text-slate-700" />
                              ) : (
                                <Volume2 size={14} className="text-slate-700" />
                              )}
                            </button>
                            <span className="text-xs text-slate-700">
                              Question {currentTriviaQuestionIndex + 1} / {triviaQuestions.length}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="rounded-xl p-4 mb-4 shadow-sm" style={standardGlassmorphicStyle}>
                        {(() => {
                          const currentQuestion = triviaQuestions[currentTriviaQuestionIndex];
                          const normalizedTitle = (currentQuestion.book_title || '').toLowerCase().trim();
                          const normalizedAuthor = (currentQuestion.book_author || '').toLowerCase().trim();
                          const sourceBook = books.find(
                            (book) =>
                              (book.title || '').toLowerCase().trim() === normalizedTitle &&
                              (book.author || '').toLowerCase().trim() === normalizedAuthor
                          );
                          if (!sourceBook) return null;
                          return (
                            <div className="flex items-center gap-3 mb-3">
                              {sourceBook.cover_url ? (
                                <img
                                  src={sourceBook.cover_url}
                                  alt={sourceBook.title}
                                  className="w-10 h-14 object-cover rounded-lg flex-shrink-0"
                                  style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }}
                                />
                              ) : (
                                <div className="w-10 h-14 bg-white/60 rounded-lg flex-shrink-0 flex items-center justify-center">
                                  <BookOpen size={14} className="text-slate-500" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-[11px] text-slate-600">From</p>
                                <p className="text-xs font-semibold text-slate-900 truncate">{sourceBook.title}</p>
                                <p className="text-[11px] text-slate-500 truncate">{sourceBook.author}</p>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="text-xs font-bold text-slate-950 mb-4">
                          {triviaQuestions[currentTriviaQuestionIndex].question}
                        </p>
                      
                      <div className="space-y-2">
                        {triviaShuffledAnswers.map((answer, idx) => {
                          const currentQuestion = triviaQuestions[currentTriviaQuestionIndex];
                          const isSelected = selectedTriviaAnswer === answer;
                          const isCorrect = answer === currentQuestion.correct_answer;
                          const showFeedback = triviaAnswerFeedback !== null;
                          
                          // Determine background color based on state
                          let bgColor = 'bg-white/80 backdrop-blur-md hover:bg-white/85';
                          if (isSelected) {
                            if (showFeedback) {
                              // Show feedback color immediately
                              bgColor = isCorrect 
                                ? 'bg-green-200/80' 
                                : 'bg-red-200/80';
                            } else {
                              // Just selected, waiting for feedback
                              bgColor = 'bg-slate-200/80';
                            }
                          } else if (selectedTriviaAnswer !== null) {
                            // Another answer was selected
                            if (showFeedback && isCorrect) {
                              // Highlight correct answer even if not selected
                              bgColor = 'bg-green-100/80';
                            } else {
                              bgColor = 'bg-white/50 opacity-50';
                            }
                          }
                          
                          return (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.preventDefault();
                                if (selectedTriviaAnswer === null) {
                                  setSelectedTriviaAnswer(answer);
                                  // Store selected answer
                                  setTriviaSelectedAnswers(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(currentTriviaQuestionIndex, answer);
                                    return newMap;
                                  });
                                  
                                  const wasCorrect = answer === currentQuestion.correct_answer;
                                  if (wasCorrect) {
                                    triggerSuccessHaptic();
                                    setTriviaScore(prev => prev + 1);
                                  } else {
                                    triggerErrorHaptic();
                                  }

                                  // Show feedback immediately
                                  setTriviaAnswerFeedback(wasCorrect ? 'correct' : 'incorrect');
                                  
                                  // Auto-advance after showing feedback (0.5 seconds)
                                  setTimeout(() => {
                                    setIsTriviaTransitioning(true);
                                    setTimeout(() => {
                                      if (currentTriviaQuestionIndex < triviaQuestions.length - 1) {
                                        setCurrentTriviaQuestionIndex(prev => prev + 1);
                                        setSelectedTriviaAnswer(null);
                                        setTriviaAnswerFeedback(null);
                                        setIsTriviaTransitioning(false);
                                        setTriviaShuffledAnswers([]); // Reset for next question
                                      } else {
                                        setTriviaGameComplete(true);
                                      }
                                    }, 150); // Wait for fade out
                                  }, 500); // Show feedback for 0.5 seconds
                                }
                              }}
                              disabled={selectedTriviaAnswer !== null}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-950 shadow-sm ${
                                selectedTriviaAnswer === null ? 'cursor-pointer' : 'cursor-not-allowed'
                              } ${bgColor}`}
                              style={{ 
                                minHeight: '40px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span>{answer}</span>
                                {isSelected && showFeedback && (
                                  <span className="text-sm">
                                    {isCorrect ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : null}
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence>
          {isAdding && (
            <AddBookSheet 
              isOpen={isAdding} 
              onClose={() => setIsAdding(false)} 
              onAdd={handleAddBook}
              books={books}
              onSelectBook={(bookId) => {
                const bookIndex = books.findIndex(b => b.id === bookId);
                if (bookIndex !== -1) {
                  setSelectedIndex(bookIndex);
                  setShowBookshelf(false);
                  setShowBookshelfCovers(false);
                  setShowNotesView(false);
                  setShowFeedPage(false);
                }
              }}
              onSelectUser={(userId) => {
                setViewingUserId(userId);
                setShowBookshelf(false);
                setShowBookshelfCovers(true);
                setShowNotesView(false);
                setShowAccountPage(false);
                setShowFeedPage(false);
                setShowSortingResults(false);
                setShowFollowingPage(false);
                setIsAdding(false);
              }}
            />
          )}
      </AnimatePresence>

        {/* Book Discussion Modal */}
        <AnimatePresence>
          {showBookDiscussion && activeBook && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-white"
              style={backgroundImageStyle}
            >
              {/* Single scrollable page */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="h-full overflow-y-auto px-4 pt-8 pb-8 space-y-3 ios-scroll"
              >
                {/* Header (scrolls with content) */}
                <div
                  className="flex items-center justify-between py-3 px-4 rounded-2xl mb-4"
                  style={standardGlassmorphicStyle}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowBookDiscussion(false)}
                      className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                      style={standardGlassmorphicStyle}
                    >
                      <X size={18} className="text-slate-950" />
                    </button>
                    <div>
                      <h2 className="font-bold text-slate-950 text-sm">Discussions</h2>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{activeBook.title}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-1">
                    {bookReaders.slice(0, 3).map((reader) => (
                      reader.avatar ? (
                        <img
                          key={reader.id}
                          src={reader.avatar}
                          alt={reader.name}
                          className="w-6 h-6 rounded-full border border-white object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          key={reader.id}
                          className="w-6 h-6 rounded-full border border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600"
                          title={reader.name}
                        >
                          {reader.name.charAt(0).toUpperCase()}
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {/* Section header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm" style={glassmorphicStyle}>
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Discussion Topics</span>
                  </div>
                </div>

                {isLoadingDiscussionQuestions ? (
                  // Loading skeleton
                  <motion.div
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="space-y-3"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="rounded-2xl p-4" style={standardGlassmorphicStyle}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-300/50 flex-shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="w-16 h-3 bg-slate-300/50 rounded" />
                            <div className="w-full h-4 bg-slate-300/50 rounded" />
                            <div className="w-3/4 h-4 bg-slate-300/50 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : discussionQuestions.length > 0 ? (
                  // Discussion questions
                  discussionQuestions.map((question, index) => {
                    const categoryColors: Record<string, string> = {
                      'themes': 'bg-purple-100 text-purple-700',
                      'characters': 'bg-blue-100 text-blue-700',
                      'writing style': 'bg-green-100 text-green-700',
                      'ethics': 'bg-red-100 text-red-700',
                      'personal reflection': 'bg-amber-100 text-amber-700',
                      'real world': 'bg-cyan-100 text-cyan-700',
                    };
                    const colorClass = categoryColors[question.category] || 'bg-slate-100 text-slate-700';

                    return (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-2xl p-4"
                        style={standardGlassmorphicStyle}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-600">{question.id}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass}`}>
                                {question.category}
                              </span>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed">{question.question}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  // Empty state
                  <div className="rounded-xl p-4 text-center" style={standardGlassmorphicStyle}>
                    <p className="text-xs text-slate-600">No discussion topics available yet.</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Infographic Modal */}
        <AnimatePresence>
          {showInfographicModal && activeBook && bookInfographics.has(activeBook.id) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-white"
              style={backgroundImageStyle}
            >
              {(() => {
                const infographic = bookInfographics.get(activeBook.id)!;
                const phaseColors: Record<string, string> = {
                  'opening': 'bg-emerald-500',
                  'early_setup': 'bg-blue-500',
                  'early_story': 'bg-purple-500',
                  'mid_story': 'bg-amber-500',
                };
                const phaseLabels: Record<string, string> = {
                  'opening': 'Opening',
                  'early_setup': 'Early Setup',
                  'early_story': 'Early Story',
                  'mid_story': 'Mid Story',
                };

                // Lucide icon mapping for timeline events
                const iconMap: Record<string, LucideIcon> = {
                  Sunrise, Sunset, Users, User, UserPlus, MapPin, Compass, MessageCircle,
                  Swords, Shield, Heart, Eye, AlertTriangle, Home, Building, Skull, Gift,
                  Lock, Unlock, Flag, Crown, Flame, Footprints, Handshake, Hammer, Key,
                  Mountain, Ship, Tent, TreePine, Wind, Workflow, Megaphone, ScrollText,
                  Feather, Scale, Bomb, Ghost, Wand2, Anchor, BellRing, Bird, Briefcase,
                  Car, Coffee, Drama, Clock, Star, BookOpen, Lightbulb, Target, Search,
                  Sparkles, X, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2,
                  CheckCircle2, Circle, ExternalLink, Info, Play, Pencil, Trophy, Rss,
                  Network, MapIcon, UserCircle,
                };

                const getTimelineIcon = (iconName?: string): LucideIcon => {
                  if (!iconName) return Circle;
                  // Try exact match first
                  if (iconMap[iconName]) return iconMap[iconName];
                  // Try case-insensitive match
                  const lowerName = iconName.toLowerCase();
                  const matchedKey = Object.keys(iconMap).find(k => k.toLowerCase() === lowerName);
                  if (matchedKey) return iconMap[matchedKey];
                  // Default fallback
                  return Circle;
                };

                // Glassmorphic card component following design guidelines
                const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
                  <div
                    className={`rounded-xl ${className}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: 'blur(9.4px)',
                      WebkitBackdropFilter: 'blur(9.4px)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {children}
                  </div>
                );

                return (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="h-full overflow-y-auto px-4 pt-8 pb-12 ios-scroll"
                  >
                    {/* Header */}
                    <header className="text-center space-y-3 mb-8">
                      {/* Close button */}
                      <div className="flex justify-between items-start">
                        <button
                          onClick={() => setShowInfographicModal(false)}
                          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                          style={standardGlassmorphicStyle}
                        >
                          <X size={18} className="text-slate-950" />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={glassmorphicStyle}>
                          <MapIcon size={14} className="text-blue-600" />
                          <span className="text-[10px] font-black tracking-widest uppercase text-slate-600">Reader's Guide</span>
                        </div>
                        <div className="w-8" /> {/* Spacer for centering */}
                      </div>

                      <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight px-4">
                        {activeBook.title}
                      </h1>
                      <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">{activeBook.author}</p>

                      <div className="flex justify-center pt-4">
                        <motion.div
                          animate={{ y: [0, 6, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="p-2 rounded-full"
                          style={glassmorphicStyle}
                        >
                          <ChevronDown size={18} className="text-slate-400" />
                        </motion.div>
                      </div>
                    </header>

                    {/* Section 1: Core Cast */}
                    {infographic.core_cast && infographic.core_cast.length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 px-1">
                          <Star size={14} /> Main Characters
                        </h2>
                        <div className="space-y-4">
                          {infographic.core_cast.map((char, index) => (
                            <motion.div
                              key={`core-${index}`}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.08 }}
                            >
                              <GlassCard className="p-5">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-none">{char.name}</h3>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1.5">{char.role}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <p className="text-xs text-slate-600 leading-relaxed italic">"{char.short_identity}"</p>

                                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/50 pt-3">
                                    {char.main_goal && (
                                      <div>
                                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                          <Target size={10} /> Goal
                                        </h4>
                                        <p className="text-[11px] text-slate-700 leading-tight font-medium">{char.main_goal}</p>
                                      </div>
                                    )}
                                    {char.key_connections && char.key_connections.length > 0 && (
                                      <div>
                                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                          <Users size={10} /> Ties
                                        </h4>
                                        <p className="text-[11px] text-slate-700 leading-tight font-medium">{char.key_connections.join(', ')}</p>
                                      </div>
                                    )}
                                  </div>

                                  {char.why_reader_should_track && (
                                    <div className="bg-blue-50/80 p-2.5 rounded-lg border border-blue-100/50">
                                      <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                        <span className="text-blue-600 font-black uppercase text-[9px] mr-1">Reader Tip:</span>
                                        {char.why_reader_should_track}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </GlassCard>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Section 2: The Ensemble (Other Characters) */}
                    {infographic.full_character_list && infographic.full_character_list.filter(c => c.importance !== 'major').length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 flex items-center gap-2 px-1">
                          <Users size={14} /> Supporting Characters
                        </h2>
                        <div className="space-y-2">
                          {infographic.full_character_list.filter(c => c.importance !== 'major').map((char, index) => (
                            <motion.div
                              key={`ensemble-${index}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.04 }}
                            >
                              <GlassCard className="p-3 flex items-center gap-3">
                                <div className={`w-1.5 h-7 rounded-full flex-shrink-0 ${char.importance === 'supporting' ? 'bg-purple-500' : 'bg-slate-300'}`} />
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-black text-slate-900">{char.name}</h4>
                                  <p className="text-[10px] text-slate-500 leading-tight truncate">{char.short_identity}</p>
                                </div>
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                  {char.importance}
                                </div>
                              </GlassCard>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Section 3: Journey Roadmap (Timeline) */}
                    {infographic.plot_timeline && infographic.plot_timeline.length > 0 && (
                      <section className="space-y-4 mb-10">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2 px-1">
                          <Clock size={14} /> Timeline
                        </h2>
                        <div className="relative ml-3 pl-6 space-y-6 pb-4">
                          {/* Vertical timeline line - centered with icons */}
                          <div
                            className="absolute top-0 bottom-0 w-[2px] rounded-full"
                            style={{
                              left: '3px', // Centers with 28px icons at -35px from content
                              background: 'rgba(255, 255, 255, 0.5)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                          />
                          {infographic.plot_timeline.map((event, index) => {
                            const TimelineIcon = getTimelineIcon(event.icon);
                            return (
                              <motion.div
                                key={`timeline-${index}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.06 }}
                                className="relative"
                              >
                                {/* Timeline icon - glassmorphic style, aligned with header */}
                                <div
                                  className="absolute -left-[35px] -top-[3px] w-7 h-7 rounded-full flex items-center justify-center shadow-sm"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(9.4px)',
                                    WebkitBackdropFilter: 'blur(9.4px)',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                  }}
                                >
                                  <TimelineIcon
                                    size={14}
                                    strokeWidth={2}
                                    className={
                                      event.phase === 'opening' ? 'text-emerald-600' :
                                      event.phase === 'early_setup' ? 'text-blue-600' :
                                      event.phase === 'early_story' ? 'text-purple-600' :
                                      event.phase === 'mid_story' ? 'text-amber-600' :
                                      'text-slate-600'
                                    }
                                  />
                                </div>

                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">{event.event_label}</h4>
                                  <GlassCard className="mt-2 p-3">
                                    <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{event.what_happens}</p>
                                    {event.characters_involved && event.characters_involved.length > 0 && (
                                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/30 text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                        <Users size={11} /> {event.characters_involved.join(', ')}
                                      </div>
                                    )}
                                    {event.why_it_helps_orientation && (
                                      <p className="text-[10px] text-emerald-600 font-medium mt-2 pt-2 border-t border-slate-200/30">
                                        💡 {event.why_it_helps_orientation}
                                      </p>
                                    )}
                                  </GlassCard>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Footer */}
                    <div className="pt-8 flex flex-col items-center gap-3 opacity-40">
                      <BookOpen size={20} className="text-slate-500" />
                      <p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-500">End of Guide</p>
                    </div>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick View Modal for Books from Other Users */}
      <AnimatePresence>
          {viewingBookFromOtherUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[100] flex items-center justify-center px-4"
              onClick={() => setViewingBookFromOtherUser(null)}
            >
              {/* Full screen glassmorphic background */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0"
                style={{ ...standardGlassmorphicStyle, borderRadius: 0 }}
              />
              
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex flex-col items-center pointer-events-auto z-10 p-4"
                style={{ maxHeight: '80vh' }}
              >
                {/* Book Cover - matching book page style */}
                <div
                  className="relative w-[272px] aspect-[2/3] overflow-hidden rounded-lg cursor-pointer"
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 30px 5px rgba(255, 255, 255, 0.3)',
                  }}
                  onClick={() => setViewingBookFromOtherUser(null)}
                >
                  {viewingBookFromOtherUser.cover_url ? (
                    <img
                      src={viewingBookFromOtherUser.cover_url}
                      alt={viewingBookFromOtherUser.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                      <BookOpen size={48} className="text-slate-400" />
                    </div>
                  )}

                  {/* Rating Display - Bottom Left Corner */}
                  {(() => {
                    const avgScore = calculateAvg(viewingBookFromOtherUser.ratings);
                    if (avgScore) {
                      return (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          <span className="text-sm font-bold text-white">
                            {avgScore}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Book Info */}
                <div className="mt-4 text-center space-y-2 max-w-[272px]">
                  <h2 className="text-lg font-bold text-slate-950">
                    {viewingBookFromOtherUser.title}
                  </h2>
                  {viewingBookFromOtherUser.author && (
                    <p className="text-sm text-slate-800">
                      {viewingBookFromOtherUser.author}
                    </p>
                  )}
                  {viewingBookFromOtherUser.publish_year && (
                    <p className="text-xs text-slate-600">
                      {viewingBookFromOtherUser.publish_year}
                    </p>
                  )}
                </div>

                {/* Add Button */}
                <button
                  onClick={async () => {
                    if (!user) return;

                    // Prepare book metadata (exclude user-specific fields)
                    const bookMeta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> = {
                      title: viewingBookFromOtherUser.title || '',
                      author: viewingBookFromOtherUser.author || 'Unknown Author',
                      publish_year: viewingBookFromOtherUser.publish_year || null,
                      cover_url: viewingBookFromOtherUser.cover_url || null,
                      wikipedia_url: viewingBookFromOtherUser.wikipedia_url || null,
                      google_books_url: viewingBookFromOtherUser.google_books_url || null,
                      genre: viewingBookFromOtherUser.genre || null,
                      first_issue_year: viewingBookFromOtherUser.first_issue_year || null,
                      summary: (viewingBookFromOtherUser as any).summary || null,
                      notes: null, // Don't copy notes
                      reading_status: null, // User will set this
                    };

                    // Close the modal first
                    setViewingBookFromOtherUser(null);

                    // Close bookshelf views
                    setViewingUserId(null);
                    setShowBookshelf(false);
                    setShowBookshelfCovers(false);
                    setShowNotesView(false);
                    setShowAccountPage(false);
                    setShowFeedPage(false);

                    // Add the book - handleAddBook will handle navigation
                    await handleAddBook(bookMeta);
                  }}
                  className="mt-4 py-2.5 px-8 text-white font-bold rounded-xl active:scale-95 transition-all"
                  style={{
                    background: 'rgba(59, 130, 246, 0.85)',
                    backdropFilter: 'blur(9.4px)',
                    WebkitBackdropFilter: 'blur(9.4px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  Add book
                </button>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* About Screen Modal */}
      <AnimatePresence>
        {showAboutScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            onClick={() => {
              setShowAboutScreen(false);
              localStorage.setItem('hasSeenIntro', 'true');
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAboutScreen(false);
                localStorage.setItem('hasSeenIntro', 'true');
              }}
              className="absolute top-[65px] right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={standardGlassmorphicStyle}
            >
              <X size={18} className="text-slate-950" />
            </button>
            {/* Background image */}
            <div
              className="fixed inset-0"
              style={{
                backgroundImage: `url(${getAssetPath('/bg.png')})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            {/* Full screen glassmorphic overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0"
              style={{ ...standardGlassmorphicStyle, borderRadius: 0 }}
            />

            {/* Main container - normal flow vertical stack */}
            {featureFlags.info_page_variant === 'c' ? (
              /* Variant C: 3-page stepper */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 pointer-events-auto w-full h-full"
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  setAboutTouchStart({ x: touch.clientX, y: touch.clientY });
                }}
                onTouchMove={(e) => {
                  if (aboutTouchStart) {
                    const touch = e.touches[0];
                    setAboutTouchEnd({ x: touch.clientX, y: touch.clientY });
                  }
                }}
                onTouchEnd={() => {
                  if (!aboutTouchStart || !aboutTouchEnd) {
                    setAboutTouchStart(null);
                    setAboutTouchEnd(null);
                    return;
                  }
                  const distanceX = aboutTouchStart.x - aboutTouchEnd.x;
                  const distanceY = aboutTouchStart.y - aboutTouchEnd.y;
                  const minSwipeDistance = 50;
                  if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
                    if (distanceX > 0 && aboutPageIndex < 2) {
                      setAboutSwipeDirection('forward');
                      setAboutPageIndex(prev => prev + 1); // Swipe left = next
                    } else if (distanceX < 0 && aboutPageIndex > 0) {
                      setAboutSwipeDirection('backward');
                      setAboutPageIndex(prev => prev - 1); // Swipe right = prev
                    }
                  }
                  setAboutTouchStart(null);
                  setAboutTouchEnd(null);
                }}
              >
                {/* Fixed logo_text header that stays in place on all pages */}
                <div className="absolute top-[8vh] left-0 right-0 flex justify-center z-0 pointer-events-none">
                  <img
                    src={getAssetPath('/logo_text.png')}
                    alt="Logo"
                    className="h-[min(20px,3vh)] object-contain"
                  />
                </div>

                {/* Fixed logo that stays in place on all pages */}
                <div className="absolute bottom-[calc(7vh+15px)] left-0 right-0 flex justify-center z-0 pointer-events-none">
                  <img
                    src={getAssetPath('/logo_tight.png')}
                    alt="Logo"
                    className="w-[min(192px,23vh)] h-[min(192px,23vh)] object-contain"
                    style={{
                      filter: 'drop-shadow(0 20px 40px rgba(255, 255, 255, 0.8))',
                    }}
                  />
                </div>

                {/* Full page content that swipes together */}
                <AnimatePresence initial={false} mode="popLayout">
                  {aboutPageIndex === 0 && (
                    <motion.div
                      key="page-0"
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="absolute inset-0 flex flex-col items-center px-8"
                    >
                      {/* Header - anchored to top */}
                      <motion.div
                        className="absolute top-[14vh] left-0 right-0 flex flex-col items-center gap-[1vh] px-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 text-center uppercase leading-tight">
                          GET MORE FROM READING
                        </h1>
                        <p className="text-[min(17px,2.2vh)] text-slate-600 text-center">
                          Videos, podcasts, fun facts and context around your book — All in one place.
                        </p>
                      </motion.div>

                      {/* Content - notifications anchored above logo - animates in after page transition */}
                      <motion.div
                        className="absolute bottom-[32vh] left-0 right-0 flex justify-center px-8 z-10"
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.35, ease: 'easeOut' }}
                      >
                        <InfoPageTooltips />
                      </motion.div>

                    </motion.div>
                  )}

                  {aboutPageIndex === 1 && (
                    <motion.div
                      key="page-1"
                      initial={{ x: aboutSwipeDirection === 'forward' ? '100%' : '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: aboutSwipeDirection === 'forward' ? '-100%' : '100%' }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="absolute inset-0 flex flex-col items-center px-8"
                    >
                      {/* Header - anchored to top */}
                      <div className="absolute top-[14vh] left-0 right-0 flex flex-col items-center gap-[1vh] px-8">
                        <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 text-center uppercase leading-tight">
                          TALK ABOUT<br />YOUR BOOK
                        </h1>
                        <p className="text-[min(17px,2.2vh)] text-slate-600 text-center px-4">
                          Join discussions and book clubs, with real people or with your private AI bot.
                        </p>
                      </div>

                      {/* Content - anchored above pagination */}
                      <div className="absolute bottom-[34vh] left-0 right-0 flex justify-center px-8 z-10">
                        <div className="flex flex-col gap-[min(12px,1.5vh)] w-full max-w-[min(300px,85vw)]">
                          {/* Message 1 - from left */}
                          <motion.div
                            initial={{ opacity: 0, x: -30, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.3, type: "spring", stiffness: 150 }}
                            className="flex items-end gap-2 self-start"
                          >
                            <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                              background: 'rgba(147, 51, 234, 0.75)',
                              border: '1px solid rgba(147, 51, 234, 0.3)',
                            }}>
                              <User size={14} className="text-white" />
                            </div>
                            <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-bl-md max-w-[min(200px,55vw)]" style={{
                              background: 'rgba(255, 255, 255, 0.7)',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255, 255, 255, 0.4)',
                            }}>
                              <p className="text-[min(14px,1.8vh)] text-slate-700">What did you think of the ending?</p>
                            </div>
                          </motion.div>

                          {/* Message 2 - from right */}
                          <motion.div
                            initial={{ opacity: 0, x: 30, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.6, type: "spring", stiffness: 150 }}
                            className="flex items-end gap-2 self-end flex-row-reverse"
                          >
                            <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                              background: 'rgba(59, 130, 246, 0.75)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                            }}>
                              <User size={14} className="text-white" />
                            </div>
                            <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-br-md max-w-[min(200px,55vw)]" style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                            }}>
                              <p className="text-[min(14px,1.8vh)] text-slate-700">I was shocked! Didn&apos;t see it coming</p>
                            </div>
                          </motion.div>

                          {/* Message 3 - AI bot from left */}
                          <motion.div
                            initial={{ opacity: 0, x: -30, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.9, type: "spring", stiffness: 150 }}
                            className="flex items-end gap-2 self-start"
                          >
                            <div className="w-[min(32px,4vh)] h-[min(32px,4vh)] rounded-full flex-shrink-0 flex items-center justify-center" style={{
                              background: 'rgba(16, 185, 129, 0.75)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}>
                              <Bot size={14} className="text-white" />
                            </div>
                            <div className="px-3 py-[min(8px,1vh)] rounded-2xl rounded-bl-md max-w-[min(220px,60vw)]" style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}>
                              <p className="text-[min(14px,1.8vh)] text-slate-700">The foreshadowing in chapter 3 hinted at it!</p>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  {aboutPageIndex === 2 && (
                    <motion.div
                      key="page-2"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="absolute inset-0 flex flex-col items-center px-8"
                    >
                      {/* Header - anchored to top */}
                      <div className="absolute top-[14vh] left-0 right-0 flex flex-col items-center gap-[1vh] px-8">
                        <h1 className="text-[min(28px,3.5vh)] font-bold text-slate-900 text-center uppercase leading-tight">
                          START WITH<br />YOUR BOOK
                        </h1>
                        <p className="text-[min(17px,2.2vh)] text-slate-600 text-center">
                          Add a book you're reading to start exploring now
                        </p>
                      </div>

                      {/* Placeholder book cover */}
                      <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.2, type: "spring", stiffness: 150 }}
                        className="absolute bottom-[42vh] left-0 right-0 flex justify-center px-8"
                      >
                        <button
                          onClick={() => {
                            setShowAboutScreen(false);
                            setAboutPageIndex(0);
                            localStorage.setItem('hasSeenIntro', 'true');
                            setIsAdding(true);
                          }}
                          className="w-[min(96px,12vh)] aspect-[2/3] rounded-lg overflow-hidden shadow-lg flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                          style={glassmorphicStyle}
                        >
                          <Plus size={32} className="text-slate-400" />
                        </button>
                      </motion.div>

                      {/* CTA Button - positioned above logo_tight */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.4, type: "spring", stiffness: 150 }}
                        className="absolute bottom-[32vh] left-0 right-0 flex justify-center px-8"
                      >
                        <button
                          onClick={() => {
                            setShowAboutScreen(false);
                            setAboutPageIndex(0);
                            localStorage.setItem('hasSeenIntro', 'true');
                            setIsAdding(true);
                          }}
                          className="px-8 py-3 text-white font-semibold text-base active:scale-95 transition-transform"
                          style={blueGlassmorphicStyle}
                        >
                          Add a book
                        </button>
                      </motion.div>

                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pagination dots - anchored to bottom (stays fixed) */}
                <div className="absolute bottom-[60px] left-0 right-0 flex justify-center z-20">
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setAboutSwipeDirection(index > aboutPageIndex ? 'forward' : 'backward');
                          setAboutPageIndex(index);
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-[width] duration-300 ${
                          aboutPageIndex === index
                            ? 'bg-blue-500 w-6'
                            : 'bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Variant A & B: Original single-page layout */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 pointer-events-auto mx-auto max-w-md flex flex-col items-center px-8 pt-10 pb-8 gap-5"
              >
                {/* 1) HEADER - in flow */}
                <motion.h1
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="text-[30px] font-bold text-slate-900 text-center uppercase leading-tight"
                >
                  DISCOVER THE WORLD AROUND THE BOOK
                </motion.h1>

                {/* 2) LOGO CONTAINER - with notifications on top */}
                <div className="relative flex items-center justify-center h-[220px] mt-[84px]">
                  {/* Notifications overlay - variant B */}
                  {featureFlags.info_page_variant === 'b' && (
                    <div className="absolute -top-[70px] left-1/2 -translate-x-1/2 z-10">
                      <InfoPageTooltips />
                    </div>
                  )}

                  <motion.img
                    src={getAssetPath('/logo_tight.png')}
                    alt="Logo"
                    className="w-56 h-56 object-contain"
                    style={{
                      filter: 'drop-shadow(0 20px 40px rgba(255, 255, 255, 0.8))',
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  />

                  {/* Heart animation on top of logo */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                    className="absolute top-[62px] left-1/2 pointer-events-none"
                    style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.7)', mixBlendMode: 'overlay' }}
                  >
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                    className="absolute top-[62px] left-1/2 pointer-events-none"
                    style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.7)', mixBlendMode: 'overlay' }}
                  >
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                    className="absolute top-[62px] left-1/2 pointer-events-none"
                    style={{ transform: 'translateX(calc(-50% - 6px)) scale(0.7)', mixBlendMode: 'overlay' }}
                  >
                    <Lottie animationData={heartAnimation} loop={false} className="w-24 h-24" />
                  </motion.div>

                  {featureFlags.info_page_variant === 'a' ? (
                    <>
                      {/* Variant A: Animated icons */}
                      <motion.div
                        initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                        animate={{ scale: 1, opacity: 1, x: -130, y: -140 }}
                        transition={{ duration: 0.6, delay: 0.6, type: "spring", stiffness: 150 }}
                        className="absolute"
                      >
                        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{
                          background: 'rgba(147, 51, 234, 0.75)',
                          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(147, 51, 234, 0.3)',
                        }}>
                          <Headphones size={30} className="text-white" />
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                        animate={{ scale: 1, opacity: 1, x: -50, y: -160 }}
                        transition={{ duration: 0.6, delay: 0.75, type: "spring", stiffness: 150 }}
                        className="absolute"
                      >
                        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{
                          background: 'rgba(239, 68, 68, 0.75)',
                          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}>
                          <Play size={30} className="text-white" />
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                        animate={{ scale: 1, opacity: 1, x: 50, y: -160 }}
                        transition={{ duration: 0.6, delay: 0.9, type: "spring", stiffness: 150 }}
                        className="absolute"
                      >
                        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{
                          background: 'rgba(234, 179, 8, 0.75)',
                          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                        }}>
                          <Microscope size={30} className="text-white" />
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                        animate={{ scale: 1, opacity: 1, x: 130, y: -140 }}
                        transition={{ duration: 0.6, delay: 1.05, type: "spring", stiffness: 150 }}
                        className="absolute"
                      >
                        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center" style={{
                          background: 'rgba(255, 255, 255, 0.75)',
                          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(9.4px)',
                          WebkitBackdropFilter: 'blur(9.4px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}>
                          <MessagesSquare size={30} className="text-slate-800" />
                        </div>
                      </motion.div>
                    </>
                  ) : null}
                </div>

                {/* 4) DESCRIPTION */}
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="text-[18.4px] text-slate-600 text-center"
                >
                  Book.Luv finds interesting <span className="font-semibold text-slate-800">facts</span>, <span className="font-semibold text-slate-800">videos</span>, <span className="font-semibold text-slate-800">podcasts</span> and <span className="font-semibold text-slate-800">discussions</span> around the book you're reading.
                </motion.p>

                {/* 5) BUTTON */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 1.3 }}
                  onClick={() => {
                    setShowAboutScreen(false);
                    localStorage.setItem('hasSeenIntro', 'true');
                    setIsAdding(true);
                  }}
                  className="px-8 py-3 text-white font-semibold text-base active:scale-95 transition-transform mt-6"
                  style={blueGlassmorphicStyle}
                >
                  Add a book
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile panel menu - rendered at root level for topmost z-index */}
      <AnimatePresence>
        {showProfileMenu && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowProfileMenu(false)}
            />
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed top-[200px] left-[26px] z-[9999] rounded-lg min-w-[140px] overflow-hidden"
              style={glassmorphicStyle}
            >
              <button
                onClick={() => {
                  setShowAccountPage(true);
                  setShowProfileMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-white/20 active:bg-white/30 transition-colors border-b border-white/20"
              >
                <User size={16} className="text-slate-600" />
                <span>Account</span>
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  setShowProfileMenu(false);
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

      {/* Reading Book Picker Modal */}
      <AnimatePresence>
        {showReadingBookPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-end bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowReadingBookPicker(false)}
          >
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-white/30 flex flex-col"
              style={{ maxHeight: '70vh' }}
            >
              {/* Handle bar */}
              <div className="w-full flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-12 h-1 bg-slate-400 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 pb-3 flex-shrink-0">
                <h2 className="text-lg font-bold text-slate-950">Start Reading</h2>
                <p className="text-xs text-slate-600">Pick from your "Want to read" list</p>
              </div>

              {/* Book List */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 ios-scroll">
                {(() => {
                  const wantToReadBooks = books.filter(b => b.reading_status === 'want_to_read');

                  if (wantToReadBooks.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <BookMarked size={32} className="mx-auto mb-3 text-slate-400" />
                        <p className="text-sm text-slate-600">No books in your "Want to read" list</p>
                        <button
                          onClick={() => {
                            setShowReadingBookPicker(false);
                            setIsAdding(true);
                          }}
                          className="mt-4 px-4 py-2 rounded-lg font-bold text-sm text-white active:scale-95 transition-all"
                          style={{
                            background: 'rgba(59, 130, 246, 0.85)',
                            backdropFilter: 'blur(9.4px)',
                            WebkitBackdropFilter: 'blur(9.4px)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          Add a book
                        </button>
                      </div>
                    );
                  }

                  return wantToReadBooks.map((book, i) => (
                    <motion.button
                      key={book.id}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50/80 backdrop-blur-md hover:bg-blue-100/85 rounded-xl border border-blue-200/30 shadow-sm transition-all text-left"
                      onClick={async () => {
                        // Update book status to "reading"
                        try {
                          const { error } = await supabase
                            .from('books')
                            .update({ reading_status: 'reading' })
                            .eq('id', book.id);

                          if (!error) {
                            // Update local state
                            setBooks(prev => prev.map(b =>
                              b.id === book.id ? { ...b, reading_status: 'reading' } : b
                            ));
                            triggerSuccessHaptic();
                          }
                        } catch (err) {
                          console.error('Error updating book status:', err);
                        }
                        setShowReadingBookPicker(false);
                      }}
                    >
                      {/* Book Cover */}
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className={`w-12 h-16 rounded flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getGradient(book.id)}`}>
                          <BookOpen size={20} className="text-white opacity-50" />
                        </div>
                      )}

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-950 truncate">{book.title}</h3>
                        <p className="text-xs text-slate-800 truncate">{book.author}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {book.publish_year && (
                            <p className="text-[10px] text-slate-600">{book.publish_year}</p>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-100">
                            Your Book
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ));
                })()}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screenshot Mode Overlay - for App Store screenshots */}
      {screenshotMode && (
        <>
          <div
            className="fixed bottom-12 left-0 right-0 z-[10000] flex justify-center px-6 pointer-events-none"
          >
            <div
              className="text-center"
              style={{
                padding: '20px 32px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: 20,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                maxWidth: '90%',
              }}
            >
              <p className="text-xl font-bold text-slate-900">
                {screenshotOverlayText}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
