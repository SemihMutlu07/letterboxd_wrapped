/**
 * Shared stats shape passed to every experimental metric component.
 * Intentionally a permissive superset so the registry doesn't need to import
 * from the page-level LetterboxdStats type.
 */
export interface StatsData {
  total_films: number;
  average_rating: number;
  days_watched: number;
  average_runtime: number;
  top_genres: { name: string; count: number }[];
  top_directors: { name: string; count: number; profile_path?: string; person_id?: number }[];
  top_actors: { name: string; count: number; profile_path?: string; person_id?: number }[];
  top_countries: { name: string; count: number }[];
  top_languages: { language: string; count: number }[];
  decades: { decade: string; count: number }[];
  rating_distribution: Record<string, number>;
  most_common_rating?: number;
  day_of_week_pattern?: { weekday: number; weekend: number };
  monthly_viewing_habits?: { month: string; count: number }[];
  favorite_decade?: { name: string; count: number };
  sinefil_meter?: {
    score: number;
    type: string;
    description?: string;
    breakdown?: {
      geography: number;
      temporal: number;
      languages: number;
      volume: number;
      genres: number;
      directors: number;
    };
    model_version?: string;
  };
  total_countries?: number;
  data_timeline?: {
    earliest_date?: string;
    latest_date?: string;
    total_days?: number;
    period_description?: string;
  };
  cinematic_persona?: {
    persona: string;
    description: string;
  };
  favorite_genre?: {
    name: string;
    count: number;
  };
  /** Username when data came from scrape-profile path. */
  scraped_username?: string;
  most_watched_director?: {
    name: string;
    count: number;
  };
  longest_film?: {
    title: string;
    runtime: number;
  };

  // ── Extended fields emitted by backend for experimental sections ────────────
  /** Per-director avg rating; only directors with rated_count >= 3 included. */
  directors_with_ratings?: {
    name: string;
    count: number;
    avg_rating: number;
    rated_count: number;
    profile_path?: string;
  }[];
  /** Per-actor avg rating; only actors with rated_count >= 3 included. */
  actors_with_ratings?: {
    name: string;
    count: number;
    avg_rating: number;
    rated_count: number;
    profile_path?: string;
  }[];
  /** Per-country avg rating; only countries with rated_count >= 5 included. */
  countries_with_ratings?: {
    name: string;
    count: number;
    avg_rating: number;
    rated_count: number;
  }[];
  /** Individual rated film records for rating-deviation section. */
  rated_films?: {
    title: string;
    year?: number;
    rating: number;
    poster_path?: string;
  }[];
  /** Total number of rated films in the upload. */
  total_rated_films?: number;
  /**
   * ISO-2 keyed country data emitted from production_countries TMDB field.
   * More reliable than top_countries (which uses name strings only).
   * avg_rating / rated_count present only when ratings data available + minSample >= 5.
   */
  countries_iso_data?: {
    iso2: string;
    name: string;
    count: number;
    avg_rating?: number;
    rated_count?: number;
  }[];
  /** Full film list for frontend-side re-aggregation (e.g. country→films lookup). */
  all_films?: {
    title: string;
    year?: number;
    director?: string;
    genres?: string[];
    countries?: string[];
    language?: string;
    runtime?: number;
    poster_path?: string;
    decade?: string;
    rating?: number;
  }[];

  /** Review text metrics from compute_review_metrics (review_analysis.py). */
  review_analysis?: {
    total_reviews: number;
    reviews_with_text: number;
    review_rate: number;
    total_words_written: number;
    avg_review_length_words: number;
    unique_words_used: number;
    vocab_richness: number;
    word_frequency: { word: string; count: number }[];
    bigram_frequency: { bigram: string; count: number }[];
    avg_length_by_rating: Record<string, number>;
    language_mix: Record<string, { count: number; percentage: number }>;
    /** Top liked reviews; present only on scrape-profile path with HTML like data. */
    top_liked_reviews?: {
      title: string;
      year: string;
      slug?: string;
      like_count: number;
      rating?: number | null;
      review_date?: string;
      text_preview?: string;
    }[];
    /** Sum of like_count across all reviews with HTML like data. */
    total_review_likes?: number | null;
    /** Number of reviews whose like_count was successfully parsed. */
    reviews_with_likes_data?: number | null;
  };
}
