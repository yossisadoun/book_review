import { createClient } from '@supabase/supabase-js';

interface RemoteFeatureFlags {
  chat_enabled: boolean;
  create_post_enabled: boolean;
}

const DEFAULTS: RemoteFeatureFlags = {
  chat_enabled: false,
  create_post_enabled: false,
};

// In development, enable all features locally without needing the DB
const DEV_OVERRIDES: RemoteFeatureFlags = {
  chat_enabled: true,
  create_post_enabled: true,
};

let cachedFlags: RemoteFeatureFlags | null = null;
let fetchPromise: Promise<RemoteFeatureFlags> | null = null;

export async function getRemoteFeatureFlags(): Promise<RemoteFeatureFlags> {
  if (process.env.NODE_ENV === 'development') return DEV_OVERRIDES;
  if (cachedFlags) return cachedFlags;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return DEFAULTS;

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('feature_flags')
        .select('key, enabled');

      if (error || !data) {
        console.warn('[RemoteFeatureFlags] Failed to fetch, using defaults:', error?.message);
        return DEFAULTS;
      }

      const flags = { ...DEFAULTS };
      for (const row of data) {
        if (row.key in flags) {
          (flags as Record<string, boolean>)[row.key] = row.enabled;
        }
      }

      cachedFlags = flags;
      return cachedFlags;
    } catch (err) {
      console.warn('[RemoteFeatureFlags] Error fetching flags:', err);
      return DEFAULTS;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

// For use in React components - call once on mount
export function useRemoteFeatureFlags(
  setFlags: (flags: RemoteFeatureFlags) => void
) {
  getRemoteFeatureFlags().then(setFlags);
}

export type { RemoteFeatureFlags };
