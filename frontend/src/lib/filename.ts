export function parseLetterboxdUsername(filename: string): string | null {
  // Accept both raw names and path-like values from folder uploads.
  const base = filename.split('/').pop()?.split('\\').pop() ?? filename;
  const normalized = base.trim().toLowerCase();

  // letterboxd-<username>-YYYY-MM-DD-HH-MM-utc(.csv|.zip)
  // Also supports shorter date suffixes and no extension.
  const withTimestamp = normalized.match(
    /^letterboxd-(.+?)-\d{4}(?:-\d{2}){0,4}(?:-utc)?(?:\.(?:csv|zip))?$/i
  );
  if (withTimestamp?.[1]) return withTimestamp[1];

  // letterboxd-<username>(.csv|.zip)
  const simple = normalized.match(/^letterboxd-(.+?)(?:\.(?:csv|zip))?$/i);
  if (simple?.[1]) return simple[1];

  return null;
}
