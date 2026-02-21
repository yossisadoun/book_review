import type { BookInfographic } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';

// Get book infographic (orientation guide) from Grok
export async function getGrokBookInfographic(bookTitle: string, author: string): Promise<BookInfographic | null> {
  console.log('[getGrokBookInfographic] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookInfographic] API key is missing!');
    return null;
  }

  console.log('[getGrokBookInfographic] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  // Load prompt from yaml
  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.book_infographic.prompt, {
    book_title: bookTitle,
    author_name: author
  });

  const payload = {
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    model: "grok-4-1-fast-non-reasoning",
    stream: false,
    temperature: 0.5
  };

  console.log('[getGrokBookInfographic] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 5000);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokBookInfographic', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{}';

    // Log raw Grok response
    console.log('[getGrokBookInfographic] 📦 RAW GROK RESPONSE:', content);

    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[0] : content;

    // Sanitize common JSON issues from LLM responses
    // Remove trailing commas before ] or }
    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');

    try {
      const result: BookInfographic = JSON.parse(jsonStr);
      console.log('[getGrokBookInfographic] ✅ Parsed infographic with', result.core_cast?.length || 0, 'core characters,', result.full_character_list?.length || 0, 'total characters,', result.plot_timeline?.length || 0, 'plot events');
      return result;
    } catch (parseErr: any) {
      console.error('[getGrokBookInfographic] ❌ JSON Parse Error:', parseErr.message);
      console.error('[getGrokBookInfographic] 📄 Attempted to parse:', jsonStr.substring(0, 500) + '...');
      // Try to find the error location
      const errorMatch = parseErr.message.match(/position (\d+)/);
      if (errorMatch) {
        const pos = parseInt(errorMatch[1]);
        console.error('[getGrokBookInfographic] 🔍 Error context:', jsonStr.substring(Math.max(0, pos - 50), pos + 50));
      }
      return null;
    }
  } catch (err: any) {
    console.error('[getGrokBookInfographic] Error:', err);
    return null;
  }
}

// Get book infographic using Grok with web search (AI SDK)
export async function getGrokBookInfographicWithSearch(bookTitle: string, author: string): Promise<BookInfographic | null> {
  console.log('[getGrokBookInfographicWithSearch] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookInfographicWithSearch] API key is missing!');
    return null;
  }

  try {
    // Create xai provider with API key
    const xai = createXai({ apiKey: grokApiKey });

    const prompts = await loadPrompts();
    const basePrompt = prompts.book_infographic?.prompt || '';
    const prompt = formatPrompt(basePrompt, {
      book_title: bookTitle,
      author_name: author
    });

    // Add instruction to search the web for accurate information
    const searchPrompt = `${prompt}

IMPORTANT: Use web search to verify character names, plot details, and timeline events.
Search for plot summaries, character lists, and book analyses to ensure accuracy.
Only include verified information from reliable sources.`;

    console.log('[getGrokBookInfographicWithSearch] 🔵 Making request with web search...');

    const { text, sources } = await generateText({
      model: xai.responses('grok-4-1-fast-reasoning'),
      prompt: searchPrompt,
      tools: {
        web_search: xai.tools.webSearch(),
      },
    });

    console.log('[getGrokBookInfographicWithSearch] 📦 Response received, sources:', sources?.length || 0);

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[getGrokBookInfographicWithSearch] ❌ Could not find JSON in response');
      return null;
    }

    let jsonStr = jsonMatch[0];
    // Sanitize common JSON issues from LLM responses
    jsonStr = jsonStr.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');

    try {
      const result: BookInfographic = JSON.parse(jsonStr);
      console.log('[getGrokBookInfographicWithSearch] ✅ Parsed infographic with', result.core_cast?.length || 0, 'core characters,', result.full_character_list?.length || 0, 'total characters,', result.plot_timeline?.length || 0, 'plot events, and', sources?.length || 0, 'sources');
      return result;
    } catch (parseErr: any) {
      console.error('[getGrokBookInfographicWithSearch] ❌ JSON Parse Error:', parseErr.message);
      console.error('[getGrokBookInfographicWithSearch] 📄 Attempted to parse:', jsonStr.substring(0, 500) + '...');
      return null;
    }
  } catch (err: any) {
    console.error('[getGrokBookInfographicWithSearch] Error:', err);
    return null;
  }
}
