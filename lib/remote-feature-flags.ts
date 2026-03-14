import { supabase } from '@/lib/supabase';

interface RemoteFeatureFlags {
  chat_enabled: boolean;
  create_post_enabled: boolean;
  related_work_play_buttons: boolean;
  commenting_enabled: boolean;
  send_enabled: boolean;
}

const DEFAULTS: RemoteFeatureFlags = {
  chat_enabled: false,
  create_post_enabled: false,
  related_work_play_buttons: false,
  commenting_enabled: false,
  send_enabled: false,
};

// In development, enable all features locally without needing the DB
const DEV_OVERRIDES: RemoteFeatureFlags = {
  chat_enabled: true,
  create_post_enabled: true,
  related_work_play_buttons: true,
  commenting_enabled: true,
  send_enabled: true,
};

let cachedFlags: RemoteFeatureFlags | null = null;
let fetchPromise: Promise<RemoteFeatureFlags> | null = null;

export async function getRemoteFeatureFlags(): Promise<RemoteFeatureFlags> {
  if (process.env.NODE_ENV === 'development') return DEV_OVERRIDES;
  if (cachedFlags) return cachedFlags;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
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
