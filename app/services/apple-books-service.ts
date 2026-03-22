import type { Book } from '../types';
import { fetchWithRetry } from './api-utils';
import { isHebrew } from '../components/utils';

// Canonical book ID for deduplicating search results
function canonicalBookId(title: string, author: string): string {
  const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const primaryAuthor = (a: string) => {
    let p = a.split(/\s+&\s+|\s+and\s+/i)[0];
    const parts = p.split(',');
    if (parts.length > 1 && parts[0].trim().includes(' ')) p = parts[0];
    return p.trim();
  };
  const t = strip(title.toLowerCase().trim()).replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const a = primaryAuthor(strip(author.toLowerCase().trim())).replace(/\s+/g, ' ').replace(/\.\s+/g, '.').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return `${t}|${a}`;
}

export async function lookupBooksOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
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

      // Extract Apple Books user rating
      const appleRating = typeof item.averageUserRating === 'number' ? item.averageUserRating : undefined;
      const appleRatingCount = typeof item.userRatingCount === 'number' ? item.userRatingCount : undefined;

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
        apple_rating: appleRating,
        apple_rating_count: appleRatingCount,
      };
    });

    // Deduplicate by canonical book ID (iTunes returns editions as separate results)
    const seen = new Set<string>();
    const deduped = books.filter(b => {
      const key = canonicalBookId(b.title, b.author || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[lookupBooksOnAppleBooks] ✅ Found ${deduped.length} books (${books.length - deduped.length} duplicates removed)`);
    return deduped;
  } catch (err) {
    console.error('[lookupBooksOnAppleBooks] ❌ Error searching Apple Books:', err);
    return [];
  }
}

// Legacy function for backward compatibility
export async function lookupBookOnAppleBooks(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null> {
  const books = await lookupBooksOnAppleBooks(query);
  return books.length > 0 ? books[0] : null;
}
