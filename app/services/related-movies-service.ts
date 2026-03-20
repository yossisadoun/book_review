import { supabase } from '@/lib/supabase';
import { isNativePlatform } from '@/lib/capacitor';
import type { RelatedMovie, MusicLinks, WatchLinks } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage, isCacheStale } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { lookupMovieOnWikipedia } from './wikipedia-service';

// --- iTunes enrichment for albums ---
// Normalize for comparison: lowercase, strip "(Deluxe Edition)" etc., normalize quotes
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, '')
    .replace(/['']/g, "'")
    .trim();
}

// --- Odesli (song.link) API: resolve universal music links ---
async function fetchMusicLinks(itunesUrl: string): Promise<MusicLinks | null> {
  const tag = `[Odesli:${itunesUrl}]`;
  try {
    const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(itunesUrl)}&userCountry=US`;
    console.log(`${tag} Fetching...`);
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.warn(`${tag} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const byPlatform = data.linksByPlatform || {};
    const links: MusicLinks = {};
    if (byPlatform.spotify?.url) links.spotify = byPlatform.spotify.url;
    if (byPlatform.appleMusic?.url) links.appleMusic = byPlatform.appleMusic.url;
    if (byPlatform.youtubeMusic?.url) links.youtubeMusic = byPlatform.youtubeMusic.url;
    if (byPlatform.tidal?.url) links.tidal = byPlatform.tidal.url;
    if (byPlatform.deezer?.url) links.deezer = byPlatform.deezer.url;
    if (byPlatform.amazonMusic?.url) links.amazonMusic = byPlatform.amazonMusic.url;
    console.log(`${tag} Found ${Object.keys(links).length} platform links`);
    return Object.keys(links).length > 0 ? links : null;
  } catch (err) {
    console.warn(`${tag} Error:`, err);
    return null;
  }
}

async function searchItunes(term: string, entity = 'song', limit = 25): Promise<any[]> {
  if (isNativePlatform) {
    // Native: call iTunes directly (no CORS)
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
  } else {
    // Web: proxy through edge function to bypass CORS
    const { data, error } = await supabase.functions.invoke('grok-proxy', {
      body: { endpoint: 'itunes', term, entity, limit },
    });
    if (error) throw error;
    return data?.results || [];
  }
}

async function enrichAlbumWithItunes(movie: RelatedMovie): Promise<RelatedMovie> {
  if (movie.type !== 'album') return movie;
  const tag = `[iTunes:${movie.title}|${movie.director}]`;

  // Strip parentheticals from search query
  const cleanTitle = movie.title.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, '').trim();
  const searchTerm = movie.director ? `${cleanTitle} ${movie.director}` : cleanTitle;
  console.log(`${tag} searching: "${searchTerm}"`);

  try {
    const results: any[] = await searchItunes(searchTerm);
    console.log(`${tag} ${results.length} results`);

    // Find first result whose collectionName matches our album title
    const normalizedTitle = normalize(movie.title);
    const match = results.find((r: any) => {
      if (!r.collectionName) return false;
      const nc = normalize(r.collectionName);
      return nc === normalizedTitle || nc.includes(normalizedTitle) || normalizedTitle.includes(nc);
    });

    if (match?.collectionViewUrl) {
      // collectionViewUrl may point to a track (?i=...) — strip to get album URL
      // e.g. "https://music.apple.com/us/album/real-death/1193426815?i=1193426978&uo=4"
      // → "https://music.apple.com/us/album/1193426815"
      let albumUrl = match.collectionViewUrl;
      try {
        const parsed = new URL(albumUrl);
        // Path looks like /us/album/track-slug/1234567 — keep just the numeric album ID
        const pathParts = parsed.pathname.split('/');
        const albumId = pathParts.find((p: string) => /^\d+$/.test(p));
        if (albumId) {
          albumUrl = `${parsed.origin}/${pathParts.slice(1, 3).join('/')}/album/${albumId}`;
        }
        // Strip query params (?i=..., ?uo=...)
      } catch {}

      // artworkUrl100 → replace size for high-res
      const artwork = match.artworkUrl100
        ? match.artworkUrl100.replace('100x100', '600x600')
        : match.artworkUrl60;

      console.log(`${tag} MATCHED: "${match.collectionName}" by ${match.artistName} | ${albumUrl} | artwork: ${artwork}`);
      const music_links = await fetchMusicLinks(albumUrl);
      return {
        ...movie,
        itunes_url: albumUrl,
        itunes_artwork: artwork,
        ...(music_links && { music_links }),
      };
    }

    console.log(`${tag} NO MATCH`, results.slice(0, 5).map((r: any) => `"${r.collectionName || r.trackName}" by ${r.artistName}`));
  } catch (err) {
    console.warn(`${tag} Error:`, err);
  }

  return movie;
}

