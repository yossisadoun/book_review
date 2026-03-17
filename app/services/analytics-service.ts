import { Capacitor } from '@capacitor/core';

type AccountType = 'guest' | 'apple' | 'google';

interface AnalyticsEvent {
  user_id: string | null;
  feature: string;
  action: string;
  platform: string;
  account_type: string;
  metadata: Record<string, any> | null;
  session_id: string | null;
  created_at: string;
}

const platform = Capacitor.getPlatform();
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

const TRACK_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/track`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let sessionId: string | null = null;
let lastActivityTime = 0;
let userId: string | null = null;
let accountType: AccountType = 'guest';
let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let sessionStartTime = 0;

function ensureSession(): string {
  const now = Date.now();
  if (!sessionId || (now - lastActivityTime > SESSION_TIMEOUT_MS)) {
    sessionId = crypto.randomUUID();
    sessionStartTime = now;
  }
  lastActivityTime = now;
  return sessionId;
}

const BEACON_URL = `${TRACK_URL}?apikey=${ANON_KEY}`;

function flush(): void {
  if (queue.length === 0) return;
  const batch = queue.splice(0);
  const body = JSON.stringify(batch);

  // Use sendBeacon when available — works reliably during visibilitychange/pagehide
  // (no preflight, no CORS issues). Falls back to fetch with keepalive.
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon(BEACON_URL, blob)) return;
  }

  fetch(TRACK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

function enqueue(feature: string, action: string, metadata?: Record<string, any>): void {
  const event: AnalyticsEvent = {
    user_id: userId,
    feature,
    action,
    platform,
    account_type: accountType,
    metadata: metadata ?? null,
    session_id: ensureSession(),
    created_at: new Date().toISOString(),
  };
  queue.push(event);
  if (queue.length >= BATCH_SIZE) {
    flush();
  }
}

export function setAnalyticsUser(id: string | null, type: AccountType): void {
  userId = id;
  accountType = type;
}

export const analytics = {
  trackEvent(feature: string, action: string, metadata?: Record<string, any>): void {
    enqueue(feature, action, metadata);
  },

  trackView(feature: string): void {
    enqueue(feature, 'view');
  },

  trackTap(feature: string, action: string): void {
    enqueue(feature, action);
  },

  initSession(): void {
    ensureSession();
    sessionStartTime = Date.now();

    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          enqueue('app', 'session_end', { duration_ms: Date.now() - sessionStartTime });
          flush();
        }
      });
    }

    // Capacitor native app pause
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.addListener('pause', () => {
          enqueue('app', 'session_end', { duration_ms: Date.now() - sessionStartTime });
          flush();
        });
      }).catch(() => {});
    }
  },

  endSession(): void {
    flush();
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  },
};
