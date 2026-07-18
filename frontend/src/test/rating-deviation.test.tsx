import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import RatingDeviation, { requiresRatingDeviation } from '@/containers/results/experimental/sections/RatingDeviation';
import type { StatsData } from '@/containers/results/experimental/types';

const stats = {
  total_films: 6,
  average_rating: 3,
  days_watched: 1,
  average_runtime: 100,
  top_genres: [],
  top_directors: [],
  top_actors: [],
  top_countries: [],
  top_languages: [],
  decades: [],
  rating_distribution: {},
  rated_films: [
    { title: 'Above Crowd', your_rating: 5, community_rating: 3.2, poster_path: '/above.jpg' },
    { title: 'Below Crowd', your_rating: 1, community_rating: 4.1, poster_path: '/below.jpg' },
    { title: 'Small Above', your_rating: 4, community_rating: 3.5 },
    { title: 'Small Below', your_rating: 2, community_rating: 2.5 },
    { title: 'Same Enough', your_rating: 3, community_rating: 3.1 },
    { title: 'Missing Crowd', your_rating: 5, community_rating: null },
  ],
} satisfies StatsData;

describe('RatingDeviation', () => {
  it('gates on valid per-film community ratings', () => {
    expect(requiresRatingDeviation(stats).ok).toBe(true);
    expect(requiresRatingDeviation({ ...stats, rated_films: stats.rated_films?.slice(0, 4) }).ok).toBe(false);
  });

  it('renders per-film crowd deltas and excludes missing crowd ratings', () => {
    render(<RatingDeviation stats={stats} />);

    expect(screen.getByText('Your Rating Outliers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'You rated higher' })).toBeInTheDocument();
    expect(screen.getAllByText('You +1.8★').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Community').length).toBeGreaterThan(0);
    expect(screen.queryByText('Missing Crowd')).not.toBeInTheDocument();
  });

  it('matches poster metadata by title and release year', () => {
    const withRemakes = {
      ...stats,
      rated_films: [
        { title: 'Suspiria', year: 2018, your_rating: 5, community_rating: 3 },
        ...stats.rated_films.slice(1),
      ],
      all_films: [
        { title: 'Suspiria', year: 1977, poster_path: '/original.jpg', director: 'Dario Argento' },
        { title: 'Suspiria', year: 2018, poster_path: '/remake.jpg', director: 'Luca Guadagnino' },
      ],
    } satisfies StatsData;

    render(<RatingDeviation stats={withRemakes} />);
    expect(screen.getByAltText('Suspiria')).toHaveAttribute('src', expect.stringContaining('/remake.jpg'));
  });
});
