// Minimal typing for analysis stats — keeps component code readable without
// encoding the full backend schema here.
export interface LetterboxdStats {
  total_films?: number;
  total_countries?: number;
  average_rating?: number;
  favorite_genre?: { name: string; count: number } | null;
  [key: string]: unknown;
}

export interface WatchlistFilm {
  title: string;
  year: string;
  slug: string;
}

export interface WatchlistCompareResult {
  status: 'success';
  users: [string, string];
  counts: {
    first_total: number;
    second_total: number;
    common: number;
    first_only: number;
    second_only: number;
  };
  match_score: number;
  common: WatchlistFilm[];
  first_only: WatchlistFilm[];
  second_only: WatchlistFilm[];
}

export type RecommendationStrategy = 'random' | 'highest_rated' | 'newest';

export interface FilmRecommendation {
  title: string;
  year: string;
  reason: string;
  poster_path: string;
  slug?: string;
  vote_average?: number | null;
  release_date?: string;
}

export interface RecommendFromCompareResult {
  recommendation: FilmRecommendation;
  alternatives: FilmRecommendation[];
}

export interface DateNightResult {
  mutual_profile: {
    top_genres: string[];
    top_directors: string[];
    era_overlap: string;
  };
  recommendations: FilmRecommendation[];
}

// API base configuration
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');

// Enhanced error handling utility
export function handleApiError(error: unknown, context: string): Error {
  if (error instanceof Error) {
    if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      return new Error(`Network error: Unable to connect to ${context}. The server may still be starting or your internet connection may be down.`);
    }
    if (error.message.includes('analyze') || error.message.includes('test')) {
      const statusMatch = error.message.match(/(\d+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';
      switch (status) {
        case '404': return new Error(`${context} not found. The service may be temporarily unavailable.`);
        case '500': return new Error(`Server error in ${context}. Please try again later.`);
        case '413': return new Error(`File too large for ${context}. Please try with smaller files.`);
        case '429': return new Error(`Too many requests to ${context}. Please wait a moment and try again.`);
        default:    return new Error(`${context} failed (${status}). Please try again.`);
      }
    }
    return error;
  }
  return new Error(`Unexpected error in ${context}: ${String(error)}`);
}

// Search for person (director/actor) in TMDB
export async function searchPerson(name: string, role: 'director' | 'actor' = 'director') {
  const url = `${API_BASE}/api/tmdb/person/search?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`;
  try {
    const r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`TMDB search ${r.status}`);
    const data = await r.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid response from TMDB search');
    return data;
  } catch (error) {
    const enhancedError = handleApiError(error, 'TMDB search');
    return { found: false, message: enhancedError.message, name, url: null, error: enhancedError.message };
  }
}

