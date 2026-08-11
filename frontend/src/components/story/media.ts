import type { StatsData } from '@/containers/results/sections/types';
import type { StoryMedia } from './types';

export function tmdbCdn(path: string | null | undefined, size = 'w780'): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/+/, '').replace(/^t\/p\/[^/]+\//, '');
  return `https://image.tmdb.org/t/p/${size}/${clean}`;
}

export function posterMedia(film: { title?: string; poster_path?: string | null } | null | undefined, size = 'w780'): StoryMedia | null {
  const url = tmdbCdn(film?.poster_path, size);
  if (!url) return null;
  return { type: 'poster', url, alt: `${film?.title ?? 'Film'} poster`, objectPosition: 'center center' };
}

export function profileMedia(person: { name?: string; profile_path?: string | null } | null | undefined): StoryMedia | null {
  const url = tmdbCdn(person?.profile_path, 'h632');
  if (!url) return null;
  return { type: 'profile', url, alt: `${person?.name ?? 'Person'} portrait`, objectPosition: '50% 28%' };
}

export function compactMedia(items: Array<StoryMedia | null | undefined>, limit = 8): StoryMedia[] {
  const seen = new Set<string>();
  const output: StoryMedia[] = [];
  for (const item of items) {
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

export function allPosterMedia(stats: StatsData): StoryMedia[] {
  return compactMedia((stats.all_films ?? []).map((film) => posterMedia(film, 'w342')), Number.POSITIVE_INFINITY);
}

export function filmByTitle(stats: StatsData, title?: string | null) {
  if (!title) return null;
  const clean = title.toLowerCase();
  return (stats.all_films ?? []).find((film) => film.title?.toLowerCase() === clean) ?? null;
}

export function topRatedPosters(stats: StatsData, limit = 8) {
  return compactMedia(
    [...(stats.all_films ?? [])]
      .filter((film) => film.poster_path)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((film) => posterMedia(film)),
    limit,
  );
}

export function genrePosters(stats: StatsData, genre?: string, limit = 8) {
  return compactMedia(
    (stats.all_films ?? [])
      .filter((film) => !genre || film.genres?.includes(genre))
      .map((film) => posterMedia(film)),
    limit,
  );
}

export function personFilmPosters(stats: StatsData, name?: string, role: 'director' | 'actor' = 'director', limit = 6) {
  const clean = name?.toLowerCase();
  if (!clean) return [];
  return compactMedia(
    (stats.all_films ?? [])
      .filter((film) => role === 'director'
        ? film.director?.toLowerCase() === clean
        : film.cast?.some((actor) => actor.toLowerCase() === clean))
      .map((film) => posterMedia(film, 'w500')),
    limit,
  );
}

export function storySeason(value: string | { season?: string; percentage?: number; story?: string } | undefined): string | null {
  if (typeof value === 'string') return value;
  return value?.season ?? null;
}

export function activeDayCopy(value: string | { date?: string; films?: number; story?: string } | undefined): string | null {
  if (typeof value === 'string') return value;
  if (!value) return null;
  if (value.story) return value.story;
  if (value.date && value.films) return `${value.date}, when you watched ${value.films} films`;
  return value.date ?? null;
}

export function generousCriticPosters(stats: StatsData): StoryMedia[] {
  const films = (stats.all_films ?? []).filter((film) => film.poster_path);
  const fiveStar = films.filter((film) => film.rating === 5);
  const featured = fiveStar.length > 0 ? fiveStar : films.filter((film) => film.rating === 4.5);
  return compactMedia(featured.map((film) => posterMedia(film, 'w500')), Number.POSITIVE_INFINITY);
}
