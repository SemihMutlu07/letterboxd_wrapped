import { getRuntimeHours } from '@/containers/results/results-model';
import type { StatsData } from '@/containers/results/sections/types';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardInput, ShareOrientation, ShareVariant, SharePersonStat } from '@/components/share/types';

/**
 * One-time heavy StatsData -> light finale view-model. Mirrors the mapping in
 * ResultsPage.shareCardData so the story finale renders the same share card
 * without re-walking the full payload on every frame.
 */

export function buildStoryShareCard(stats: StatsData): ShareCardInput {
  const topActors: SharePersonStat[] = (stats.top_actors ?? []).slice(0, 5).map((person) => ({
    name: person.name,
    headshotUrl: getTmdbImageUrl(person.profile_path) ?? '',
    count: person.count,
  }));
  const actorNames = new Set(topActors.map((actor) => actor.name));
  const topDirectors: SharePersonStat[] = (stats.top_directors ?? [])
    .slice(0, 5)
    .map((person) => ({
      name: person.name,
      headshotUrl: getTmdbImageUrl(person.profile_path) ?? '',
      count: person.count,
    }))
    .filter((director) => !actorNames.has(director.name));

  const runtimeHours = getRuntimeHours(stats);
  const filmSource = stats.favorite_films?.length ? stats.favorite_films : (stats.rated_films ?? []);
  const topFilms = filmSource.slice(0, 5).map((film) => ({
    title: film.title,
    year: film.year ? String(film.year) : '',
    posterPath: film.poster_path && film.poster_path.length > 0 ? film.poster_path : null,
  }));

  return {
    year: new Date().getFullYear(),
    writtenReviews: stats.review_analysis?.reviews_with_text ?? 0,
    genres: (stats.top_genres ?? []).slice(0, 5).map(({ name }) => name),
    onScreenCrush: topActors[0] ?? { name: '', headshotUrl: '', count: 0 },
    favoriteDirector: topDirectors[0] ?? null,
    watchedFilms: stats.total_films || 0,
    spentDays: Math.round(runtimeHours / 24),
    spentHours: Math.round(runtimeHours),
    timePercent: 0,
    cinemaScale: stats.sinefil_meter?.score ?? 0,
    personaLabel: stats.cinematic_persona?.persona ?? '',
    minutesAverage: Math.round(stats.average_runtime || 0),
    mostCommonRating: stats.most_common_rating ?? 3.5,
    peakDecade: stats.favorite_decade?.name ?? '2020s',
    peakDecadeCount: stats.favorite_decade?.count ?? 0,
    topActors,
    topDirectors,
    topFilms,
    username: stats.scraped_username || undefined,
  };
}

/** Fixed DOM footprint of each orientation's share card, for finale scaling. */
export const FINALE_CARD_DOM: Record<ShareOrientation, { w: number; h: number }> = {
  horizontal: { w: 1200, h: 675 },
  vertical: { w: 675, h: 1200 },
};

/** Default variant per orientation shown in the finale. */
export const FINALE_VARIANT: Record<ShareOrientation, ShareVariant> = {
  horizontal: 'default',
  vertical: 'double-feature',
};

/** Portrait finale on phones, landscape on wider containers. */
export function pickFinaleOrientation(viewportWidth: number): ShareOrientation {
  return viewportWidth < 768 ? 'vertical' : 'horizontal';
}
