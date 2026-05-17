'use client';
import posthog from 'posthog-js';

let isInitialized = false;

// Kill-switch: when NEXT_PUBLIC_POSTHOG_KEY is not set,
// the entire module is a silent no-op (e.g. adblocker workaround).
const POSTHOG_DISABLED =
  !process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY.length === 0;

const isDev = process.env.NODE_ENV !== 'production';

// ── Event queue (persisted to sessionStorage so it survives full-page nav) ──

const QUEUE_KEY = 'ph_event_queue';

interface QueuedEvent {
  event: string;
  properties?: Record<string, unknown>;
  queued_at: number;
}

function loadQueue(): QueuedEvent[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedEvent[]) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // quota exceeded — drop silently
  }
}

function enqueue(event: string, properties?: Record<string, unknown>) {
  const queue = loadQueue();
  queue.push({ event, properties, queued_at: Date.now() });
  saveQueue(queue);
  if (isDev) {
    console.debug(`[posthog] queued "${event}" (queue size: ${queue.length})`);
  }
}

/**
 * Flush all queued events through PostHog.
 * Call AFTER initPostHog() and after capturing consent_decision.
 */
export function flushQueue() {
  if (POSTHOG_DISABLED || !posthog.__loaded) return;

  const queue = loadQueue();
  if (queue.length === 0) return;

  // Clear storage first so a crash mid-flush doesn't re-send
  sessionStorage.removeItem(QUEUE_KEY);

  if (isDev) {
    console.debug(`[posthog] flushing ${queue.length} queued events`);
  }

  for (const item of queue) {
    if (isDev) {
      console.debug(`[posthog]   ↳ ${item.event}`, item.properties ?? {});
    }
    posthog.capture(item.event, { ...item.properties, queued_at: item.queued_at });
  }
}

/**
 * Discard all queued events (user declined consent).
 */
export function clearQueue() {
  if (POSTHOG_DISABLED) return;
  const queue = loadQueue();
  sessionStorage.removeItem(QUEUE_KEY);
  if (isDev) {
    console.debug(`[posthog] cleared ${queue.length} queued events (declined)`);
  }
}

// ── Consent helper ──

export function hasAnalyticsConsent(): boolean {
  if (POSTHOG_DISABLED || typeof window === 'undefined') return false;
  return (
    sessionStorage.getItem('consent_decision') === 'accept' && posthog.__loaded === true
  );
}

// ── Init (call only on consent accept) ──

export function initPostHog() {
  if (POSTHOG_DISABLED || typeof window === 'undefined' || posthog.__loaded || isInitialized) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host) return;

  // Init synchronously — no defer, consent was just given
  initPostHogSync(key, host);
}

function initPostHogSync(key: string, host: string) {
  try {
    const existingDistinctId =
      typeof window !== 'undefined' ? localStorage.getItem('ph_distinct_id') : null;

    const bootstrapConfig: { isIdentifiedID: boolean; distinctID?: string } = {
      isIdentifiedID: false,
    };

    if (existingDistinctId) {
      bootstrapConfig.distinctID = existingDistinctId;
    }

    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      autocapture: false,
      loaded: () => {
        // PostHog initialized successfully
      },
      bootstrap: bootstrapConfig,
    });

    isInitialized = true;
  } catch (error) {
    if (isDev) {
      console.error('[posthog] init failed:', error);
    }
  }
}

// ── Capture (queues if consent undecided, sends if accepted, no-ops if declined) ──

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (POSTHOG_DISABLED) return;
  try {
    if (typeof window === 'undefined') return;

    const consent = sessionStorage.getItem('consent_decision');

    // Declined → drop
    if (consent === 'decline') return;

    // Accepted + loaded → send immediately
    if (consent === 'accept' && posthog.__loaded) {
      if (isDev) {
        console.debug(`[posthog] ${event}`, properties ?? {});
      }
      posthog.capture(event, properties);
      return;
    }

    // No decision yet, or accepted-but-still-loading → queue
    enqueue(event, properties);
  } catch (error) {
    if (isDev) {
      console.error('[posthog] capture failed:', event, error);
    }
  }
}

// ── Feature flags (graceful fallback when PostHog not loaded) ──

export const onFeatureFlagsReady = (cb: () => void) => {
  if (POSTHOG_DISABLED) { cb(); return; }
  try {
    if (posthog.__loaded) {
      posthog.onFeatureFlags(cb);
    } else {
      // PostHog not loaded yet — call back immediately with fallback
      cb();
    }
  } catch (error) {
    if (isDev) {
      console.warn('[posthog] feature flags not ready:', error);
    }
    cb();
  }
};

export const getFlagVariant = (key: string, fallback = 'control'): Promise<string> =>
  new Promise((resolve) => {
    if (POSTHOG_DISABLED) return resolve(fallback);
    try {
      if (posthog.__loaded) {
        const v = posthog.getFeatureFlag?.(key) as string | undefined;
        if (v) return resolve(v);
      }

      // PostHog not loaded → resolve with fallback immediately
      // (no retry loop — PostHog only loads after consent)
      resolve(fallback);
    } catch (error) {
      if (isDev) {
        console.error('[posthog] flag error:', error);
      }
      resolve(fallback);
    }
  });
