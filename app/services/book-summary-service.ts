import { supabase } from '@/lib/supabase';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { grokApiKey, fetchWithRetry, logGrokUsage, isCacheStale } from './api-utils';
import type { BookSummary } from '../types';

function safeJsonParse(jsonStr: string): any | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Pass 2: remove trailing commas and normalize control chars
    let fixed = jsonStr
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, (ch: string) => (ch === '\n' || ch === '\t' ? ch : ''));

    try {
      return JSON.parse(fixed);
    } catch {
      // Pass 3: best-effort fix for stray inner quotes in string values
      let repaired = '';
      let inString = false;
      let escaped = false;
      for (let i = 0; i < fixed.length; i++) {
        const ch = fixed[i];
        if (escaped) {
          repaired += ch;
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          repaired += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          if (!inString) {
            inString = true;
            repaired += ch;
          } else {
            const rest = fixed.slice(i + 1).trimStart();
            if (rest.length === 0 || /^[,}\]:]/.test(rest)) {
              inString = false;
              repaired += ch;
            } else {
              repaired += '\\"';
            }
          }
          continue;
        }
        repaired += ch;
      }
      try {
        return JSON.parse(repaired);
      } catch {
        return null;
      }
    }
  }
}

function normalizeSummary(raw: any, bookTitle: string, author: string): BookSummary | null {
  if (!raw || typeof raw !== 'object') return null;

  const summaryText =
    raw.summary ||
    raw.synopsis ||
    raw.overview ||
    raw.description ||
    raw.main_summary ||
    null;
  if (!summaryText || typeof summaryText !== 'string') return null;

  const cardsArray = Array.isArray(raw.cards) ? raw.cards : [];
  const tasksArray = Array.isArray(raw.tasks) ? raw.tasks : (Array.isArray(raw.action_items) ? raw.action_items : []);
  const glossaryArray = Array.isArray(raw.glossary) ? raw.glossary : [];

  return {
    title: raw.title || raw.book_title || bookTitle,
    author: raw.author || raw.book_author || author,
    readTime: raw.readTime || raw.read_time || '5 min',
    category: raw.category || 'Book',
    gradient: raw.gradient || 'from-indigo-500 to-purple-500',
    quote: raw.quote || raw.key_quote || summaryText.slice(0, 140),
    summary: summaryText,
    cardsTitle: raw.cardsTitle || raw.cards_title || 'Key Ideas',
    cards: cardsArray
      .map((c: any, idx: number) => ({
        step: c?.step || `${idx + 1}`,
        name: c?.name || c?.title || 'Key Point',
        iconName: c?.iconName || c?.icon || 'Lightbulb',
        desc: c?.desc || c?.description || '',
      }))
      .filter((c: any) => typeof c.desc === 'string' && c.desc.trim().length > 0),
    actionTitle: raw.actionTitle || raw.action_title || 'Action Plan',
    tasks: tasksArray
      .map((t: any) => ({ text: typeof t === 'string' ? t : (t?.text || '') }))
      .filter((t: any) => t.text.trim().length > 0),
    glossaryTitle: raw.glossaryTitle || raw.glossary_title || 'Glossary',
    glossary: glossaryArray
      .map((g: any) => ({
        term: g?.term || g?.name || '',
        def: g?.def || g?.definition || g?.desc || '',
      }))
      .filter((g: any) => g.term.trim().length > 0 && g.def.trim().length > 0),
  };
}

function parseSummaryJson(content: string, bookTitle: string, author: string): BookSummary | null {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  let jsonStr = content.slice(firstBrace, lastBrace + 1);
  jsonStr = jsonStr.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  jsonStr = jsonStr.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  const parsed = safeJsonParse(jsonStr);
  return normalizeSummary(parsed, bookTitle, author);
}

export async function getBookSummary(bookTitle: string, author: string, signal?: AbortSignal): Promise<BookSummary | null> {
  console.log(`[getBookSummary] Fetching summary for "${bookTitle}" by ${author}`);

  const normalizedTitle = bookTitle.toLowerCase().trim();
  const normalizedAuthor = author.toLowerCase().trim();

  // Check database cache first
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('book_summary_cache')
      .select('summary_data, updated_at')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData?.summary_data && !isCacheStale(cachedData.updated_at)) {
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
      body: JSON.stringify(payload),
      signal,
    }, 2, 3000);

    if (data.usage) {
      logGrokUsage('getBookSummary', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';
    const result = parseSummaryJson(content, bookTitle, author);

    if (!result || !result.title || !result.summary) {
      console.warn('[getBookSummary] Invalid response structure:', JSON.stringify({ content: content.slice(0, 500), result }));
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
    if ((err as any)?.name === 'AbortError') {
      throw err;
    }
    console.error('[getBookSummary] Error fetching summary:', err);
    return null;
  }
}
