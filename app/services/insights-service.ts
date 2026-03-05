import { supabase } from '@/lib/supabase';
import type { AuthorFactsResult, DomainInsights, DidYouKnowItem, DidYouKnowResponse, DidYouKnowWithSourcesResult } from '../types';
import { fetchWithRetry, grokApiKey, logGrokUsage, fetchGrokResponses } from './api-utils';
import { loadPrompts, formatPrompt } from '@/lib/prompts';
import { generateTriviaQuestionsForBook, saveTriviaQuestionsToCache } from './trivia-service';

// Attempt to repair common LLM JSON issues (unescaped control chars, trailing commas)
function safeJsonParse<T>(jsonStr: string): T {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Remove trailing commas before ] or }
    let fixed = jsonStr.replace(/,\s*([\]}])/g, '$1');
    // Escape unescaped control characters inside strings
    fixed = fixed.replace(/[\x00-\x1f]/g, (ch) => {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      if (ch === '\t') return '\\t';
      return '';
    });
    return JSON.parse(fixed);
  }
}

// --- Author Facts ---

async function getGrokAuthorFacts(bookTitle: string, author: string): Promise<AuthorFactsResult> {
  console.log('[getGrokAuthorFacts] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokAuthorFacts] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return { facts: [] };
  }

  console.log('[getGrokAuthorFacts] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  const prompt = formatPrompt(prompts.author_facts.prompt, { author, bookTitle });

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

  console.log('[getGrokAuthorFacts] 🔵 RAW GROK REQUEST URL:', url);
  console.log('[getGrokAuthorFacts] 🔵 RAW GROK REQUEST PAYLOAD:', JSON.stringify(payload, null, 2));
  console.log('[getGrokAuthorFacts] 🔵 FORMATTED PROMPT:', prompt);

  try {
    console.log('[getGrokAuthorFacts] Making request to Grok API...');
    const data = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${grokApiKey}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(payload)
    }, 2, 3000);
    console.log('[getGrokAuthorFacts] 🔵 RAW GROK RESPONSE:', JSON.stringify(data, null, 2));

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokAuthorFacts', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    console.log('[getGrokAuthorFacts] 🔵 RAW CONTENT:', content);
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = safeJsonParse<any>(jsonStr);
    console.log('[getGrokAuthorFacts] 🔵 PARSED JSON:', result);
    console.log('[getGrokAuthorFacts] Parsed facts:', result.facts?.length || 0, 'facts');
    console.log('[getGrokAuthorFacts] Parsed first_issue_year:', result.first_issue_year);
    return {
      facts: result.facts || [],
      first_issue_year: result.first_issue_year || null
    };
  } catch (err: any) {
    console.error('[getGrokAuthorFacts] Error:', err);
    console.error('[getGrokAuthorFacts] Error details:', err.message, err.stack);

    // Enhanced error logging for mobile debugging
    if (err.message?.includes('400')) {
      console.error('[getGrokAuthorFacts] ❌ Bad Request (400) - Mobile browser issue detected');
      console.error('[getGrokAuthorFacts] Model used:', payload.model);
      console.error('[getGrokAuthorFacts] Request URL:', url);
      console.error('[getGrokAuthorFacts] Full error message:', err.message);
      console.error('[getGrokAuthorFacts] Payload size:', JSON.stringify(payload).length, 'bytes');
    }

    if (err.message?.includes('403')) {
      console.error('Grok API returned 403 - check your API key permissions');
    }

    return { facts: [] };
  }
}

export async function getAuthorFacts(bookTitle: string, author: string): Promise<AuthorFactsResult> {
  console.log(`[getAuthorFacts] 🔄 Fetching author facts for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('author_facts_cache')
      .select('author_facts')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.author_facts && Array.isArray(cachedData.author_facts)) {
      if (cachedData.author_facts.length > 0) {
        console.log(`[getAuthorFacts] ✅ Found ${cachedData.author_facts.length} cached facts in database`);
        return { facts: cachedData.author_facts as string[] };
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getAuthorFacts] ✅ Found cached "no results" - skipping Grok API call`);
        return { facts: [] };
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is fine
      console.warn('[getAuthorFacts] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getAuthorFacts] ⚠️ Error checking cache:', err);
    // Continue to fetch from Grok
  }

  // Fetch from Grok API
  const result = await getGrokAuthorFacts(bookTitle, author);

  // Save to cache if we got facts
  if (result.facts.length > 0) {
    await saveAuthorFactsToCache(bookTitle, author, result.facts);
  }

  return result;
}

