import posthog from 'posthog-js';

declare global {
  interface Window {
    posthog?: typeof posthog;
  }
}

export function initPosthog() {
  if (typeof window === 'undefined') return;
  if (window.posthog) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
  });
  window.posthog = posthog;
}

export default posthog;

