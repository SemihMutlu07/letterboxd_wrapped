/**
 * Lightweight Sentry integration.
 *
 * Only activates when NEXT_PUBLIC_SENTRY_DSN is set.
 * Uses a try/except import so that @sentry/nextjs is optional.
 */
'use client';

let sentryInitialized = false;

export function initSentry(): void {
  if (sentryInitialized) return;
  if (typeof window === 'undefined') return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    // Dynamic require — falls through to catch if @sentry/nextjs is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs');
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'development',
    });
    sentryInitialized = true;
  } catch {
    // @sentry/nextjs not installed — silently skip
  }
}