// --- Book Influences ---

async function getGrokBookInfluences(bookTitle: string, author: string): Promise<string[]> {
  console.log('[getGrokBookInfluences] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookInfluences] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return [];
  }

  console.log('[getGrokBookInfluences] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  if (!prompts.book_influences || !prompts.book_influences.prompt) {
    console.error('[getGrokBookInfluences] ❌ book_influences prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.book_influences.prompt, { bookTitle, author });

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

  console.log('[getGrokBookInfluences] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
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
      logGrokUsage('getGrokBookInfluences', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = safeJsonParse<any>(jsonStr);
    console.log('[getGrokBookInfluences] ✅ Parsed', result.facts?.length || 0, 'influences');
    return result.facts || [];
  } catch (err: any) {
    console.error('[getGrokBookInfluences] Error:', err);
    return [];
  }
}

export async function getBookInfluences(bookTitle: string, author: string): Promise<string[]> {
  console.log(`[getBookInfluences] 🔄 Fetching book influences for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('book_influences_cache')
      .select('influences')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.influences && Array.isArray(cachedData.influences)) {
      if (cachedData.influences.length > 0) {
        console.log(`[getBookInfluences] ✅ Found ${cachedData.influences.length} cached influences in database`);
        return cachedData.influences as string[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookInfluences] ✅ Found cached "no results" - skipping Grok API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookInfluences] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookInfluences] ⚠️ Error checking cache:', err);
  }

  // Fetch from Grok API
  const influences = await getGrokBookInfluences(bookTitle, author);

  // Save to cache if we got influences
  if (influences.length > 0) {
    await saveBookInfluencesToCache(bookTitle, author, influences);
  }

  return influences;
}

// --- Book Domain ---

async function getGrokBookDomain(bookTitle: string, author: string): Promise<DomainInsights | null> {
  console.log('[getGrokBookDomain] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookDomain] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return null;
  }

  console.log('[getGrokBookDomain] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  if (!prompts.book_domain || !prompts.book_domain.prompt) {
    console.error('[getGrokBookDomain] ❌ book_domain prompt not found in prompts config');
    return null;
  }
  const prompt = formatPrompt(prompts.book_domain.prompt, { bookTitle, author });

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

  console.log('[getGrokBookDomain] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
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
      logGrokUsage('getGrokBookDomain', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"label":"Domain","facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = safeJsonParse<any>(jsonStr);
    const label = result.label || 'Domain';
    const facts = result.facts || [];
    console.log('[getGrokBookDomain] ✅ Parsed', facts.length, 'domain insights with label:', label);
    return { label, facts };
  } catch (err: any) {
    console.error('[getGrokBookDomain] Error:', err);
    return null;
  }
}

export async function getBookDomain(bookTitle: string, author: string): Promise<DomainInsights | null> {
  console.log(`[getBookDomain] 🔄 Fetching book domain insights for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('book_domain_cache')
      .select('domain_label, domain_insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.domain_insights && Array.isArray(cachedData.domain_insights)) {
      if (cachedData.domain_insights.length > 0) {
        const label = cachedData.domain_label || 'Domain';
        console.log(`[getBookDomain] ✅ Found ${cachedData.domain_insights.length} cached domain insights in database with label: ${label}`);
        return {
          label,
          facts: cachedData.domain_insights as string[]
        };
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookDomain] ✅ Found cached "no results" - skipping Grok API call`);
        return { label: 'Domain', facts: [] };
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookDomain] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookDomain] ⚠️ Error checking cache:', err);
  }

  // Fetch from Grok API
  const domainData = await getGrokBookDomain(bookTitle, author);

  // Save to cache if we got insights
  if (domainData && domainData.facts.length > 0) {
    await saveBookDomainToCache(bookTitle, author, domainData);
  }

  return domainData;
}

// --- Book Context ---

async function getGrokBookContext(bookTitle: string, author: string): Promise<string[]> {
  console.log('[getGrokBookContext] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokBookContext] API key is missing! Check NEXT_PUBLIC_GROK_API_KEY environment variable');
    return [];
  }

  console.log('[getGrokBookContext] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  if (!prompts.book_context || !prompts.book_context.prompt) {
    console.error('[getGrokBookContext] ❌ book_context prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.book_context.prompt, { bookTitle, author });

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

  console.log('[getGrokBookContext] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
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
      logGrokUsage('getGrokBookContext', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"facts":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = safeJsonParse<any>(jsonStr);
    console.log('[getGrokBookContext] ✅ Parsed', result.facts?.length || 0, 'context insights');
    return result.facts || [];
  } catch (err: any) {
    console.error('[getGrokBookContext] Error:', err);
    return [];
  }
}

export async function getBookContext(bookTitle: string, author: string): Promise<string[]> {
  console.log(`[getBookContext] 🔄 Fetching book context insights for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('book_context_cache')
      .select('context_insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.context_insights && Array.isArray(cachedData.context_insights)) {
      if (cachedData.context_insights.length > 0) {
        console.log(`[getBookContext] ✅ Found ${cachedData.context_insights.length} cached context insights in database`);
        return cachedData.context_insights as string[];
      } else {
        // Empty array means "no results" was already cached - don't try again
        console.log(`[getBookContext] ✅ Found cached "no results" - skipping Grok API call`);
        return [];
      }
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getBookContext] ⚠️ Error checking cache:', cacheError);
    }
  } catch (err) {
    console.warn('[getBookContext] ⚠️ Error checking cache:', err);
  }

  // Fetch from Grok API
  const contextInsights = await getGrokBookContext(bookTitle, author);

  // Save to cache if we got insights
  if (contextInsights.length > 0) {
    await saveBookContextToCache(bookTitle, author, contextInsights);
  }

  return contextInsights;
}

// --- Did You Know ---

async function getGrokDidYouKnow(bookTitle: string, author: string): Promise<DidYouKnowItem[]> {
  console.log('[getGrokDidYouKnow] Called for:', bookTitle, 'by', author);

  if (!grokApiKey) {
    console.warn('[getGrokDidYouKnow] API key is missing!');
    return [];
  }

  console.log('[getGrokDidYouKnow] API key found, waiting 2s before request...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const url = 'https://api.x.ai/v1/chat/completions';

  const prompts = await loadPrompts();
  if (!prompts.did_you_know || !prompts.did_you_know.prompt) {
    console.error('[getGrokDidYouKnow] ❌ did_you_know prompt not found in prompts config');
    return [];
  }
  const prompt = formatPrompt(prompts.did_you_know.prompt, { bookTitle, author });

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

  console.log('[getGrokDidYouKnow] 🔵 Making request to Grok API...');
  try {
    const data = await fetchWithRetry(url, {
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
      logGrokUsage('getGrokDidYouKnow', data.usage);
    }

    const content = data.choices?.[0]?.message?.content || '{"did_you_know_top10":[]}';
    // Try to extract JSON from the response (Grok might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result: DidYouKnowResponse = safeJsonParse<DidYouKnowResponse>(jsonStr);
    console.log('[getGrokDidYouKnow] ✅ Parsed', result.did_you_know_top10?.length || 0, '"Did You Know?" insights');
    return result.did_you_know_top10 || [];
  } catch (err: any) {
    console.error('[getGrokDidYouKnow] Error:', err);
    return [];
  }
}

async function getGrokDidYouKnowWithSearch(bookTitle: string, author: string): Promise<DidYouKnowWithSourcesResult> {
  console.log('[getGrokDidYouKnowWithSearch] Called for:', bookTitle, 'by', author);

  try {
    const prompts = await loadPrompts();
    const basePrompt = prompts.did_you_know?.prompt || '';
    if (!basePrompt) {
      console.error('[getGrokDidYouKnowWithSearch] ❌ did_you_know prompt is empty!');
      return { insights: [], sources: [] };
    }
    const prompt = formatPrompt(basePrompt, { bookTitle, author });

    const searchPrompt = `${prompt}

IMPORTANT: Use web search to find and verify real, factual information about this book.
Search for interviews with the author, book reviews, literary analysis, and historical context.
Only include facts you can verify through search results.

Return your response as valid JSON in this exact format:
{
  "did_you_know_top10": [
    { "rank": 1, "notes": ["First sentence of insight", "Second sentence with more detail", "Third sentence with context or impact"] },
    { "rank": 2, "notes": ["...", "...", "..."] }
  ]
}`;

    console.log('[getGrokDidYouKnowWithSearch] 🔵 Making request with web search...');

    const data = await fetchGrokResponses({
      input: [{ role: 'user', content: searchPrompt }],
      model: 'grok-4-1-fast-non-reasoning',
      tools: [{ type: 'web_search' }],
    });

    // Extract text from the responses API output array
    const outputItems = data.output || [];
    const textItem = outputItems.find((item: any) => item.type === 'message');
    const text = textItem?.content?.map((c: any) => c.text).join('') || '';

    console.log('[getGrokDidYouKnowWithSearch] 📦 Response text length:', text.length);

    // Log usage
    if (data.usage) {
      logGrokUsage('getGrokDidYouKnowWithSearch', {
        prompt_tokens: data.usage.input_tokens || 0,
        completion_tokens: data.usage.output_tokens || 0,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      });
    }

    if (!text || text.trim().length === 0) {
      console.error('[getGrokDidYouKnowWithSearch] ❌ Empty text response');
      return { insights: [], sources: [] };
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[getGrokDidYouKnowWithSearch] ❌ Could not find JSON in response');
      console.error('[getGrokDidYouKnowWithSearch] ❌ Text:', text.substring(0, 1000));
      return { insights: [], sources: [] };
    }

    const result: DidYouKnowResponse = safeJsonParse<DidYouKnowResponse>(jsonMatch[0]);
    console.log('[getGrokDidYouKnowWithSearch] ✅ Parsed', result.did_you_know_top10?.length || 0, 'insights');

    return {
      insights: result.did_you_know_top10 || [],
      sources: [],
    };
  } catch (err: any) {
    console.error('[getGrokDidYouKnowWithSearch] ❌ Error:', err?.message || err);
    return { insights: [], sources: [] };
  }
}

export async function getDidYouKnow(bookTitle: string, author: string): Promise<DidYouKnowItem[]> {
  console.log(`[getDidYouKnow] 🔄 Fetching "Did You Know?" insights for "${bookTitle}" by ${author}`);

  // Check database cache first
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = author.toLowerCase().trim();

    const { data: cachedData, error: cacheError } = await supabase
      .from('did_you_know_cache')
      .select('insights')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (!cacheError && cachedData && cachedData.insights && Array.isArray(cachedData.insights) && cachedData.insights.length > 0) {
      console.log(`[getDidYouKnow] ✅ Found ${cachedData.insights.length} cached insights in database`);
      return cachedData.insights as DidYouKnowItem[];
    } else if (cacheError && cacheError.code !== 'PGRST116') {
      console.warn('[getDidYouKnow] ⚠️ Error checking cache:', cacheError);
    }
    // If cache is empty or has no results, proceed to fetch from Grok
  } catch (err) {
    console.warn('[getDidYouKnow] ⚠️ Error checking cache:', err);
    // Continue to fetch from Grok
  }

  // Use web search for verified, factual insights
  const { insights } = await getGrokDidYouKnowWithSearch(bookTitle, author);

  // Save to cache
  await saveDidYouKnowToCache(bookTitle, author, insights);

  return insights;
}

// --- Cache Save Helpers ---

async function saveBookDomainToCache(bookTitle: string, bookAuthor: string, domainData: DomainInsights): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_domain_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookDomainToCache] ❌ Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      domain_label: domainData.label,
      domain_insights: domainData.facts,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase
        .from('book_domain_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_domain_cache')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveBookDomainToCache] ❌ Error saving domain insights:', result.error);
    } else {
      console.log(`[saveBookDomainToCache] ✅ Saved ${domainData.facts.length} domain insights to cache with label: ${domainData.label}`);
    }
  } catch (err: any) {
    console.error('[saveBookDomainToCache] ❌ Error:', err);
  }
}

