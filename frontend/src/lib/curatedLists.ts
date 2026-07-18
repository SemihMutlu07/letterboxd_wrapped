import type { WatchlistFilm } from '@/lib/api';

export interface CuratedList {
  slug: string;
  title: string;
  description: string;
  match: (film: WatchlistFilm) => boolean;
}

/**
 * Human-maintained curated lists for the watchlist swipe deck.
 *
 * Adding or editing a list only requires touching this file. The UI imports
 * the array and lets the user filter the shared watchlist by selection.
 */
export const curatedLists: CuratedList[] = [
  {
    slug: 'all',
    title: 'All films',
    description: 'No filter — show every film on the shared shelf.',
    match: () => true,
  },
  {
    slug: 'romcom',
    title: 'Rom-com / Date night',
    description: 'Romance or comedy picks for easy watching together.',
    match: (film) =>
      (film.genres ?? []).some((g) =>
        ['romance', 'comedy'].includes(g.toLowerCase()),
      ),
  },
  {
    slug: 'modern-classics',
    title: 'Modern classics',
    description: 'Well-loved films from the last few decades.',
    match: (film) => {
      const year = parseInt(film.year, 10);
      return (
        !Number.isNaN(year) && year >= 1970 && (film.vote_average ?? 0) >= 8.0
      );
    },
  },
  {
    slug: 'award-season',
    title: 'Award bait',
    description: 'Recent, highly rated, widely seen films.',
    match: (film) => {
      const year = parseInt(film.year, 10);
      return (
        !Number.isNaN(year) &&
        year >= 2010 &&
        (film.vote_average ?? 0) >= 7.5 &&
        (film.vote_count ?? 0) >= 1000
      );
    },
  },
];
