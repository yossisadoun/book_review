import { supabase } from '@/lib/supabase';
import type { PodcastEpisode, CuratedEpisodeResult } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

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

export async function getPodcastEpisodes(bookTitle: string, author: string): Promise<PodcastEpisode[]> {
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
