import { supabase } from '@/lib/supabase';
import type { RelatedMovie, MusicLinks } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
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

async function enrichAlbumWithItunes(movie: RelatedMovie): Promise<RelatedMovie> {
  if (movie.type !== 'album') return movie;
  const tag = `[iTunes:${movie.title}|${movie.director}]`;

  // Strip parentheticals from search query
  const cleanTitle = movie.title.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, '').trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=song&limit=25`;
  console.log(`${tag} ${url}`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    const results: any[] = data.results || [];
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

// --- Related Movies/Shows (Grok API) ---
export async function getRelatedMovies(bookTitle: string, author: string): Promise<RelatedMovie[]> {
  console.log(`[getRelatedMovies] Fetching related movies for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('related_movies')
      .select('related_movies')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.related_movies && Array.isArray(cachedData.related_movies)) {
      if (cachedData.related_movies.length > 0) {
        console.log(`[getRelatedMovies] Found ${cachedData.related_movies.length} cached related movies in database`);
        const cached = cachedData.related_movies as RelatedMovie[];

        // Auto re-enrich albums missing itunes_url or music_links
        const needsItunes = cached.some(m => m.type === 'album' && !m.itunes_url);
        const needsMusicLinks = cached.some(m => m.type === 'album' && m.itunes_url && !m.music_links);
        if (needsItunes || needsMusicLinks) {
          console.log(`[getRelatedMovies] Re-enriching cached albums (needsItunes=${needsItunes}, needsMusicLinks=${needsMusicLinks})`);
          const reEnriched = await Promise.all(
            cached.map(async m => {
              if (m.type === 'album' && !m.itunes_url) return enrichAlbumWithItunes(m);
              if (m.type === 'album' && m.itunes_url && !m.music_links) {
                const music_links = await fetchMusicLinks(m.itunes_url);
                return music_links ? { ...m, music_links } : m;
              }
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
      body: JSON.stringify(payload)
    }, 2, 3000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getRelatedMovies', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '[]';

    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);

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

    // Save to database cache
    await saveRelatedMoviesToDatabase(bookTitle, author, itunesEnrichedMovies);

    return itunesEnrichedMovies;
  } catch (err: any) {
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