async function saveBookContextToCache(bookTitle: string, bookAuthor: string, contextInsights: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_context_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookContextToCache] ❌ Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      context_insights: contextInsights,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase
        .from('book_context_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_context_cache')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveBookContextToCache] ❌ Error saving context insights:', result.error);
    } else {
      console.log(`[saveBookContextToCache] ✅ Saved ${contextInsights.length} context insights to cache`);
    }
  } catch (err: any) {
    console.error('[saveBookContextToCache] ❌ Error:', err);
  }
}

async function saveDidYouKnowToCache(bookTitle: string, bookAuthor: string, insights: DidYouKnowItem[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // Check if record exists
    const { data: existingData, error: checkError } = await supabase
      .from('did_you_know_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveDidYouKnowToCache] ❌ Error checking existing record:', checkError);
      return;
    }

    let result;
    if (existingData) {
      // Update existing record
      result = await supabase
        .from('did_you_know_cache')
        .update({
          insights,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
    } else {
      // Insert new record
      result = await supabase
        .from('did_you_know_cache')
        .insert({
          book_title: normalizedTitle,
          book_author: normalizedAuthor,
          insights
        });
    }

    if (result.error) {
      console.error('[saveDidYouKnowToCache] ❌ Error saving insights:', result.error);
    } else {
      console.log(`[saveDidYouKnowToCache] ✅ Saved ${insights.length} "Did You Know?" insights to cache`);
    }
  } catch (err: any) {
    console.error('[saveDidYouKnowToCache] ❌ Error:', err);
  }
}

async function saveBookInfluencesToCache(bookTitle: string, bookAuthor: string, influences: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('book_influences_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[saveBookInfluencesToCache] ❌ Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      influences: influences,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase
        .from('book_influences_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      result = await supabase
        .from('book_influences_cache')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveBookInfluencesToCache] ❌ Error saving influences:', result.error);
    } else {
      console.log(`[saveBookInfluencesToCache] ✅ Saved ${influences.length} influences to cache`);
    }
  } catch (err: any) {
    console.error('[saveBookInfluencesToCache] ❌ Error:', err);
  }
}

