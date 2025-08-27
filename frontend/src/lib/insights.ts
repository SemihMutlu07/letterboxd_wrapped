import type { } from '../app/results/page';

export interface LetterboxdStatsLite {
  total_films: number;
  favorite_genre?: { name: string };
  total_countries: number;
  sinefil_meter?: { score: number };
  metadata_coverage?: number;
}

class InsightsCollector {
  collectPatterns(stats: LetterboxdStatsLite) {
    return {
      filmVolumeCategory: this.categorizeUser(stats.total_films),
      genrePreference: stats.favorite_genre?.name,
      internationalScore: stats.total_countries > 20 ? 'high' : 'moderate',
      isCinephile: stats.total_films > 365,
      isPowerUser: stats.total_films > 1000,
      hasNicheTitle: (stats.sinefil_meter?.score ?? 0) > 70,
      dataCompleteness: stats.metadata_coverage ?? null,
      featuresUsed: [],
    };
  }

  categorizeUser(films: number): string {
    if (films < 50) return 'casual';
    if (films < 200) return 'regular';
    if (films < 500) return 'enthusiast';
    if (films < 1000) return 'devoted';
    return 'obsessed';
  }
}

export const insights = new InsightsCollector();

