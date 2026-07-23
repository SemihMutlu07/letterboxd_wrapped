export type ShareOrientation = 'horizontal' | 'vertical';

export type ShareVariant =
  | 'default'
  | 'admit-one'
  | 'minimal-outlier'
  | 'apple-hig'
  | 'editorial'
  | 'variant-3'
  | 'double-feature'
  | 'contact-sheet';

export type SharePersonStat = {
  name: string;
  headshotUrl: string;
  count: number;
};

export type ShareFilmStat = {
  title: string;
  year: string;
  posterPath: string | null;
};

export type ShareReviewWordStat = {
  word: string;
  count: number;
};

export type ShareOutlierFilm = {
  title: string;
  year: string;
  posterPath: string | null;
  userRating: number;
  avgRating: number;
  delta: number;
};

export type ShareCardData = {
  onScreenCrush: SharePersonStat;
  favoriteDirector: SharePersonStat;
  watchedFilms: number;
  spentDays: number;
  spentHours: number;
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
  /** Top-rated films for poster strip (optional, up to 5) */
  topFilms?: ShareFilmStat[];
  /** Top distinctive review words from review_analysis.word_frequency (optional, up to 3) */
  topReviewWords?: ShareReviewWordStat[];
  /** Single film where user rating diverges most from TMDB community average. */
  ratingOutlierFilm?: ShareOutlierFilm;
  /** Letterboxd username shown on the card so viewers know whose Wrapped it is. */
  username?: string;
};

export type ShareCardInput = Omit<ShareCardData, 'favoriteDirector'> & {
  favoriteDirector: SharePersonStat | null;
};
