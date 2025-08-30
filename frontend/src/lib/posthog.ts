'use client';
import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window === 'undefined' || posthog.__loaded) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
  if (!key) return;

  // Use our first-party proxy path
  const api_host = '/ingest';

  posthog.init(key, {
    api_host,
    capture_pageview: false,   // we'll send pageviews manually after consent
    autocapture: false,        // keep noise down
  });
}

export function captureEvent(name: string, props?: Record<string, unknown>) {
  try {
    const decision = sessionStorage.getItem('consent_decision');
    if (decision !== 'accept') return; // gate by consent
    posthog.capture(name, props);
  } catch { /* no-op */ }
}

