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
  poster_url?: string;
  poster_path?: string;
  popularity?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  genres?: string[];
}

export interface WatchlistBucketCounts {
  common: number;
  first_only: number;
  second_only: number;
}

export interface WatchlistTruncation {
  common: boolean;
  first_only: boolean;
  second_only: boolean;
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
  returned_counts?: WatchlistBucketCounts;
  truncated?: WatchlistTruncation;
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
  const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
  const rawMessage = error instanceof Error ? error.message : String(error);
  const hint = code ? ERROR_CODE_HINTS[code] : undefined;

  // Log a structured, self-diagnosing error so the console is useful for both
  // users and the next Claude session. We always log detail + hint + code.
  console.error(`[API Error] ${context}:`, rawMessage, {
    code,
    hint,
    error,
    context,
  });

  if (error instanceof Error) {
    if (error.name === 'TypeError' || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
      const err = new Error(`Network error: Unable to connect to ${context}. The server may still be starting or your internet connection may be down.`);
      if (code) (err as { code?: string }).code = code;
      return err;
    }
    if (code) {
      // The error already carries a backend code; prefer that over regexp parsing.
      return error;
    }
    return error;
  }
  const err = new Error(`Unexpected error in ${context}: ${rawMessage}`);
  if (code) (err as { code?: string }).code = code;
  return err;
}

// Likely cause for a given backend error_code — surfaced in the console log so a
// failure is self-diagnosing (for both a human and a future Claude session reading
// the console) instead of a raw object dump with no explanation.
const ERROR_CODE_HINTS: Record<string, string> = {
  scraper_unavailable:
    'All available scraper slots are full. If the backend uses a desktop worker, the worker is either busy, offline, or still starting up. Try again in 30–60 seconds or use ZIP upload for a guaranteed result.',
  worker_paused:
    'The admin dashboard paused the desktop worker. Scrape jobs will not run until an admin resumes the worker. ZIP upload still works.',
  desktop_worker_paused: 'Admin dashboard has the worker paused for maintenance.',
  worker_offline:
    'No desktop worker heartbeat has been received. The worker process is not running or cannot reach the backend. Restart the worker or use ZIP upload.',
  desktop_worker_offline:
    'No desktop worker heartbeat has been received. The worker process is not running or cannot reach the backend. Restart the worker or use ZIP upload.',
  scrape_blocked:
    'Letterboxd blocked the scrape request (bot detection / cloud IP). The backend has reached Letterboxd directly and was denied. Use ZIP upload instead.',
  user_not_found:
    'Letterboxd returned a 404 for this username, or the profile is private. Double-check spelling and that the profile is public.',
  same_username: 'Both usernames were identical. This is a client-side validation problem.',
  watchlist_lab_rate_limited:
    'You hit the per-client watchlist-lab rate limit (10 requests / 10 min). Wait a few minutes.',
  scrape_timeout:
    'The desktop worker accepted the job but did not finish within the timeout. It may be stuck or overloaded. Try again.',
  enrichment_failed:
    'TMDB metadata lookup failed for the shared watchlist. This is usually transient. Try again.',
  invalid_username:
    'The submitted username contains invalid characters. The UI should prevent this; report if it did not.',
  no_common_watchlist:
    'The two watchlists have zero films in common. This is a real result, not an error.',
};

export { ERROR_CODE_HINTS };

// Shared failure parser for watchlist/date-night endpoints: reads the FastAPI
// `{detail: {error_code, message}}` shape, logs a labeled + hinted console error,
// and returns an Error carrying `.code` for handleApiError to pass through.
async function parseApiFailure(r: Response, context: string, fallbackMessage: string): Promise<Error & { code?: string }> {
  let detail = '';
  let code: string | undefined;
  let fullBody: unknown;
  try {
    fullBody = await r.json();
    if (typeof fullBody === 'object' && fullBody !== null) {
      const { detail: bodyDetail } = fullBody as { detail?: unknown };
      if (typeof bodyDetail === 'string') {
        detail = bodyDetail;
      } else if (bodyDetail && typeof bodyDetail === 'object') {
        const obj = bodyDetail as Record<string, unknown>;
        detail = String(obj.message || obj.error_code || '');
        code = typeof obj.error_code === 'string' ? obj.error_code : undefined;
      }
    }
  } catch {
    // body wasn't JSON
  }
  const err = new Error(detail || fallbackMessage) as Error & { code?: string };
  if (code) err.code = code;
  console.error(
    `[API Error] ${context} failed — ${code ? `error_code: ${code}` : `HTTP ${r.status}`}`,
    {
      status: r.status,
      code,
      detail,
      hint: code ? ERROR_CODE_HINTS[code] : undefined,
      body: fullBody,
      url: r.url,
    },
  );
  return err;
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

export type ScrapeTraceEvent = {
  stage?: string;
  message?: string;
  metrics?: Record<string, unknown>;
  elapsed_seconds?: number;
};

export type ScrapeProgress = {
  stage?: string;
  message?: string;
  trace_events?: ScrapeTraceEvent[];
};

// Poll a task until it reaches a terminal state (done | failed).
async function pollTask(
  taskId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (p: ScrapeProgress) => void } = {},
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

    // pending | running — surface live progress, then wait and retry
    opts.onProgress?.({ stage: task.stage, message: task.message, trace_events: task.trace_events });
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
      throw await parseApiFailure(r, 'file analysis', `analyze ${r.status}`);
    }

    const data = await r.json();
    if (data && data.task_id) {
      return await pollTask(data.task_id);
    }
    if (!data || data.status === 'error') {
      throw new Error(data?.detail || 'Analysis failed');
    }
    return data as { status: string; stats: LetterboxdStats };
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

// Scrape a Letterboxd profile by username.
// Handles two backend contracts transparently:
//   - synchronous (local / no desktop worker): { status, stats }
//   - desktop-worker mode: 202 { task_id } → poll /api/progress until done
// Either way the caller receives { status, stats }.
export async function scrapeProfile(
  username: string,
  signal?: AbortSignal,
  onProgress?: (p: ScrapeProgress) => void,
) {
  const url = `${API_BASE}/api/scrape-profile`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      signal,
    });

    if (!r.ok) {
      throw await parseApiFailure(r, 'profile scraping', `scrape ${r.status}`);
    }

    const data = await r.json();

    // Desktop-worker mode: the job was queued — poll until the worker finishes.
    if (data && data.task_id && !data.stats) {
      return await pollTask(data.task_id, { onProgress });
    }

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
      throw await parseApiFailure(r, 'watchlist comparison', `watchlist compare ${r.status}`);
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
      throw await parseApiFailure(r, 'watchlist recommendation', `watchlist recommendation ${r.status}`);
    }

    return await r.json() as RecommendFromCompareResult;
  } catch (error) {
    throw handleApiError(error, 'watchlist recommendation');
  }
}

// Enrich watchlist common films with TMDB metadata (popularity, genres, ratings)
export async function enrichWatchlistFilms(
  firstUsername: string,
  secondUsername: string,
): Promise<{ status: string; users: [string, string]; films: WatchlistFilm[] }> {
  const url = `${API_BASE}/api/watchlist-enrich`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [firstUsername, secondUsername] }),
    });

    if (!r.ok) {
      throw await parseApiFailure(r, 'watchlist enrichment', `watchlist enrichment ${r.status}`);
    }

    return await r.json();
  } catch (error) {
    throw handleApiError(error, 'watchlist enrichment');
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
      throw await parseApiFailure(r, 'date night recommendations', `date night ${r.status}`);
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
