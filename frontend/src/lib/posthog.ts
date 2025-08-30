'use client';
import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window === 'undefined' || posthog.__loaded) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('PostHog key not found. Analytics will be disabled.');
    }
    return;
  }

  try {
    // Use our first-party proxy path
    const api_host = '/ingest';

    posthog.init(key, {
      api_host,
      capture_pageview: false,   // we'll send pageviews manually after consent
      autocapture: false,        // keep noise down
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('PostHog initialized successfully');
        }
      },
      bootstrap: {
        distinctID: null, // Let PostHog generate this
        isIdentifiedID: false
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to initialize PostHog:', error);
    }
    // Don't throw - analytics failure shouldn't break the app
  }
}

export function captureEvent(event: string, properties?: Record<string, any>) {
  try {
    // Check if user has given consent
    if (typeof window === 'undefined') return;
    
    const consentDecision = sessionStorage.getItem('consent_decision');
    if (consentDecision !== 'accept') return;

    // Check if PostHog is available
    if (!posthog.__loaded) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('PostHog not initialized, skipping event:', event);
      }
      return;
    }

    posthog.capture(event, properties);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to capture PostHog event:', event, error);
    }
    // Don't throw - analytics failure shouldn't break the app
  }
}

export const onFeatureFlagsReady = (cb: () => void) => {
  try {
    if (posthog.__loaded) {
      posthog.onFeatureFlags(cb);
    } else {
      // If PostHog isn't loaded yet, wait a bit and try again
      setTimeout(() => onFeatureFlagsReady(cb), 100);
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('PostHog feature flags not ready:', error);
    }
    // Call callback anyway to prevent UI blocking
    cb();
  }
}

export const getFlagVariant = (key: string, fallback = 'control'): Promise<string> =>
  new Promise((resolve) => {
    try {
      // 1) instant read (if already loaded)
      if (posthog.__loaded) {
        const v = posthog.getFeatureFlag?.(key) as string | undefined;
        if (v) return resolve(v);
      }

      // 2) wait for flags
      let settled = false;
      const done = (val: string) => { 
        if (!settled) { 
          settled = true; 
          resolve(val || fallback); 
        } 
      };

      onFeatureFlagsReady(() => {
        try {
          const flagValue = posthog.getFeatureFlag?.(key) as string;
          done(flagValue || fallback);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error getting feature flag:', key, error);
          }
          done(fallback);
        }
      });

      // 3) timeout fallback
      setTimeout(() => done(fallback), 800);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Feature flag error:', error);
      }
      resolve(fallback);
    }
  });

