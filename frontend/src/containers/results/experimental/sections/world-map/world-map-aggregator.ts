/**
 * World map aggregator.
 *
 * Converts StatsData country arrays into lookup maps used by the MapRenderer.
 * All aggregation is memoized at the call-site via useMemo.
 *
 * How to add another map-like section later
 * ─────────────────────────────────────────
 * 1. Import `buildCountryLookup` and pass `stats.countries_iso_data` (or a
 *    differently-keyed country array).
 * 2. Import `buildColorScale` and `getCountryColor` for coloring logic.
 * 3. Reuse `MapRenderer` with a custom `getFeatureColor` callback.
 * 4. The ISO numeric mapping lives in `iso-numeric-to-iso2.ts` — no changes needed
 *    unless you're adding a new topology source.
 */

import type { StatsData } from '../../types';
import type { GateResult } from '../section-utils';
import { gateOk, gateFail } from '../section-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CountryDatum {
  iso2: string;
  name: string;
  count: number;
  avg_rating?: number;
  rated_count?: number;
}

export type MapMode = 'most_watched' | 'highest_rated';

export interface AggregatedMapData {
  /** ISO-2 → datum, for O(1) map feature lookup. */
  byIso2: Map<string, CountryDatum>;
  /** Sorted descending by count (most_watched) or avg_rating (highest_rated). */
  ranked: CountryDatum[];
  maxCount: number;
  maxRating: number;
  totalCountries: number;
  ratedModeAvailable: boolean;
}

// ─── Gating ──────────────────────────────────────────────────────────────────

export function requiresWorldMap(stats: StatsData): GateResult {
  // Prefer ISO-coded data; fall back to name-only top_countries for fallback mode
  const hasIso = (stats.countries_iso_data?.length ?? 0) > 0;
  const hasName = (stats.top_countries?.length ?? 0) > 0;
  if (!hasIso && !hasName) {
    return gateFail('No country data in this export.', ['countries_iso_data', 'top_countries']);
  }
  return gateOk();
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

export function buildCountryLookup(
  stats: StatsData,
  mode: MapMode,
): AggregatedMapData {
  // Prefer ISO-coded data; fall back to name-keyed top_countries (no ISO codes,
  // map coloring will be disabled for those entries)
  const source: CountryDatum[] =
    stats.countries_iso_data && stats.countries_iso_data.length > 0
      ? stats.countries_iso_data
      : (stats.top_countries ?? []).map((c) => ({ iso2: '', name: c.name, count: c.count }));

  // In highest_rated mode, only include countries with avg_rating present
  const filtered: CountryDatum[] =
    mode === 'highest_rated'
      ? source.filter((c) => c.avg_rating != null)
      : source;

  const ranked =
    mode === 'highest_rated'
      ? [...filtered].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
      : [...filtered].sort((a, b) => b.count - a.count);

  const byIso2 = new Map<string, CountryDatum>();
  for (const c of source) {
    if (c.iso2) byIso2.set(c.iso2, c);
  }

  const maxCount = filtered.reduce((m, c) => Math.max(m, c.count), 0);
  const maxRating = filtered.reduce((m, c) => Math.max(m, c.avg_rating ?? 0), 0);
  const ratedModeAvailable = filtered.some((c) => c.avg_rating != null);

  return { byIso2, ranked, maxCount, maxRating, totalCountries: source.length, ratedModeAvailable };
}

// ─── Color scale ─────────────────────────────────────────────────────────────

/** 7 steps: index 0 = no data, 1-6 = light→dark Letterboxd green. */
const COUNT_COLORS = [
  '#1e293b', // 0 — no data (slate-800 neutral)
  '#0d2b16', // 1 film  — barely visible
  '#14532d', // 2-4 films
  '#166534', // 5-15 films
  '#15803d', // 16-50 films
  '#16a34a', // 51-150 films
  '#00c030', // 151+ films — Letterboxd green
] as const;

/** Fixed log-scale thresholds for count coloring (films watched). */
const COUNT_THRESHOLDS = [0, 1, 4, 15, 50, 150] as const;

/** 7 steps: index 0 = no data, 1-6 = warm red→Letterboxd green for avg rating. */
const RATING_COLORS = [
  '#1e293b', // no data
  '#7f1d1d', // < 2.5
  '#92400e', // 2.5 – 3.0
  '#713f12', // 3.0 – 3.5
  '#166534', // 3.5 – 4.0
  '#15803d', // 4.0 – 4.5
  '#00c030', // 4.5+
] as const;

const RATING_THRESHOLDS = [0, 2.5, 3.0, 3.5, 4.0, 4.5] as const;

export function getCountryColor(datum: CountryDatum | undefined, mode: MapMode): string {
  if (!datum) return COUNT_COLORS[0];
  if (mode === 'highest_rated') {
    if (datum.avg_rating == null) return COUNT_COLORS[0];
    const idx = RATING_THRESHOLDS.findLastIndex((t) => datum.avg_rating! >= t);
    return RATING_COLORS[Math.min(idx, RATING_COLORS.length - 1)] ?? RATING_COLORS[0];
  }
  // most_watched — log-scale bins
  const c = datum.count;
  const idx = COUNT_THRESHOLDS.findLastIndex((t) => c > t);
  return COUNT_COLORS[Math.min(idx + 1, COUNT_COLORS.length - 1)] ?? COUNT_COLORS[0];
}

export { COUNT_COLORS, RATING_COLORS };
