import type { Book } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

// --- AI Functions (using Grok) ---
export async function getGrokSuggestions(query: string): Promise<string[]> {
  if (!grokApiKey) return [];

  await new Promise(resolve => setTimeout(resolve, 500));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.book_suggestions.prompt, { query });

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

  console.log('[getGrokSuggestions] 🔵 RAW GROK REQUEST URL:', url);
  console.log('[getGrokSuggestions] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));

  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    });
    console.log('[getGrokSuggestions] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokSuggestions', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"suggestions":[]}';
    console.log('[getGrokSuggestions] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    console.log('[getGrokSuggestions] 🔵 PARSED JSON:', parsed);
    return parsed.suggestions || [];
  } catch (err: any) {
    console.error('Grok suggestions error:', err);
    console.error('Error details:', err.message, err.stack);
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    return [];
  }
}

export async function getAISuggestions(query: string): Promise<string[]> {
  return getGrokSuggestions(query);
}

// --- Grok Book Search ---
export async function lookupBooksOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'>[]> {
  // For now, Grok returns a single result, so we'll wrap it in an array
  const result = await lookupBookOnGrok(query);
  return result ? [result] : [];
}

export async function lookupBookOnGrok(query: string): Promise<Omit<Book, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'rating_writing' | 'rating_insights' | 'rating_flow' | 'rating_world' | 'rating_characters'> | null> {
  if (!grokApiKey) {
    console.warn('[lookupBookOnGrok] API key is missing!');
    return null;
  }

  try {
    console.log(`[lookupBookOnGrok] 🔄 Searching for book: "${query}"`);

    const url = 'https://api.x.ai/v1/chat/completions';

    const prompts = await loadPrompts();
    if (!prompts.book_search || !prompts.book_search.prompt) {
      console.error('[lookupBookOnGrok] ❌ book_search prompt not found in prompts.yaml');
      return null;
    }
    const prompt = formatPrompt(prompts.book_search.prompt, { query });

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

    console.log('[lookupBookOnGrok] 🔵 RAW GROK REQUEST URL:', url);
    console.log('[lookupBookOnGrok] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));
    console.log('[lookupBookOnGrok] 🔵 FORMATTED PROMPT:', prompt);

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('[lookupBookOnGrok] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[lookupBookOnGrok] ⚠️ No content in response');
      return null;
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let result;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error('[lookupBookOnGrok] ❌ Failed to parse JSON:', parseErr);
      console.error('[lookupBookOnGrok] Raw content:', content);
      return null;
    }

    console.log('[lookupBookOnGrok] 🔵 PARSED JSON:', result);

    // Check if result is null (book not found)
    if (result === null || !result.title) {
      console.log(`[lookupBookOnGrok] ⚠️ Book not found for query: "${query}"`);
      return null;
    }

    // Validate and return the book data
    const bookData = {
      title: result.title || query,
      author: result.author || 'Unknown Author',
      publish_year: result.publish_year || undefined,
      genre: result.genre || undefined,
      cover_url: result.cover_url || null,
      wikipedia_url: result.wikipedia_url || null,
      google_books_url: result.google_books_url || null,
    };

    console.log(`[lookupBookOnGrok] ✅ Found book: "${bookData.title}" by ${bookData.author}`);
    return bookData;
  } catch (err: any) {
    console.error('[lookupBookOnGrok] ❌ Error:', err);
    console.error('[lookupBookOnGrok] Error details:', err.message, err.stack);
    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }
    return null;
  }
}
