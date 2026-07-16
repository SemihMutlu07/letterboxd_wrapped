import { describe, expect, it } from 'vitest';
import { getDirectTmdbImageUrl, getPosterUrl } from './analytics';

describe('TMDB image URL normalization', () => {
  it.each([
    ['/poster.jpg', 'https://image.tmdb.org/t/p/w780/poster.jpg'],
    ['https://image.tmdb.org/t/p/w342/poster.jpg', 'https://image.tmdb.org/t/p/w780/poster.jpg'],
    ['/tmdb-proxy/t/p/original/poster.jpg', 'https://image.tmdb.org/t/p/w780/poster.jpg'],
    ['https://backend.example/tmdb-proxy/t/p/w500/poster.jpg', 'https://image.tmdb.org/t/p/w780/poster.jpg'],
  ])('normalizes %s for direct display', (input, expected) => {
    expect(getDirectTmdbImageUrl(input, 'w780')).toBe(expected);
    expect(getPosterUrl(input, 'grid')).toBe(expected);
  });

  it('preserves unrelated absolute image URLs', () => {
    expect(getPosterUrl('https://letterboxd.example/poster.jpg', 'grid')).toBe(
      'https://letterboxd.example/poster.jpg',
    );
  });

  it('keeps share images on the backend proxy', () => {
    expect(getPosterUrl('/poster.jpg', 'share')).toContain('/tmdb-proxy/t/p/original/poster.jpg');
  });
});
