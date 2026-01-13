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
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/components/LoginScreen';
import { supabase } from '@/lib/supabase';

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
  platform: string;
  episode_summary: string;
  podcast_summary: string;
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
  rating_writing?: number | null;
  rating_insight?: number | null;
  rating_flow?: number | null;
  author_facts?: string[] | null; // JSON array of author facts
  podcast_episodes?: PodcastEpisode[] | null; // JSON array of podcast episodes
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
  podcast_episodes?: PodcastEpisode[]; // Podcast episodes about the book
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
  
  const prompt = `You are a book title expert. The user is searching for a book with a potentially misspelled or partial title.
Analyze the query: "${query}"
Return a JSON object with a "suggestions" array containing the top 3 most likely real book titles with their authors.
Format each suggestion as "Book Title/Author Name" (use forward slash as separator).
Keep the titles exact so they work well in a Wikipedia search.
If the input is Hebrew, suggest Hebrew titles.
Return ONLY valid JSON in this format: { "suggestions": ["Title 1/Author 1", "Title 2/Author 2", "Title 3/Author 3"] }`;

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

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`
      },
      body: JSON.stringify(payload)
    });
    const content = data.choices?.[0]?.message?.content || '{"suggestions":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    return JSON.parse(jsonStr).suggestions || [];
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
  console.log('[getGrokAuthorFacts] Making request to Grok API...');
  
  const prompt = `You are a literary expert. Generate exactly 10 interesting, fun facts about the author "${author}" specifically in the context of their book "${bookTitle}".

Requirements:
- Return exactly 10 facts
- Each fact should be concise (1-2 sentences max)
- Focus on interesting, lesser-known details
- Connect facts to the book when possible
- Make facts engaging and fun
- Return ONLY valid JSON in this format: { "facts": ["Fact 1", "Fact 2", ..., "Fact 10"] }`;

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

  try {
    console.log('[getGrokAuthorFacts] Sending request with payload:', JSON.stringify(payload, null, 2));
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    console.log('[getGrokAuthorFacts] Received response:', data);
    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
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
  
  const prompt = `Find me podcast episodes for the book "${bookTitle}" by ${author}.
