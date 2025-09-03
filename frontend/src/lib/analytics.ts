type Props = Record<string, unknown>;

/**
 * Generate TMDB image URL with proxy to avoid CORS issues
 */
export function getTmdbImageUrl(path: string | null | undefined, size: string = 'w300'): string | null {
  if (!path) return null;
  
  // If already a full URL and it's TMDB CDN, convert to proxy
  if (path.startsWith('http') && path.includes('://image.tmdb.org')) {
    const url = new URL(path);
    const cleanPath = url.pathname.replace(/^\/+/, '');
    if (process.env.NEXT_PUBLIC_API_BASE) {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, '');
      return `${API_BASE}/tmdb-proxy/${cleanPath}`;
    }
  }
  
  // If already a full URL (non-TMDB), return as-is
  if (path.startsWith('http')) return path;
  
  // Clean the path: remove leading slashes and duplicate t/p/<size>/ parts
  let cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  cleanPath = cleanPath.replace(/^t\/p\/[^\/]+\//, ''); // Remove t/p/<size>/ prefix if exists
  
  // Always use proxy if API_BASE is available, otherwise direct TMDB CDN
  if (process.env.NEXT_PUBLIC_API_BASE) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, ''); // Remove trailing slash
    return `${API_BASE}/tmdb-proxy/t/p/${size}/${cleanPath}`;
  } else {
    return `https://image.tmdb.org/t/p/${size}/${cleanPath}`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackEvent(_name: string, _props?: Props): void {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackConsentedEvent(_name: string, _props?: Props): void {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackFilmStats(_stats: unknown): void {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackAnalyticsEvent(_name: string, _props?: Props): void {}