// Poll a task until it reaches a terminal state (done | failed).
async function pollTask(
  taskId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ status: string; stats: LetterboxdStats }> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs  = opts.timeoutMs  ?? 600_000; // 10 min max
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const r = await fetch(`${API_BASE}/api/progress/${taskId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!r.ok) {
      if (r.status === 404) throw new Error('Task not found or expired');
      throw new Error(`Progress poll failed: ${r.status}`);
    }

    const task = await r.json();

    if (task.status === 'done') {
      const result = task.result;
      if (!result) throw new Error('Analysis returned no result');
      if (result.status === 'error') throw new Error(result.detail || 'Analysis failed');
      return result as { status: string; stats: LetterboxdStats };
    }

    if (task.status === 'failed') {
      throw new Error(task.error || 'Analysis failed on the server');
    }

    // pending | running — wait and retry
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Analysis timed out after 10 minutes');
}

// Analyze uploaded files — submits the job and polls until completion.
// The returned shape {status, stats} matches the previous synchronous contract
// so callers do not need to change.
export async function analyzeFiles(formData: FormData): Promise<{ status: string; stats: LetterboxdStats }> {
  const url = `${API_BASE}/api/analyze`;
  try {
    if (!formData || formData.entries().next().done) {
      throw new Error('No files provided for analysis');
    }

    const r = await fetch(url, { method: 'POST', body: formData });

    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        if (typeof body.detail === 'string') detail = body.detail;
        else if (body.detail && typeof body.detail === 'object') detail = body.detail.message || body.detail.error_code || '';
      } catch { /* body not JSON */ }
      throw new Error(detail || `analyze ${r.status}`);
    }

    const { task_id } = await r.json();
    if (!task_id) throw new Error('Server did not return a task_id');

    return await pollTask(task_id);
  } catch (error) {
    throw handleApiError(error, 'file analysis');
  }
}

// Test backend connectivity with retry for concurrent startup
export async function testBackend(retries = 2, delayMs = 1000) {
  const url = `${API_BASE}/`;
  if (process.env.NODE_ENV === 'development') {
    console.log('[api] backend health URL:', url);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!r.ok) throw new Error(`test ${r.status}`);
      const data = await r.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid response from backend health check');
      return data;
    } catch (error) {
      if (attempt === retries) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Backend connection timeout. The server may still be starting up.');
        }
        const enhancedError = handleApiError(error, 'the backend');
        if (process.env.NODE_ENV === 'development') console.error('Backend connectivity test failed after retries:', enhancedError);
        throw enhancedError;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Scrape a Letterboxd profile by username
export async function scrapeProfile(username: string, signal?: AbortSignal) {
  const url = `${API_BASE}/api/scrape-profile`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      signal,
    });

    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (body.detail && typeof body.detail === 'object') {
          detail = body.detail.message || body.detail.error_code || '';
        }
      } catch {
        // body wasn't JSON
      }
      throw new Error(detail || `scrape ${r.status}`);
    }

    const data = await r.json();

    if (!data || data.status === 'error') {
      throw new Error(data?.detail || 'Scraping failed');
    }

    return data;
  } catch (error) {
    // Pass through AbortError so the caller can distinguish cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw handleApiError(error, 'profile scraping');
  }
}

// Compare two public Letterboxd watchlists by username
export async function compareWatchlists(
  firstUsername: string,
  secondUsername: string,
): Promise<WatchlistCompareResult> {
  const url = `${API_BASE}/api/watchlist-compare`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [firstUsername, secondUsername] }),
    });

    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (body.detail && typeof body.detail === 'object') {
          detail = body.detail.message || body.detail.error_code || '';
        }
      } catch {
        // body wasn't JSON
      }
      throw new Error(detail || `watchlist compare ${r.status}`);
    }

    const data = await r.json();

    if (!data || data.status === 'error') {
      throw new Error(data?.detail || 'Watchlist comparison failed');
    }

    return data as WatchlistCompareResult;
  } catch (error) {
    throw handleApiError(error, 'watchlist comparison');
  }
}

// Recommend one movie from two users' shared watchlist overlap
export async function recommendFromCompare(
  firstUsername: string,
  secondUsername: string,
  strategy: RecommendationStrategy = 'random',
): Promise<RecommendFromCompareResult> {
  const url = `${API_BASE}/api/recommend-from-compare`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [firstUsername, secondUsername], strategy }),
    });

    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (body.detail && typeof body.detail === 'object') {
          detail = body.detail.message || body.detail.error_code || '';
        }
      } catch {
        // body wasn't JSON
      }
      throw new Error(detail || `watchlist recommendation ${r.status}`);
    }

    return await r.json() as RecommendFromCompareResult;
  } catch (error) {
    throw handleApiError(error, 'watchlist recommendation');
  }
}

// Build a mutual profile and recommend unwatched films for two users
export async function dateNight(
  firstUsername: string,
  secondUsername: string,
): Promise<DateNightResult> {
  const url = `${API_BASE}/api/date-night`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [firstUsername, secondUsername] }),
    });

    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (body.detail && typeof body.detail === 'object') {
          detail = body.detail.message || body.detail.error_code || '';
        }
      } catch {
        // body wasn't JSON
      }
      throw new Error(detail || `date night ${r.status}`);
    }

    return await r.json() as DateNightResult;
  } catch (error) {
    throw handleApiError(error, 'date night recommendations');
  }
}

// Parse Letterboxd username from filename
export async function parseLetterboxdUsername(filename: string) {
  try {
    const url = `${API_BASE}/api/parse-username`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!r.ok) throw new Error(`parse-username ${r.status}`);
    const data = await r.json();
    if (!data || typeof data !== 'object' || !('username' in data)) {
      throw new Error('Invalid response from username parsing service');
    }
    return data;
  } catch (error) {
    const enhancedError = handleApiError(error, 'username parsing');
    return { username: null, error: enhancedError.message };
  }
}
