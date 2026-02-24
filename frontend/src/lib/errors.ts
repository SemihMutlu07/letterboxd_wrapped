export type ErrorReason =
  | 'no_files_selected'
  | 'invalid_file_type'
  | 'file_too_large'
  | 'corrupt_zip'
  | 'missing_required_files'
  | 'backend_unreachable'
  | 'tmdb_timeout'
  | 'tmdb_rate_limited'
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

  // Fallback
  return {
    title: 'Something went wrong',
    message: raw || 'An unexpected error occurred during analysis.',
    reason: 'unknown_error',
  };
}
