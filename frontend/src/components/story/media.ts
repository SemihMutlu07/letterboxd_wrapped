import type { StatsData } from '@/containers/results/sections/types';
import type { StoryMedia } from './types';

export function tmdbCdn(path: string | null | undefined, size = 'w780'): string | null {
  if (!path) return null;
  // Local SMT fixture / app-relative assets must not be rewritten to TMDB CDN.
  if (path.startsWith('/demo/') || path.startsWith('demo/')) {
    return path.startsWith('/') ? path : `/${path}`;
  }
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

export function personFilms(
  stats: StatsData,
  name?: string,
  role: 'director' | 'actor' = 'director',
) {
  const clean = name?.toLowerCase();
  if (!clean) return [];
  const seen = new Set<string>();
  const films: NonNullable<StatsData['all_films']> = [];
  for (const film of stats.all_films ?? []) {
    const match = role === 'director'
      ? film.director?.toLowerCase() === clean
      : film.cast?.some((actor) => actor.toLowerCase() === clean);
    if (!match || !film.title) continue;
    const key = film.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    films.push(film);
  }
  return films;
}

function personAttachedFilms(
  stats: StatsData,
  name?: string,
  role: 'director' | 'actor' = 'director',
) {
  const clean = name?.toLowerCase();
  if (!clean) return [];
  const people = role === 'director' ? stats.top_directors : stats.top_actors;
  return people?.find((person) => person.name?.toLowerCase() === clean)?.films ?? [];
}

export function personFilmPosters(stats: StatsData, name?: string, role: 'director' | 'actor' = 'director', limit = 6) {
  // Prefer the person's attached film list (exact credit set) when present.
  const attached = personAttachedFilms(stats, name, role);
  if (attached.length > 0) {
    return compactMedia(attached.map((film) => posterMedia(film, 'w500')), limit);
  }
  return compactMedia(
    personFilms(stats, name, role).map((film) => posterMedia(film, 'w500')),
    limit,
  );
}

/** Rewatches among films tied to a director/actor — most-watched first. */
export function personRewatches(
  stats: StatsData,
  name?: string,
  role: 'director' | 'actor' = 'director',
) {
  const titles = new Set([
    ...personFilms(stats, name, role).map((film) => film.title.toLowerCase()),
    ...personAttachedFilms(stats, name, role).map((film) => film.title.toLowerCase()),
  ]);
  if (titles.size === 0) return [];
  return [...(stats.rewatch_champions ?? [])]
    .filter((entry) => titles.has(entry.title.toLowerCase()))
    .sort((a, b) => b.watch_count - a.watch_count);
}

export function storySeason(value: string | { season?: string; percentage?: number; story?: string } | undefined): string | null {
  if (typeof value === 'string') return value;
  return value?.season ?? null;
}

export function activeDayCopy(
  value: string | { date?: string; films?: number; story?: string } | undefined,
  t?: (key: 'story.rhythm.activeDay', values: { date: string; count: number }) => string,
): string | null {
  if (typeof value === 'string') return value;
  if (!value) return null;
  if (value.story) return value.story;
  if (value.date && value.films && t) {
    return t('story.rhythm.activeDay', { date: value.date, count: value.films });
  }
  return value.date ?? null;
}

export function generousCriticPosters(stats: StatsData): StoryMedia[] {
  const films = (stats.all_films ?? []).filter((film) => film.poster_path);
  const fiveStar = films.filter((film) => film.rating === 5);
  const featured = fiveStar.length > 0 ? fiveStar : films.filter((film) => film.rating === 4.5);
  return compactMedia(featured.map((film) => posterMedia(film, 'w500')), Number.POSITIVE_INFINITY);
}

export const DIRECTOR_STREAM_POSTER_CAP = 12;

export function directorFilmsByName(stats: StatsData, directorName: string) {
  const clean = directorName.toLowerCase();
  return (stats.all_films ?? []).filter((film) => film.director?.toLowerCase() === clean);
}

/** Deterministic capped poster stream — one node per unique film poster. */
export function directorStreamPosters(stats: StatsData, directorName: string, limit = DIRECTOR_STREAM_POSTER_CAP): StoryMedia[] {
  const films = directorFilmsByName(stats, directorName)
    .filter((film) => film.poster_path)
    .sort((a, b) => {
      const ratingDelta = (b.rating ?? 0) - (a.rating ?? 0);
      if (ratingDelta !== 0) return ratingDelta;
      return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
    });
  return compactMedia(films.map((film) => posterMedia(film, 'w500')), limit);
}

export function directorRewatchInsight(
  stats: StatsData,
  directorName: string,
): { title: string; watchCount: number } | null {
  const titles = new Set(
    directorFilmsByName(stats, directorName)
      .map((film) => film.title?.toLowerCase())
      .filter(Boolean) as string[],
  );
  const champion = (stats.rewatch_champions ?? [])
    .filter((entry) => titles.has(entry.title?.toLowerCase() ?? ''))
    .sort((a, b) => b.watch_count - a.watch_count)[0];
  if (!champion || champion.watch_count < 2) return null;
  return { title: champion.title, watchCount: champion.watch_count };
}

export function buildDirectorSequence(
  stats: StatsData,
  directorName: string,
  filmCount: number,
  profilePerson?: { name?: string; profile_path?: string | null } | null,
) {
  return {
    directorName,
    filmCount,
    profile: profileMedia(profilePerson ?? stats.top_directors?.find((d) => d.name === directorName)),
    streamPosters: directorStreamPosters(stats, directorName),
    rewatch: directorRewatchInsight(stats, directorName),
  };
}
