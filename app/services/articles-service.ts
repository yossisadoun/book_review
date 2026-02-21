import { supabase } from '@/lib/supabase';
import type { AnalysisArticle } from '../types';

// --- Google Scholar API ---
export async function getGoogleScholarAnalysis(bookTitle: string, author: string): Promise<AnalysisArticle[]> {
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

// Helper function to save articles to database
export async function saveArticlesToDatabase(bookTitle: string, bookAuthor: string, articles: AnalysisArticle[]): Promise<void> {
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