I want the response to be only the list of results in JSON format.
Very very concise with minimal description. Include: title, length, air_date, url, platform, episode_summary (short summary of the podcast episode), podcast_summary (short summary of the podcast itself).
Prioritize podcasts that specialize on book reviews / book club type analysis or discussion / deep interviews with author on the book in question.
Return ONLY valid JSON in this format: { "episodes": [{"title": "...", "length": "...", "air_date": "...", "url": "...", "platform": "...", "episode_summary": "...", "podcast_summary": "..."}, ...] }`;

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
    const content = data.choices?.[0]?.message?.content || '{"episodes":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    const episodes = result.episodes || [];
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

async function getPodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
  console.log(`[getPodcastEpisodes] 🔄 Fetching podcast episodes for "${bookTitle}" by ${author}`);
  return getGrokPodcastEpisodes(bookTitle, author);
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

function convertBookToApp(book: Book): BookWithRatings {
  return {
    ...book,
    ratings: {
      writing: book.rating_writing ?? null,
      insight: book.rating_insight ?? null,
      flow: book.rating_flow ?? null,
    },
    author_facts: book.author_facts || undefined, // Load from database
    podcast_episodes: book.podcast_episodes || undefined, // Load from database
  };
}

function convertBookToDb(book: BookWithRatings): Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    title: book.title,
    author: book.author,
    publish_year: book.publish_year,
    cover_url: book.cover_url,
    wikipedia_url: book.wikipedia_url,
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
          className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/40"
        >
          <div className="h-12 flex items-center justify-center">
            <div className="w-full h-4 bg-slate-200/60 rounded animate-pulse" />
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
            className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/40"
          >
            <p className="text-xs font-medium text-slate-800 leading-relaxed text-center">
              💡 {currentFact}
            </p>
            <p className="text-[10px] text-slate-400 text-center mt-2 font-bold uppercase tracking-wider">
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

  useEffect(() => {
    // Reset when book changes
    setCurrentIndex(0);
    setIsVisible(false);
    
    if (episodes.length === 0) return;

    // Show first episode after a short delay
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [episodes, bookId]);

  function handleNext() {
    setIsVisible(false);
    // Wait for fade out, then show next (or loop back to first)
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % episodes.length);
      setIsVisible(true);
    }, 300);
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <motion.div
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/40"
        >
          <div className="space-y-3">
            <div className="h-4 bg-slate-200/60 rounded animate-pulse" />
            <div className="h-3 bg-slate-200/60 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-slate-200/60 rounded w-2/3 animate-pulse" />
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
            className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl border border-white/40"
          >
            <div className="flex items-start gap-2 mb-2">
              <Headphones size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <a 
                href={currentEpisode.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex-1"
              >
                {currentEpisode.title}
              </a>
            </div>
            <div className="text-[10px] text-slate-500 space-y-1 mb-2">
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
            <p className="text-[10px] font-medium text-slate-700 leading-relaxed mb-1">
              {currentEpisode.episode_summary}
            </p>
            {currentEpisode.podcast_summary && (
              <p className="text-[9px] text-slate-500 italic">
                {currentEpisode.podcast_summary}
              </p>
            )}
            <p className="text-[10px] text-slate-400 text-center mt-2 font-bold uppercase tracking-wider">
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
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900/60 mb-1">{dimension}</h3>
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
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(titleToSearch = query) {
    if (!titleToSearch.trim()) return;
    setLoading(true);
    setError('');
    
    const wikiPromise = lookupBookOnWikipedia(titleToSearch);
    const aiPromise = getAISuggestions(titleToSearch);

    try {
      const [meta, aiSuggestions] = await Promise.all([wikiPromise, aiPromise]);
      
      setSuggestions(aiSuggestions);

      if (meta) {
        onAdd(meta);
        setQuery('');
        setSuggestions([]);
        onClose();
      } else {
        setError(`Couldn't find an exact match on Wikipedia.`);
      }
    } catch (err) {
      setError("Search failed. Please try a different title.");
    } finally {
      setLoading(false);
    }
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
        className="w-full max-w-md bg-white rounded-t-3xl p-3 shadow-2xl pb-5"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
          <div className="relative">
            <input 
              ref={inputRef}
              type="text" 
              inputMode="search"
              placeholder={isQueryHebrew ? "חפש ספר..." : "Search for a book..."}
              value={query} 
              onChange={e => setQuery(e.target.value)}
              className={`w-full py-4 bg-slate-100 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 text-lg outline-none ${isQueryHebrew ? 'text-right pr-4 pl-12' : 'pl-4 pr-12'}`}
              dir={isQueryHebrew ? "rtl" : "ltr"}
            />
            <button 
              type="submit" 
              disabled={loading} 
              className={`absolute top-2 bottom-2 aspect-square bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 ${isQueryHebrew ? 'left-2' : 'right-2'}`}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
          </div>
          
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                <div className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-400" /> Did you mean?
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-red-500 text-sm px-2 font-medium">{error}</p>}
        </form>
        <p className="mt-4 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5 uppercase tracking-wider">
          <Library size={12} /> Powered by Wikipedia & AI
        </p>
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

  // Fetch author facts for existing books when they're selected (if missing)
  useEffect(() => {
    const currentBook = books[selectedIndex];
    if (!currentBook || !currentBook.title || !currentBook.author) {
      setLoadingFactsForBookId(null);
      return;
    }

    // Check if facts already exist in database
    if (currentBook.author_facts && currentBook.author_facts.length > 0) {
      console.log(`[Author Facts] ✅ Loaded from database for "${currentBook.title}" by ${currentBook.author}: ${currentBook.author_facts.length} facts`);
      setLoadingFactsForBookId(null);
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

    // Check if podcasts already exist in database
    if (currentBook.podcast_episodes && currentBook.podcast_episodes.length > 0) {
      console.log(`[Podcast Episodes] ✅ Loaded from database for "${currentBook.title}" by ${currentBook.author}: ${currentBook.podcast_episodes.length} episodes`);
      setLoadingPodcastsForBookId(null);
      return;
    }

    let cancelled = false;
    const bookId = currentBook.id;

    // Set loading state
    setLoadingPodcastsForBookId(bookId);

    // Add a delay to avoid rate limits when scrolling through books
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      
      const bookTitle = currentBook.title;
      const bookAuthor = currentBook.author;
      
      console.log(`[Podcast Episodes] 🔄 Fetching from Grok API for "${bookTitle}" by ${bookAuthor}...`);
      getPodcastEpisodes(bookTitle, bookAuthor).then(async (episodes) => {
        if (cancelled) return;
        
        // Clear loading state
        setLoadingPodcastsForBookId(null);
        
        if (episodes.length > 0) {
          console.log(`[Podcast Episodes] ✅ Received ${episodes.length} episodes from Grok API for "${bookTitle}"`);
          // Save to database
          try {
            const { error: updateError } = await supabase
              .from('books')
              .update({ podcast_episodes: episodes, updated_at: new Date().toISOString() })
              .eq('id', bookId);
            
            if (updateError) throw updateError;
            
            console.log(`[Podcast Episodes] 💾 Saved ${episodes.length} episodes to database for "${bookTitle}"`);
            
            // Update local state
            setBooks(prev => prev.map(book => 
              book.id === bookId 
                ? { ...book, podcast_episodes: episodes }
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
                ? { ...book, podcast_episodes: episodes }
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
  }, [selectedIndex, books]); // Depend on selectedIndex and books

  async function handleAddBook(meta: Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insight' | 'rating_flow'>) {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('books')
        .insert({
          ...meta,
          user_id: user.id,
          rating_writing: null,
          rating_insight: null,
          rating_flow: null,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const newBook = convertBookToApp(data);
      const newBooks = [newBook, ...books];
      setBooks(newBooks);
      setSelectedIndex(0);

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
        console.log(`[Podcast Episodes] 🔄 Fetching from Grok API for new book "${meta.title}" by ${meta.author}...`);
        setLoadingPodcastsForBookId(newBook.id);
        getPodcastEpisodes(meta.title, meta.author).then(async (episodes) => {
          setLoadingPodcastsForBookId(null);
          if (episodes.length > 0) {
            console.log(`[Podcast Episodes] ✅ Received ${episodes.length} episodes from Grok API for "${meta.title}"`);
            // Save to database
            try {
              const { error: updateError } = await supabase
                .from('books')
                .update({ podcast_episodes: episodes, updated_at: new Date().toISOString() })
                .eq('id', newBook.id);
              
              if (updateError) throw updateError;
              
              console.log(`[Podcast Episodes] 💾 Saved ${episodes.length} episodes to database for "${meta.title}"`);
              
              // Update local state
              setBooks(prev => prev.map(book => 
                book.id === newBook.id 
                  ? { ...book, podcast_episodes: episodes }
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
                book.id === newBook.id 
                  ? { ...book, podcast_episodes: episodes }
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
    } catch (err) {
      console.error('Error adding book:', err);
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

  return (
    <div className="fixed inset-0 bg-slate-50 text-slate-900 font-sans select-none overflow-hidden flex flex-col">
      {/* Persistent menu bar */}
      <div className="w-full z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Signed in as</span>
              <span className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-none">
                {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg font-medium text-sm active:scale-95 transition-all"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start p-4 relative pt-4 overflow-y-auto pb-20">
        {books.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4"><BookOpen size={40} className="text-white opacity-90" /></div>
          </div>
        ) : (
          <div className="w-full max-w-[340px] flex flex-col items-center gap-6 pb-8">
            <div className="relative w-full aspect-[2/3] rounded-3xl shadow-2xl border border-white/50 overflow-hidden group">
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


              <div className="absolute top-4 left-4 z-30 max-w-[80%]">
                <motion.div 
                  initial={false}
                  animate={{ 
                    width: isMetaExpanded ? 'auto' : '44px',
                    height: isMetaExpanded ? 'auto' : '44px',
                    padding: isMetaExpanded ? '12px' : '0px',
                    borderRadius: '22px'
                  }}
                  onClick={() => setIsMetaExpanded(!isMetaExpanded)}
                  className="bg-white/90 backdrop-blur-md shadow-xl border border-white/20 cursor-pointer flex items-center justify-center overflow-hidden"
                >
                  <AnimatePresence mode="wait">
                    {isMetaExpanded ? (
                      <motion.div key="expanded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                        <h2 className="text-sm font-black text-slate-900 leading-tight line-clamp-2 mb-1">{activeBook.title}</h2>
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-bold text-slate-600 truncate">{activeBook.author}</p>
                          <div className="flex items-center gap-2">
                            {activeBook.publish_year && (
                              <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider text-slate-700">
                                {activeBook.publish_year}
                              </span>
                            )}
                            {activeBook.wikipedia_url && (
                              <a href={activeBook.wikipedia_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[8px] text-blue-600 flex items-center gap-0.5 uppercase font-bold tracking-widest hover:underline">
                                Source <ExternalLink size={8} />
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="minimized" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Info size={20} className="text-slate-800" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

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
                    className="absolute bottom-16 left-4 right-4 z-40 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center p-4 rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
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
                              ? 'bg-blue-500 w-6' 
                              : 'bg-slate-300'
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

              <button onClick={() => setIsConfirmingDelete(true)} className="absolute bottom-4 right-4 z-30 bg-white/95 backdrop-blur p-2.5 rounded-full shadow-lg text-slate-400 hover:text-red-500 active:scale-90 transition-all border border-white/20">
                <Trash2 size={20} />
              </button>

              <button 
                onClick={() => {
                  setIsEditing(true);
                  setEditingDimension(null); // Will default to first unrated or first dimension
                }} 
                className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 active:scale-90 transition-transform border border-white/20"
              >
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span className="font-black text-sm text-slate-800">
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
            
            {/* Author Facts Tooltips - Show below cover with spacing */}
            {!showRatingOverlay && (
              <>
                <AuthorFactsTooltips 
                  facts={activeBook.author_facts || []} 
                  bookId={activeBook.id}
                  isLoading={loadingFactsForBookId === activeBook.id && !activeBook.author_facts}
                />
                {/* Podcast Episodes - Show below author facts */}
                {(activeBook.podcast_episodes && activeBook.podcast_episodes.length > 0) || 
                 (loadingPodcastsForBookId === activeBook.id && !activeBook.podcast_episodes) ? (
                  <PodcastEpisodes 
                    episodes={activeBook.podcast_episodes || []} 
                    bookId={activeBook.id}
                    isLoading={loadingPodcastsForBookId === activeBook.id && !activeBook.podcast_episodes}
                  />
                ) : null}
              </>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-[50] flex justify-center px-4 pb-0 pointer-events-none">
        <motion.div 
          initial={{ y: 45 }}
          animate={{ y: 40 }}
          whileHover={{ y: 35 }}
          className="w-full max-w-[380px] bg-white border border-slate-200 border-b-0 rounded-t-[32px] shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.2)] p-5 flex flex-col items-center gap-2 cursor-pointer pointer-events-auto transition-all hover:bg-slate-50"
          onClick={() => setIsAdding(true)}
        >
          <div className="w-14 h-1.5 bg-slate-200 rounded-full mb-1" />
          <div className="flex items-center gap-3 text-slate-300 font-extrabold uppercase tracking-[0.2em] text-[10px] pb-4">
            <Search size={16} className="text-blue-500 opacity-50" />
            Add Book
          </div>
        </motion.div>
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