// --- TMDB enrichment for movies/shows ---
const tmdbAccessToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN || '';

// Map TMDB provider IDs to our WatchLinks keys
const PROVIDER_MAP: Record<number, keyof WatchLinks> = {
  8: 'netflix',       // Netflix
  9: 'prime',         // Amazon Prime Video
  337: 'disney',      // Disney+
  15: 'hulu',         // Hulu
  2: 'apple',         // Apple TV+
  350: 'apple',       // Apple TV+ (alt ID)
  384: 'hbo',         // HBO Max
  531: 'paramount',   // Paramount+
  386: 'peacock',     // Peacock
};

// Build a search/deep link for each platform
function buildPlatformLink(key: keyof WatchLinks, title: string): string {
  const q = encodeURIComponent(title);
  switch (key) {
    case 'netflix': return `https://www.netflix.com/search?q=${q}`;
    case 'prime': return `https://www.amazon.com/s?k=${q}&i=instant-video`;
    case 'disney': return `https://www.disneyplus.com/search/${q}`;
    case 'hulu': return `https://www.hulu.com/search?q=${q}`;
    case 'apple': return `https://tv.apple.com/search?term=${q}`;
    case 'hbo': return `https://play.max.com/search?q=${q}`;
    case 'paramount': return `https://www.paramountplus.com/search/?q=${q}`;
    case 'peacock': return `https://www.peacocktv.com/search?q=${q}`;
    default: return '';
  }
}

async function enrichWithTmdb(movie: RelatedMovie): Promise<RelatedMovie> {
  if (movie.type === 'album') return movie;
  if (!tmdbAccessToken) {
    console.warn(`[TMDB] No access token — skipping enrichment for "${movie.title}"`);
    return movie;
  }
  console.log(`[TMDB] Enriching "${movie.title}" (${movie.type}, year: ${movie.release_year || 'unknown'})`);

  const mediaType = movie.type === 'show' ? 'tv' : 'movie';
  const tag = `[TMDB:${movie.title}]`;

  try {
    // Step 1: Search for the title
    const query = encodeURIComponent(movie.title);
    const yearParam = movie.release_year ? `&year=${movie.release_year}` : '';
    const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?query=${query}${yearParam}&language=en-US&page=1`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${tmdbAccessToken}`, Accept: 'application/json' },
    });
    if (!searchRes.ok) {
      console.warn(`${tag} Search HTTP ${searchRes.status}`);
      return movie;
    }
    const searchData = await searchRes.json();
    const results = searchData.results || [];
    if (results.length === 0) {
      console.log(`${tag} No TMDB results`);
      return movie;
    }

    const tmdbId = results[0].id;
    const tmdbSlug = mediaType === 'movie' ? 'movie' : 'tv';
    console.log(`${tag} Found TMDB ID: ${tmdbId}`);

    // Step 2: Get watch providers
    const providersUrl = `https://api.themoviedb.org/3/${tmdbSlug}/${tmdbId}/watch/providers`;
    const providersRes = await fetch(providersUrl, {
      headers: { Authorization: `Bearer ${tmdbAccessToken}`, Accept: 'application/json' },
    });
    if (!providersRes.ok) {
      console.warn(`${tag} Providers HTTP ${providersRes.status}`);
      return movie;
    }
    const providersData = await providersRes.json();
    // Use US providers (fallback to first available country)
    const countryData = providersData.results?.US || Object.values(providersData.results || {})[0] as any;
    if (!countryData) {
      console.log(`${tag} No provider data`);
      return { ...movie, watch_links: { tmdb_url: `https://www.themoviedb.org/${tmdbSlug}/${tmdbId}` } };
    }

    const watchLinks: WatchLinks = {
      tmdb_url: countryData.link || `https://www.themoviedb.org/${tmdbSlug}/${tmdbId}`,
    };

    // Combine flatrate (subscription), rent, and buy providers
    const allProviders = [
      ...(countryData.flatrate || []),
      ...(countryData.rent || []),
      ...(countryData.buy || []),
    ];

    for (const provider of allProviders) {
      const key = PROVIDER_MAP[provider.provider_id];
      if (key && !watchLinks[key]) {
        watchLinks[key] = buildPlatformLink(key, movie.title);
      }
    }

    const platformCount = Object.keys(watchLinks).filter(k => k !== 'tmdb_url' && watchLinks[k as keyof WatchLinks]).length;
    console.log(`${tag} Found ${platformCount} streaming platforms`);

    return { ...movie, watch_links: watchLinks };
  } catch (err) {
    console.warn(`${tag} Error:`, err);
    return movie;
  }
}

