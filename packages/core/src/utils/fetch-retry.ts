// Fetch utility with retry logic

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delay = 2000
): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();

      // Log error response for debugging
      let errorBody = '';
      try {
        errorBody = await res.text();
        console.error(`[fetchWithRetry] HTTP ${res.status} error response:`, errorBody);
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
        await new Promise((resolve) => setTimeout(resolve, waitTime));
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
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${errorBody || ''}`);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

export function first4DigitYear(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : undefined;
}
