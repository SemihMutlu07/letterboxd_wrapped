import type { ShareCardData, ShareCardInput } from './types';

export const DIRECTOR_UNAVAILABLE = {
  name: '',
  headshotUrl: '',
  count: 0,
} as const;

export function normalizeShareCardData(data: ShareCardInput): ShareCardData {
  return {
    ...data,
    favoriteDirector: data.favoriteDirector ?? { ...DIRECTOR_UNAVAILABLE },
    genres: data.genres.filter(Boolean).slice(0, 5),
    topFilms: (data.topFilms ?? []).slice(0, 5),
  };
}
