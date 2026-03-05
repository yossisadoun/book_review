import { supabase } from '@/lib/supabase';
import type { RelatedMovie } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { lookupMoviesOnItunes } from './apple-books-service';

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
        return cachedData.related_movies as RelatedMovie[];
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

    // Enrich each movie/show with iTunes data (async, in parallel)
    // Same pattern as related books + lookupBooksOnAppleBooks
    // Albums are skipped — iTunes media=music redirects to musics:// protocol (CORS blocked in browsers)
    const enrichedMovies = await Promise.all(
      relatedMovies.map(async (movie) => {
        try {
          // Skip iTunes enrichment for albums
          if (movie.type === 'album') return movie;

          // Search iTunes for this movie
          const searchQuery = `${movie.title} ${movie.director}`;
          console.log(`[getRelatedMovies] Searching iTunes for: "${searchQuery}"`);

          const itunesMovies = await lookupMoviesOnItunes(searchQuery);

          if (itunesMovies.length > 0) {
            // Find best match (prefer exact title match)
            const movieTitleLower = movie.title.toLowerCase();
            let bestMatch = itunesMovies[0];

            for (const itunesMovie of itunesMovies) {
              const itunesTitleLower = (itunesMovie.title || '').toLowerCase();
              if (itunesTitleLower === movieTitleLower) {
                bestMatch = itunesMovie;
                break;
              }
            }

            // Enrich with iTunes data
            return {
              ...movie,
              poster_url: bestMatch.cover_url || undefined,
              release_year: bestMatch.release_year ?? undefined,
              itunes_url: bestMatch.itunes_url || undefined,
              genre: bestMatch.genre || undefined,
            };
          }

          return movie;
        } catch (err) {
          console.error(`[getRelatedMovies] Error enriching movie "${movie.title}":`, err);
          return movie; // Return original if enrichment fails
        }
      })
    );

    console.log('[getRelatedMovies] Enriched', enrichedMovies.length, 'related movies');

    // Save to database cache
    await saveRelatedMoviesToDatabase(bookTitle, author, enrichedMovies);

    return enrichedMovies;
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
