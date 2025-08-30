export function parseLetterboxdUsername(filename: string): string | null {
  // Enhanced patterns for Mac exports:
  // - letterboxd-<username>-*.csv (standard)
  // - letterboxd-<username>.csv (no date)
  // - letterboxd-<username>-YYYY-MM-DD.csv (with date)
  // - letterboxd-<username>-YYYYMMDD.csv (compact date)
  // Case-insensitive, allow - and _ inside username
  const patterns = [
    /^letterboxd-([^-]+?)(?:-\d{4}(?:-\d{2})?(?:-\d{2})?)?\.csv$/i,
    /^letterboxd-([^-]+?)\.csv$/i
  ];
  
  for (const pattern of patterns) {
    const match = filename.toLowerCase().match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}