async function saveAuthorFactsToCache(bookTitle: string, bookAuthor: string, facts: string[]): Promise<void> {
  try {
    const normalizedTitle = bookTitle.toLowerCase().trim();
    const normalizedAuthor = bookAuthor.toLowerCase().trim();

    // First, try to check if record exists
    const { data: existing, error: checkError } = await supabase
      .from('author_facts_cache')
      .select('id')
      .eq('book_title', normalizedTitle)
      .eq('book_author', normalizedAuthor)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is fine
      console.error('[saveAuthorFactsToCache] ❌ Error checking existing record:', checkError);
    }

    const recordData = {
      book_title: normalizedTitle,
      book_author: normalizedAuthor,
      author_facts: facts,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      // Update existing record
      result = await supabase
        .from('author_facts_cache')
        .update(recordData)
        .eq('book_title', normalizedTitle)
        .eq('book_author', normalizedAuthor);
    } else {
      // Insert new record
      result = await supabase
        .from('author_facts_cache')
        .insert(recordData);
    }

    if (result.error) {
      console.error('[saveAuthorFactsToCache] ❌ Error saving author facts:', {
        message: result.error.message,
        code: result.error.code,
        details: result.error.details,
        hint: result.error.hint,
      });

      // Check if table doesn't exist
      if (result.error.code === '42P01' || result.error.message?.includes('does not exist')) {
        console.error('[saveAuthorFactsToCache] ⚠️ Table "author_facts_cache" does not exist. Please run the migration in Supabase SQL Editor.');
      }
    } else {
      console.log(`[saveAuthorFactsToCache] ✅ Saved ${facts.length} author facts to cache`);

      // Generate trivia questions for this book (fire and forget - don't wait)
      // Note: We can't pass a callback here since this is a global function
      // The useEffect will pick up changes when books.length changes
      if (facts.length > 0) {
        generateTriviaQuestionsForBook(bookTitle, bookAuthor, facts)
          .then(questions => {
            if (questions.length > 0) {
              return saveTriviaQuestionsToCache(bookTitle, bookAuthor, questions);
            }
          })
          .catch(err => {
            console.error('[saveAuthorFactsToCache] ⚠️ Error generating trivia questions:', err);
          });
      }
    }
  } catch (err: any) {
    console.error('[saveAuthorFactsToCache] ❌ Error:', err);
  }
}
