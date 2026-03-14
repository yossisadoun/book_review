import { supabase } from '@/lib/supabase';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { grokApiKey, fetchWithRetry, logGrokUsage } from './api-utils';
import type { BookSummary } from '../types';

export async function getBookSummary(bookTitle: string, author: string): Promise<BookSummary | null> {
  console.log(`[getBookSummary] Fetching summary for "${bookTitle}" by ${author}`);

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();

  // Check database cache first
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('book_summary_cache')
      .select('summary_data')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData?.summary_data) {
      console.log(`[getBookSummary] Found cached summary`);
      return cachedData.summary_data as BookSummary;
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookSummary] Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookSummary] Error checking cache:', err);
  }

  if (!grokApiKey || grokApiKey.length < 20) {
    console.warn('[getBookSummary] Grok API key not found or invalid');
    return null;
  }

  try {
    const prompts = await loadPrompts();

    if (!prompts.book_summary?.prompt) {
      console.error('[getBookSummary] book_summary prompt not found');
      return null;
    }

    const prompt = formatPrompt(prompts.book_summary.prompt, { bookTitle, author });

    const payload = {
      messages: [{ role: "user", content: prompt }],
      model: "grok-4-1-fast-non-reasoning",
      stream: false,
      temperature: 0.7,
      response_format: { type: "json_object" },
    };

    console.log('[getBookSummary] Making request to Grok API...');
    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    if (data.usage) {
      logGrokUsage('getBookSummary', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';

    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[0] : content;

    // Fix common LLM JSON issues: replace smart/curly quotes with straight equivalents
    jsonStr = jsonStr.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
    jsonStr = jsonStr.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

    let result: BookSummary;
    try {
      result = JSON.parse(jsonStr) as BookSummary;
    } catch (firstErr) {
      // Aggressive fix: strip control chars (keep newlines/tabs) and retry
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (ch: string) => ch === '\n' || ch === '\t' ? ch : '');
      try {
        result = JSON.parse(jsonStr) as BookSummary;
      } catch {
        // Last resort: use a character-by-character parser to fix unescaped quotes in string values
        let fixed = '';
        let inString = false;
        let escaped = false;
        for (let i = 0; i < jsonStr.length; i++) {
          const ch = jsonStr[i];
          if (escaped) {
            fixed += ch;
            escaped = false;
            continue;
          }
          if (ch === '\\' && inString) {
            fixed += ch;
            escaped = true;
            continue;
          }
          if (ch === '"') {
            if (!inString) {
              inString = true;
              fixed += ch;
            } else {
              // Peek ahead to see if this quote ends the string value
              // Valid closers: followed by , } ] : or whitespace then one of those
              const rest = jsonStr.slice(i + 1).trimStart();
              if (rest.length === 0 || /^[,}\]:]/.test(rest)) {
                inString = false;
                fixed += ch;
              } else {
                // This is an unescaped quote inside the string — escape it
                fixed += '\\"';
              }
            }
          } else {
            fixed += ch;
          }
        }
        result = JSON.parse(fixed) as BookSummary;
      }
    }

    if (!result.title || !result.summary) {
      console.warn('[getBookSummary] Invalid response structure');
      return null;
    }

    console.log('[getBookSummary] Received summary from Grok');

    // Save to cache
    try {
      await supabase
        .from('book_summary_cache')
        .upsert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          summary_data: result,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'book_title,book_author' });
      console.log('[getBookSummary] Saved summary to cache');
    } catch (saveErr) {
      console.warn('[getBookSummary] Error saving to cache:', saveErr);
    }

    return result;
  } catch (err) {
    console.error('[getBookSummary] Error fetching summary:', err);
    return null;
  }
}
