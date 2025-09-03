export function extractLetterboxdUsername(fileName: string): string | null {
  // patterns: letterboxd-<username>-*.csv OR letterboxd-<username>.csv
  const m = fileName.toLowerCase().match(/^letterboxd-([^-.]+)[.-]/);
  return m?.[1] || null;
}
