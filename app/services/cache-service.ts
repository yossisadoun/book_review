// Simple localStorage cache with stale-while-revalidate pattern
// Shows cached data instantly on mount, then refreshes in background

const CACHE_PREFIX = 'cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}

// Cache keys
export const CACHE_KEYS = {
  books: (userId: string) => `books_${userId}`,
  feed: (userId: string) => `feed_${userId}`,
  chat: (bookId: string) => `chat_${bookId}`,
} as const;
