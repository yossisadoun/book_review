import { createClient } from '@supabase/supabase-js';

interface RemoteFeatureFlags {
  chat_enabled: boolean;
}

const DEFAULTS: RemoteFeatureFlags = {
  chat_enabled: false,
};

let cachedFlags: RemoteFeatureFlags | null = null;
let fetchPromise: Promise<RemoteFeatureFlags> | null = null;

export async function getRemoteFeatureFlags(): Promise<RemoteFeatureFlags> {
  if (cachedFlags) return cachedFlags;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return DEFAULTS;

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('remote_feature_flags')
        .select('chat_enabled')
        .eq('id', 1)
        .maybeSingle();

      if (error || !data) {
        console.warn('[RemoteFeatureFlags] Failed to fetch, using defaults:', error?.message);
        return DEFAULTS;
      }

      cachedFlags = {
        chat_enabled: data.chat_enabled ?? DEFAULTS.chat_enabled,
      };
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