// --- Related Movies/Shows (Grok API) ---
export async function getRelatedMovies(bookTitle: string, author: string, signal?: AbortSignal): Promise<RelatedMovie[]> {
  console.log(`[getRelatedMovies] Fetching related movies for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('related_movies')
      .select('related_movies, updated_at')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.related_movies && Array.isArray(cachedData.related_movies) && !isCacheStale(cachedData.updated_at)) {
      if (cachedData.related_movies.length > 0) {
        console.log(`[getRelatedMovies] Found ${cachedData.related_movies.length} cached related movies in database`);
        const cached = cachedData.related_movies as RelatedMovie[];

        // Auto re-enrich albums missing itunes_url or music_links, movies/shows missing watch_links
        const needsItunes = cached.some(m => m.type === 'album' && !m.itunes_url);
        const needsMusicLinks = cached.some(m => m.type === 'album' && m.itunes_url && !m.music_links);
        const needsWatchLinks = cached.some(m => m.type !== 'album' && !m.watch_links);
        if (needsItunes || needsMusicLinks || needsWatchLinks) {
          console.log(`[getRelatedMovies] Re-enriching cached items (needsItunes=${needsItunes}, needsMusicLinks=${needsMusicLinks}, needsWatchLinks=${needsWatchLinks})`);
          const reEnriched = await Promise.all(
            cached.map(async m => {
              if (m.type === 'album' && !m.itunes_url) return enrichAlbumWithItunes(m);
              if (m.type === 'album' && m.itunes_url && !m.music_links) {
                const music_links = await fetchMusicLinks(m.itunes_url);
                return music_links ? { ...m, music_links } : m;
              }
              if (m.type !== 'album' && !m.watch_links) return enrichWithTmdb(m);
              return m;
            })
          );
          await saveRelatedMoviesToDatabase(bookTitle, author, reEnriched);
          return reEnriched;
        }

        return cached;
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getRelatedMovies] Found cached "no results" - skipping Grok API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getRelatedMovies] Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getRelatedMovies] Error checking cache:', err);
    // Continue to fetch from Grok
  }

  if (!grokApiKey || grokApiKey.trim() === '') {
    console.warn('[getRelatedMovies] Grok API key not found or empty');
    return [];
  }

  // Validate API key format (should be a reasonable length)
  if (grokApiKey.length < 20) {
    console.warn('[getRelatedMovies] Grok API key appears to be invalid (too short)');
    return [];
  }

  try {
    const prompts = await loadPrompts();

    // Safety check: ensure related_movies prompt exists
    if (!prompts.related_movies || !prompts.related_movies.prompt) {
      console.error('[getRelatedMovies] related_movies prompt not found in prompts config');
      console.error('[getRelatedMovies] Available prompts:', Object.keys(prompts));
      return [];
    }

    const prompt = formatPrompt(prompts.related_movies.prompt, { bookTitle, author });

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

    console.log('[getRelatedMovies] Making request to Grok API...');
    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    }, 2, 3000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getRelatedMovies', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '[]';

    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let jsonStr = jsonMatch ? jsonMatch[0] : content;
    // Fix common JSON issues from LLM output
    jsonStr = jsonStr
      .replace(/,\s*([}\]])/g, '$1')        // trailing commas
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // unquoted keys
      .replace(/:\s*'([^']*)'/g, ': "$1"');  // single-quoted values
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      console.warn('[getRelatedMovies] JSON parse failed, attempting further cleanup');
      // Try removing control characters and smart quotes
      jsonStr = jsonStr
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
      try {
        result = JSON.parse(jsonStr);
      } catch {
        console.error('[getRelatedMovies] ❌ JSON parse failed after cleanup');
        return [];
      }
    }

    const relatedMovies: RelatedMovie[] = Array.isArray(result) ? result : [];
    console.log('[getRelatedMovies] Received', relatedMovies.length, 'related movies from Grok');

    // Enrich each movie/show/album with Wikipedia data (poster thumbnail + URL)
    const enrichedMovies = await Promise.all(
      relatedMovies.map(async (movie) => {
        try {
          const searchQuery = movie.title;
          console.log(`[getRelatedMovies] Searching Wikipedia for: "${searchQuery}"`);

          const wikiResult = await lookupMovieOnWikipedia(searchQuery, movie.type);

          if (wikiResult) {
            return {
              ...movie,
              poster_url: wikiResult.poster_url || undefined,
              release_year: wikiResult.release_year ?? movie.release_year,
              wikipedia_url: wikiResult.wikipedia_url || undefined,
            };
          }

          return movie;
        } catch (err) {
          console.error(`[getRelatedMovies] Error enriching movie "${movie.title}":`, err);
          return movie;
        }
      })
    );

    console.log('[getRelatedMovies] Enriched', enrichedMovies.length, 'related movies');

    // Enrich albums with iTunes URLs
    const itunesEnrichedMovies = await Promise.all(
      enrichedMovies.map(movie => enrichAlbumWithItunes(movie))
    );
    console.log('[getRelatedMovies] iTunes enrichment complete');

    // Enrich movies/shows with TMDB watch providers
    const tmdbEnrichedMovies = await Promise.all(
      itunesEnrichedMovies.map(movie => enrichWithTmdb(movie))
    );
    console.log('[getRelatedMovies] TMDB enrichment complete');

    // Save to database cache
    await saveRelatedMoviesToDatabase(bookTitle, author, tmdbEnrichedMovies);

    return tmdbEnrichedMovies;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    console.error('[getRelatedMovies] Error:', err);
    return [];
  }
}

// Helper function to save related movies to database
async function saveRelatedMoviesToDatabase(bookTitle: string, bookAuthor: string, relatedMovies: RelatedMovie[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('related_movies')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveRelatedMoviesToDatabase] Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      related_movies: relatedMovies,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('related_movies')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('related_movies')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveRelatedMoviesToDatabase] Error saving related movies:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
        fullError: result.error
      });

      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveRelatedMoviesToDatabase] Table "related_movies" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveRelatedMoviesToDatabase] Saved ${relatedMovies.length} related movies to database`);
    }
  } catch (err: any) {
    console.error('[saveRelatedMoviesToDatabase] Unexpected error:', {
      message: err?.message,
      stack: err?.stack,
      fullError: err
    });
  }
}
