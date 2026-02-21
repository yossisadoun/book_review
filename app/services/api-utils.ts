import { supabase } from '@/lib/supabase';
import type { GrokUsageInput, GrokUsageLog } from '../types';

export const grokApiKey = process.env.NEXT_PUBLIC_GROK_API_KEY || "";
export const youtubeApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 2000): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
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
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
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

export async function logGrokUsage(functionName: string, usage: GrokUsageInput | undefined, webSearchCalls?: number): Promise<void> {
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
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost: estimatedCost,
        ...(searchCalls > 0 ? { web_search_calls: searchCalls } : {}),
      });

    if (error) {
      console.error('[logGrokUsage] Error saving to Supabase:', error);
    }
  } catch (err) {
    console.error('[logGrokUsage] Error saving to Supabase:', err);
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
