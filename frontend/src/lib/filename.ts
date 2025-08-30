export function parseLetterboxdUsername(filename: string): string | null {
  // patterns: letterboxd-<username>-*.csv OR letterboxd-<username>.csv
  // case-insensitive, allow - and _ inside username; stop at next -
  const m = filename.toLowerCase().match(/^letterboxd-([^-]+?)(?:-|\.csv$)/);
  return m?.[1] || null;
}
