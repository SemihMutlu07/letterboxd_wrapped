export type ErrorReason =
  | 'no_files_selected'
  | 'no_csv_files'
  | 'invalid_file_type'
  | 'file_too_large'
  | 'corrupt_zip'
  | 'missing_required_files'
  | 'backend_unreachable'
  | 'tmdb_timeout'
  | 'tmdb_rate_limited'
  | 'no_username'
  | 'invalid_username'
  | 'no_films'
  | 'user_not_found'
  | 'scrape_failed'
  | 'unknown_error';

export interface NormalizedError {
  title: string;
  message: string;
  action?: string;
  reason: ErrorReason;
}

/**
 * Map a raw error (from backend detail or network failure) to a structured
 * NormalizedError that the UI can display consistently.
 */
export function normalizeError(err: unknown): NormalizedError {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  // Backend unreachable / network failure
  if (
    err instanceof TypeError ||
    /Failed to fetch|NetworkError|fetch|ECONNREFUSED/i.test(raw)
  ) {
    return {
      title: "Can't reach the server",
      message:
        'The analysis server appears to be offline or your connection dropped.',
      action: 'Try again in a moment.',
      reason: 'backend_unreachable',
    };
  }

  // Corrupt ZIP
  if (/not a valid ZIP|BadZipFile|corrupt/i.test(raw)) {
    return {
      title: 'Corrupt ZIP file',
      message:
        'The file you uploaded is not a valid ZIP archive. Please re-download your Letterboxd export and try again.',
      reason: 'corrupt_zip',
    };
  }

  // Missing required CSVs
  if (/No valid Letterboxd CSV|missing_required_files/i.test(raw)) {
    return {
      title: 'Required files not found',
      message:
        'No valid Letterboxd CSV files were found in the upload. This often happens on Mac when Safari auto-extracts the ZIP.',
      action:
        'Re-download the original ZIP from Letterboxd and upload it directly — do not extract the files. (On Mac, Safari may unzip automatically; use Chrome or Firefox instead.)',
      reason: 'missing_required_files',
    };
  }

  // File too large
  if (/413|too large|file_too_large/i.test(raw)) {
    return {
      title: 'File too large',
      message:
        'The uploaded file exceeds the maximum allowed size (50 MB).',
      action: 'Try exporting a smaller date range or compressing the file.',
      reason: 'file_too_large',
    };
  }

  // TMDB timeout
  if (/TMDB.*timeout|timeout.*TMDB/i.test(raw)) {
    return {
      title: 'Movie database timeout',
      message:
        'The movie metadata service took too long to respond.',
      action: 'Please try again in a few moments.',
      reason: 'tmdb_timeout',
    };
  }

  // Rate limited
  if (/429|rate.?limit/i.test(raw)) {
    return {
      title: 'Too many requests',
      message:
        'You have made too many requests in a short period.',
      action: 'Please wait a minute and try again.',
      reason: 'tmdb_rate_limited',
    };
  }

  // Scrape blocked by Letterboxd bot detection (cloud IP)
  if (/scrape_blocked|letterboxd is blocking|rate limit hit/i.test(raw)) {
    return {
      title: 'Letterboxd access blocked',
      message: raw || 'Letterboxd has temporarily blocked automated profile access.',
      action: 'For the most reliable results, download your Letterboxd export and upload it here.',
      reason: 'scrape_blocked',
    };
  }

  // No public films on this profile
  if (/no_films|no public films/i.test(raw)) {
    return {
      title: 'No public films',
      message: raw || 'No public films found on this profile.',
      action: 'Make sure your profile is public and your watched films are visible to everyone (not just followers).',
      reason: 'no_films',
    };
  }

  // Scrape-specific: user truly not found vs blocked
  if (/user_not_found/i.test(raw)) {
    return {
      title: 'Profile not found',
      message: raw || 'This Letterboxd user could not be found.',
      action:
        'Check the username is spelled exactly right and the profile is public (not a private/patron-only profile).',
      reason: 'user_not_found',
    };
  }

  if (/blocked|blocking|automated access/i.test(raw)) {
    return {
      title: 'Blocked by Letterboxd',
      message: raw || 'Letterboxd blocked the request.',
      action: 'Try again in a few minutes. If it persists, use the ZIP upload method instead.',
      reason: 'scrape_failed',
    };
  }

  if (/scrape_unreachable|Could not reach Letterboxd/i.test(raw)) {
    return {
      title: "Can't reach Letterboxd",
      message: raw || 'The server could not connect to Letterboxd.',
      action: 'Check your internet connection and try again.',
      reason: 'backend_unreachable',
    };
  }

  if (/402|429|rate.?limit/i.test(raw)) {
    return {
      title: 'Rate limited',
      message: 'Letterboxd is rate-limiting requests from this server.',
      action: 'Wait a minute and try again, or use the ZIP upload.',
      reason: 'scrape_failed',
    };
  }

  // Fallback — include raw debug detail for backend errors
  const showDebug = /Debug:/.test(raw);
  return {
    title: showDebug ? 'Something went wrong (debug)' : 'Something went wrong',
    message: raw || 'An unexpected error occurred during analysis.',
    action: showDebug ? undefined : 'Try again. If the issue persists, use the ZIP upload instead.',
    reason: 'unknown_error',
  };
}
