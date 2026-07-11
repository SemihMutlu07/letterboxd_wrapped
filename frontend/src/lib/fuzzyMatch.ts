export function normalizeGuess(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

export function isFuzzyMatch(guess: string, answer: string, aliases?: string[]): boolean {
  const normGuess = normalizeGuess(guess);
  if (!normGuess) return false;

  const candidates = [answer, ...(aliases ?? [])].map(normalizeGuess);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (normGuess === candidate) return true;

    // Franchise shorthand / substring containment (only for reasonably long strings
    // so short guesses like "a" or "up" don't match everything).
    if (normGuess.length >= 4 && (candidate.includes(normGuess) || normGuess.includes(candidate))) {
      return true;
    }

    const maxLen = Math.max(normGuess.length, candidate.length);
    const threshold = maxLen <= 4 ? 0 : Math.max(1, Math.floor(maxLen * 0.2));
    if (levenshtein(normGuess, candidate) <= threshold) return true;
  }

  return false;
}
