export type ShareOrientation = 'horizontal' | 'vertical';

export type ShareVariant =
  | 'default'
  | 'editorial'
  | 'variant-3'
  | 'stat-hero'
  | 'apple-hig'
  | 'narrative'
  | 'visual-first'
  | 'dense-data';

export type SharePersonStat = {
  name: string;
  headshotUrl: string;
  count: number;
};

export type ShareCardData = {
  onScreenCrush: SharePersonStat;
  favoriteDirector: SharePersonStat;
  watchedFilms: number;
  spentDays: number;
  timePercent: number;
  cinemaScale: number;
  personaLabel: string;
  minutesAverage: number;
  mostCommonRating: number;
  peakDecade: string;
  peakDecadeCount: number;
  /** All available actors for swap UI (optional) */
  topActors?: SharePersonStat[];
  /** All available directors for swap UI (optional) */
  topDirectors?: SharePersonStat[];
};
