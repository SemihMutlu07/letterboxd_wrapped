import { describe, expect, it } from 'vitest';
import { buildSummaryForPersistence } from './analysis_runs';

describe('buildSummaryForPersistence', () => {
  it('persists only allowlisted aggregate result fields', () => {
    const summary = buildSummaryForPersistence({
      total_films: 42,
      average_rating: 3.8,
      total_countries: 12,
      top_genres: [
        { name: 'Drama', count: 20, films: ['Secret Film'] },
        { name: 'Comedy', count: 10 },
      ],
      top_directors: [{ name: 'Director', count: 4, films: [{ title: 'Private Title' }] }],
      sinefil_meter: {
        score: 73,
        type: 'Explorer',
        model_version: 'cine_v2',
        breakdown: { geography: 10 },
      },
      cinematic_persona: { persona: 'The Explorer', description: 'Sensitive prose' },
      all_films: [{ title: 'Private Title', rating: 5 }],
      rated_films: [{ title: 'Another Private Title' }],
      review_analysis: {
        reviews: [{ title: 'Private Title', text: 'Private review', likers: ['person'] }],
      },
      scraped_username: 'alice',
      profile_avatar_url: 'https://example.test/avatar.jpg',
    });

    expect(summary.details).toEqual(
      expect.objectContaining({
        total_films: 42,
        average_rating: 3.8,
        total_countries: 12,
        top_genres: [
          { name: 'Drama', count: 20 },
          { name: 'Comedy', count: 10 },
        ],
        top_directors: [{ name: 'Director', count: 4 }],
        sinefil_meter: { score: 73, type: 'Explorer', model_version: 'cine_v2' },
        cinematic_persona: { persona: 'The Explorer' },
      }),
    );
    expect(summary.details).not.toHaveProperty('all_films');
    expect(summary.details).not.toHaveProperty('rated_films');
    expect(summary.details).not.toHaveProperty('review_analysis');
    expect(summary.details).not.toHaveProperty('scraped_username');
    expect(summary.details).not.toHaveProperty('profile_avatar_url');
    expect(summary.schema_version).toBe('results_v2_aggregate');
    expect(JSON.stringify(summary)).not.toContain('Private');
    expect(JSON.stringify(summary)).not.toContain('Sensitive prose');
  });
});
