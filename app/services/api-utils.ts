import { supabase } from '@/lib/supabase';
import { isNativePlatform } from '@/lib/capacitor';
import type { GrokUsageInput, GrokUsageLog } from '../types';

export const grokApiKey = process.env.NEXT_PUBLIC_GROK_API_KEY || "";
export const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";

// Cache TTL: entries older than this are considered stale and will be re-fetched
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Check if a cached entry is stale based on its updated_at timestamp.
 * Returns true if the entry should be re-fetched.
 */
export function isCacheStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > CACHE_TTL_MS;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GROK_PROXY_URL = `${SUPABASE_URL}/functions/v1/grok-proxy`;

// On web (not native), route Grok API calls through the edge function to avoid CORS
function rewriteGrokRequest(url: string, options: RequestInit): { url: string; options: RequestInit } {
  if (isNativePlatform || !url.includes('api.x.ai/v1/chat/completions')) {
    return { url, options };
  }

  // Parse the original body to forward to the proxy
  const body = options.body ? JSON.parse(options.body as string) : {};

  return {
    url: GROK_PROXY_URL,
    options: {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    },
  };
}

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 2000): Promise<any> {
  const rewritten = rewriteGrokRequest(url, options);
  url = rewritten.url;
  options = rewritten.options;

  for (let i = 0; i < retries; i++) {
    try {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const res = await fetch(url, options);
      if (res.ok) return await res.json();

      // CRITICAL: Log the actual error response body - this will tell us why mobile fails
      let errorBody = '';
      try {
        errorBody = await res.text();
        console.error(`[fetchWithRetry] HTTP ${res.status} error response:`, errorBody);
        // Try to parse as JSON if possible
        try {
          const errorJson = JSON.parse(errorBody);
          console.error(`[fetchWithRetry] Parsed error JSON:`, errorJson);
        } catch (e) {
          // Not JSON, that's fine
        }
      } catch (e) {
        console.error(`[fetchWithRetry] Could not read error response body:`, e);
      }

      // Handle rate limiting (429) with exponential backoff
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * Math.pow(2, i);

        if (i === retries - 1) {
          console.warn('Rate limit exceeded. Please try again later.');
          throw new Error('Rate limit exceeded');
        }

        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${i + 1}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // For 400 errors, log and throw immediately (don't retry bad requests)
      if (res.status === 400) {
        console.error(`[fetchWithRetry] ❌ Bad Request (400) - This often indicates a mobile browser issue`);
        console.error(`[fetchWithRetry] Error response:`, errorBody);
        throw new Error(`HTTP 400: ${errorBody || 'Bad Request'}`);
      }

      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        if (i === retries - 1) throw new Error(`HTTP ${res.status}: ${errorBody || ''}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${errorBody || ''}`);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        throw err;
      }
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Call xAI /v1/responses endpoint (supports web_search tool)
// On web: routes through grok-proxy edge function to avoid CORS
// On native: calls xAI directly
export async function fetchGrokResponses(body: {
  input: Array<{ role: string; content: string }>;
  model?: string;
  tools?: Array<{ type: string; [key: string]: any }>;
  temperature?: number;
}): Promise<any> {
  if (isNativePlatform) {
    // Native: call xAI directly
    const res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`,
      },
      body: JSON.stringify({
        input: body.input,
        model: body.model || 'grok-4-1-fast-non-reasoning',
        tools: body.tools || [],
        ...(body.temperature != null ? { temperature: body.temperature } : {}),
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errorBody}`);
    }
    return await res.json();
  }

  // Web: route through proxy
  const res = await fetch(GROK_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      endpoint: 'responses',
      input: body.input,
      model: body.model || 'grok-4-1-fast-non-reasoning',
      tools: body.tools || [],
      ...(body.temperature != null ? { temperature: body.temperature } : {}),
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errorBody}`);
  }
  return await res.json();
}

export function first4DigitYear(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}

// Grok pricing (per million tokens) - update these based on current xAI pricing
// Using approximate rates for grok-4-1-fast-non-reasoning
export const GROK_INPUT_PRICE_PER_M = 0.20;  // $0.20 per million input tokens
export const GROK_OUTPUT_PRICE_PER_M = 0.50;  // $0.50 per million output tokens
export const GROK_WEB_SEARCH_PRICE_PER_CALL = 0.005;  // $0.005 per web search call (estimate)

const FUNCTION_TO_FEATURE: Record<string, string> = {
  getGrokSuggestions: 'search',
  getBookSummary: 'book_details',
  getRelatedBooks: 'book_details',
  getGrokDiscussionQuestions: 'book_details',
  getRelatedMovies: 'book_details',
  getGrokPodcastEpisodes: 'book_details',
  getGrokBookInfographic: 'book_details',
  getGrokAuthorFacts: 'book_details',
  getFirstIssueYear: 'book_details',
  getGrokBookInfluences: 'book_details',
  getGrokBookDomain: 'book_details',
  getGrokBookContext: 'book_details',
  getGrokDidYouKnow: 'book_details',
  getGrokDidYouKnowWithSearch: 'book_details',
  getCharacterAvatars: 'chat',
  generateSingleCharacterAvatar: 'chat',
  getCharacterContext: 'chat',
  character_chat: 'chat',
  generateTriviaQuestionsForBook: 'trivia',
  generateTriviaQuestions: 'trivia',
};

export function getFeatureForFunction(functionName: string): string {
  return FUNCTION_TO_FEATURE[functionName] || 'other';
}

export async function logGrokUsage(
  functionName: string,
  usage: GrokUsageInput | undefined,
  webSearchCalls?: number,
  opts?: { model?: string; tools?: string[]; startTime?: number }
): Promise<void> {
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    return;
  }

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
  const searchCalls = webSearchCalls || usage.web_search_calls || 0;

  // Calculate cost
  const inputCost = (promptTokens / 1_000_000) * GROK_INPUT_PRICE_PER_M;
  const outputCost = (completionTokens / 1_000_000) * GROK_OUTPUT_PRICE_PER_M;
  const webSearchCost = searchCalls * GROK_WEB_SEARCH_PRICE_PER_CALL;
  const estimatedCost = inputCost + outputCost + webSearchCost;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[logGrokUsage] No user logged in, skipping log');
    return;
  }

  // Save to Supabase
  try {
    const { error } = await supabase
      .from('grok_usage_logs')
      .insert({
        user_id: user.id,
        function_name: functionName,
        feature: getFeatureForFunction(functionName),
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        source: 'client',
        ...(searchCalls > 0 ? { web_search_calls: searchCalls } : {}),
        ...(opts?.model ? { model: opts.model } : {}),
        ...(opts?.tools?.length ? { tools: opts.tools } : {}),
        ...(opts?.startTime ? { duration_ms: Math.round(Date.now() - opts.startTime) } : {}),
      });

    if (error) {
      console.error('[logGrokUsage] Error saving to Supabase:', error);
    }
  } catch (err) {
    console.error('[logGrokUsage] Error saving to Supabase:', err);
  }
}

export async function logImageGeneration(functionName: string, imageCount: number): Promise<void> {
  if (imageCount <= 0) return;

  const COST_PER_IMAGE = 0.005;
  const estimatedCost = imageCount * COST_PER_IMAGE;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[logImageGeneration] No user logged in, skipping log');
    return;
  }

  try {
    const { error } = await supabase
      .from('grok_usage_logs')
      .insert({
        user_id: user.id,
        function_name: functionName,
        feature: getFeatureForFunction(functionName),
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost: estimatedCost,
        source: 'client',
        model: 'flux-2-klein-4b',
      });

    if (error) {
      console.error('[logImageGeneration] Error saving to Supabase:', error);
    }
  } catch (err) {
    console.error('[logImageGeneration] Error saving to Supabase:', err);
  }
}

export async function getGrokUsageLogs(userId: string): Promise<GrokUsageLog[]> {
  try {
    const { data, error } = await supabase
      .from('grok_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[getGrokUsageLogs] Error fetching from Supabase:', error);
      return [];
    }

    return (data || []).map(row => ({
      timestamp: row.created_at,
      function: row.function_name,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
      estimatedCost: parseFloat(row.estimated_cost),
    }));
  } catch (err) {
    console.error('[getGrokUsageLogs] Error fetching from Supabase:', err);
    return [];
  }
}
