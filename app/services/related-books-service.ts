import { supabase } from '@/lib/supabase';
import type { RelatedBook } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { lookupBooksOnAppleBooks } from './apple-books-service';

// --- Related Books (Grok API) ---
export async function getRelatedBooks(bookTitle: string, author: string): Promise<RelatedBook[]> {
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
        const cached = (cachedData.related_books as RelatedBook[]).filter(b => b.google_books_url);
        console.log(`[getRelatedBooks] ✅ Found ${cached.length} cached related books in database (${cachedData.related_books.length - cached.length} without Apple Books filtered out)`);
        return cached;
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

          return null; // Not found on Apple Books — exclude
        } catch (err) {
          console.error(`[getRelatedBooks] ⚠️ Error enriching book "${book.title}":`, err);
          return null; // Enrichment failed — exclude
        }
      })
    );

    const validBooks = enrichedBooks.filter((b): b is RelatedBook => b !== null);
    console.log(`[getRelatedBooks] ✅ Enriched ${validBooks.length} related books (${relatedBooks.length - validBooks.length} not found on Apple Books)`);

    // Save to database cache
    await saveRelatedBooksToDatabase(bookTitle, author, validBooks);

    return validBooks;
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
