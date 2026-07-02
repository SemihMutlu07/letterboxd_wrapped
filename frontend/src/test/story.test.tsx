import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StoryPage from '@/app/story/page';

const STATS = {
  scraped_username: 'semihmutsuz',
  total_films: 692,
  days_watched: 61,
  average_rating: 3.44,
  total_countries: 56,
  favorite_genre: { name: 'Drama', count: 301 },
  most_watched_director: { name: 'Denis Villeneuve', count: 9 },
  sinefil_meter: { score: 68, type: 'Explorer' },
  cinematic_persona: { persona: 'Emotional Masochist', description: 'You seek out what hurts.' },
};

describe('StoryPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows the empty state when no stats are stored', async () => {
    render(<StoryPage />);
    expect(await screen.findByText(/No result data in this session/i)).toBeInTheDocument();
  });

  it('renders the intro slide from stored stats and advances on tap', async () => {
    sessionStorage.setItem('letterboxdStats', JSON.stringify(STATS));
    render(<StoryPage />);

    expect(await screen.findByText('@semihmutsuz')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Next slide'));
    expect(await screen.findByText('692 films')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Previous slide'));
    expect(await screen.findByText('@semihmutsuz')).toBeInTheDocument();
  });

  it('walks through to the persona and outro slides', async () => {
    sessionStorage.setItem('letterboxdStats', JSON.stringify(STATS));
    render(<StoryPage />);
    await screen.findByText('@semihmutsuz');

    const next = screen.getByLabelText('Next slide');
    for (let i = 0; i < 6; i++) await userEvent.click(next);
    expect(await screen.findByText('Emotional Masochist')).toBeInTheDocument();

    await userEvent.click(next);
    expect(await screen.findByText(/Open full results/i)).toBeInTheDocument();
    // Outro is the last slide — further taps must not crash or move past it.
    await userEvent.click(next);
    expect(screen.getByText(/Open full results/i)).toBeInTheDocument();
  });
});
