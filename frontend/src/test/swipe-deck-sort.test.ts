import { describe, expect, it } from 'vitest';

import { sortFilms } from '@/components/watchlist/SwipeDeck';
import type { WatchlistFilm } from '@/lib/api';

const films: WatchlistFilm[] = [
  { title: 'A', year: '2001', slug: 'a', popularity: 10, vote_average: 6, vote_count: 500 },
  { title: 'B', year: '2020', slug: 'b', popularity: 30, vote_average: 9, vote_count: 100 },
  { title: 'C', year: '2010', slug: 'c', popularity: 20, vote_average: 7, vote_count: 900 },
];

describe('sortFilms', () => {
  it('sorts by popularity descending', () => {
    expect(sortFilms(films, 'popularity').map((f) => f.slug)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by vote_count descending ("most watched")', () => {
    expect(sortFilms(films, 'votes').map((f) => f.slug)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by rating descending', () => {
    expect(sortFilms(films, 'rating').map((f) => f.slug)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by year descending', () => {
    expect(sortFilms(films, 'year').map((f) => f.slug)).toEqual(['b', 'c', 'a']);
  });
});
