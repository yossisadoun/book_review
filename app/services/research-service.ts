import type { BookResearch } from '../types';
import { fetchWithRetry, grokApiKey } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';

// --- Book Research (Grok API) ---
export async function getBookResearch(bookTitle: string, authorName: string): Promise<BookResearch | null> {
  console.log(`[getBookResearch] 🔄 Fetching research for "${bookTitle}" by ${authorName}`);

  if (!grokApiKey || grokApiKey.trim() === '') {
    console.warn('[getBookResearch] ⚠️ Grok API key not found or empty');
    return null;
  }

  // Validate API key format
  if (grokApiKey.length < 20) {
    console.warn('[getBookResearch] ⚠️ Grok API key appears to be invalid');
    return null;
  }

  try {
    const prompts = await loadPrompts();

    // Safety check: ensure book_research prompt exists
    if (!prompts.book_research || !prompts.book_research.prompt) {
      console.error('[getBookResearch] ❌ book_research prompt not found in prompts config');
      console.error('[getBookResearch] Available prompts:', Object.keys(prompts));
      return null;
    }

    const researchPrompt = formatPrompt(prompts.book_research.prompt, { bookTitle, authorName });

    const payload = {
      messages: [
        {
          role: "user",
          content: researchPrompt
        }
      ],
      model: "grok-4-1-fast-non-reasoning",
      stream: false,
      temperature: 0.7
    };

    console.log('[getBookResearch] 🔵 Making request to Grok API...');

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));

    const data = await fetchWithRetry('https://api.x.ai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);

    const content = data.choices?.[0]?.message?.content || '{}';
    console.log('[getBookResearch] 🔵 RAW CONTENT:', content.substring(0, 500));

    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);

    // Validate and structure the result
    if (!result.pillars || !Array.isArray(result.pillars)) {
      console.error('[getBookResearch] ❌ Invalid response format - missing pillars array');
      return null;
    }

    const research: BookResearch = {
      book_title: result.book_title || bookTitle,
      author: result.author || authorName,
      pillars: result.pillars.filter((p: any) => p.pillar_name && p.content_items && Array.isArray(p.content_items) && p.content_items.length > 0)
    };

    console.log(`[getBookResearch] ✅ Received research with ${research.pillars.length} pillars`);

    return research;
  } catch (err: any) {
    console.error('[getBookResearch] ❌ Error:', err);
    return null;
  }
}
