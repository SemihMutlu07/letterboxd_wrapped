import { captureEvent, hasAnalyticsConsent } from '@/lib/posthog';
import { API_BASE } from '@/lib/api';

// Re-export for convenience
export { hasAnalyticsConsent };

type Props = Record<string, unknown>;

/**
 * Generate TMDB image URL with proxy to avoid CORS issues
 */
export function getTmdbImageUrl(path: string | null | undefined, size: string = 'w300'): string | null {
  if (!path) return null;

  const proxiedPath = (cleanPath: string) => {
    const base = typeof window !== 'undefined' ? (API_BASE || '') : '';
    const path = `/tmdb-proxy/${cleanPath.replace(/^\/+/, '')}`;
    return base ? `${base}${path}` : path;
  };

  // If already a full URL and it's TMDB CDN, convert to proxy
  if (path.startsWith('http') && path.includes('://image.tmdb.org')) {
    const url = new URL(path);
    const cleanPath = url.pathname.replace(/^\/+/, '');
    return proxiedPath(cleanPath);
  }

  // If already a full URL (non-TMDB), return as-is
  if (path.startsWith('http')) return path;

  // Clean the path: remove leading slashes and duplicate t/p/<size>/ parts
  let cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  cleanPath = cleanPath.replace(/^t\/p\/[^\/]+\//, ''); // Remove t/p/<size>/ prefix if exists

  return proxiedPath(`t/p/${size}/${cleanPath}`);
}

export function getPosterUrl(path: string | null | undefined, quality: 'grid' | 'share' = 'grid'): string | null {
  return getTmdbImageUrl(path, quality === 'share' ? 'original' : 'w780');
}

export function getProfileUrl(path: string | null | undefined, quality: 'grid' | 'share' = 'grid'): string | null {
  return getTmdbImageUrl(path, quality === 'share' ? 'w500' : 'w342');
}

/**
 * Always-allowed, high-level events (page hits, feature usage, errors).
 * Still respects PostHog init + consent gate inside captureEvent.
 */
export function trackEvent(name: string, props?: Props): void {
  try {
    captureEvent(name, props);
  } catch {
    // Never break UX for analytics
  }
}

/**
 * Events that should only fire when the user has explicitly accepted analytics.
 */
export function trackConsentedEvent(name: string, props?: Props): void {
  try {
    if (!hasAnalyticsConsent()) return;
    captureEvent(name, props);
  } catch {
    // Silent failure
  }
}

/**
 * Aggregated film stats – safe, high-level metrics only.
 */
export function trackFilmStats(stats: unknown): void {
  try {
    if (!hasAnalyticsConsent()) return;
    // Expect an already-aggregated object (no raw titles/user PII)
    captureEvent('film_stats', stats as Props);
  } catch {
    // Silent failure
  }
}


