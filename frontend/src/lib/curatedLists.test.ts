import { describe, expect, it } from 'vitest';
import type { WatchlistFilm } from '@/lib/api';
import { curatedLists } from '@/lib/curatedLists';

// Mirrors algorithm in SwipeDeck.tsx
function sortFilms(films: WatchlistFilm[], mode: 'popularity' | 'rating' | 'year' | 'most_watched'): WatchlistFilm[] {
  const sorted = [...films];
  if (mode === 'popularity') {
    sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } else if (mode === 'rating') {
    sorted.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  } else if (mode === 'most_watched') {
    sorted.sort((a, b) => (b.vote_count ?? b.popularity ?? 0) - (a.vote_count ?? a.popularity ?? 0));
  } else {
    sorted.sort((a, b) => String(b.year).localeCompare(String(a.year)));
  }
  return sorted;
}

describe('sortFilms', () => {
  it('sorts by popularity descending', () => {
    const films: WatchlistFilm[] = [
      { title: 'A', year: '2020', slug: 'a', popularity: 1 },
      { title: 'B', year: '2020', slug: 'b', popularity: 9 },
      { title: 'C', year: '2020', slug: 'c', popularity: 5 },
    ];
    expect(sortFilms(films, 'popularity').map((f) => f.title)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by rating descending', () => {
    const films: WatchlistFilm[] = [
      { title: 'A', year: '2020', slug: 'a', vote_average: 7.0 },
      { title: 'B', year: '2020', slug: 'b', vote_average: 9.5 },
      { title: 'C', year: '2020', slug: 'c', vote_average: 8.0 },
    ];
    expect(sortFilms(films, 'rating').map((f) => f.title)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by most-watched (vote_count then popularity)', () => {
    const films: WatchlistFilm[] = [
      { title: 'A', year: '2020', slug: 'a', vote_count: 100, popularity: 1 },
      { title: 'B', year: '2020', slug: 'b', vote_count: 50, popularity: 10 },
      { title: 'C', year: '2020', slug: 'c', vote_count: 1000, popularity: 5 },
    ];
    expect(sortFilms(films, 'most_watched').map((f) => f.title)).toEqual(['C', 'A', 'B']);
  });

  it('falls back to popularity when vote_count is missing', () => {
    const films: WatchlistFilm[] = [
      { title: 'A', year: '2020', slug: 'a', popularity: 2 },
      { title: 'B', year: '2020', slug: 'b', popularity: 20 },
    ];
    expect(sortFilms(films, 'most_watched').map((f) => f.title)).toEqual(['B', 'A']);
  });

  it('sorts by newest year descending', () => {
    const films: WatchlistFilm[] = [
      { title: 'A', year: '2018', slug: 'a' },
      { title: 'B', year: '2022', slug: 'b' },
      { title: 'C', year: '2020', slug: 'c' },
    ];
    expect(sortFilms(films, 'year').map((f) => f.title)).toEqual(['B', 'C', 'A']);
  });
});

describe('curatedLists', () => {
  it('includes an "all" list that matches everything', () => {
    const all = curatedLists.find((l) => l.slug === 'all');
    expect(all).toBeDefined();
    expect(all!.match({ title: 'Inception', year: '2010', slug: 'inception' })).toBe(true);
  });

  it('filters rom-com by romance or comedy genres', () => {
    const list = curatedLists.find((l) => l.slug === 'romcom');
    expect(list).toBeDefined();
    expect(list!.match({ title: 'When Harry Met Sally...', year: '1989', slug: 'whms', genres: ['Romance', 'Comedy'] })).toBe(true);
    expect(list!.match({ title: 'The Godfather', year: '1972', slug: 'godfather', genres: ['Crime', 'Drama'] })).toBe(false);
  });

  it('filters modern classics by year and rating', () => {
    const list = curatedLists.find((l) => l.slug === 'modern-classics');
    expect(list).toBeDefined();
    expect(list!.match({ title: 'Pain and Glory', year: '2019', slug: 'pain-and-glory', vote_average: 8.2 })).toBe(true);
    expect(list!.match({ title: 'Old', year: '1965', slug: 'old', vote_average: 8.2 })).toBe(false);
  });
});
