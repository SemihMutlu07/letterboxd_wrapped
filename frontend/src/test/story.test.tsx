import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StoryPage from '@/app/story/page';
import { buildSlides } from '@/components/StoryExperience';
import type { StatsData } from '@/containers/results/experimental/types';

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
    vi.useRealTimers();
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
    expect(await screen.findByText(/Open the dossier/i)).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Pause story')).toBeDisabled();
    await userEvent.click(screen.getByText('Back'));
    expect(await screen.findByText('Emotional Masochist')).toBeInTheDocument();
    await userEvent.click(next);
    // Outro is the last slide — further taps must not crash or move past it.
    await userEvent.click(next);
    expect(screen.getByText(/Open the dossier/i)).toBeInTheDocument();
  });

  it('can pause and resume the story timeline', async () => {
    sessionStorage.setItem('letterboxdStats', JSON.stringify(STATS));
    render(<StoryPage />);
    expect(await screen.findByText('@semihmutsuz')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Pause story'));
    expect(screen.getByLabelText('Resume story')).toBeInTheDocument();
    expect(screen.getByText('@semihmutsuz')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Resume story'));
    expect(screen.getByLabelText('Pause story')).toBeInTheDocument();
  });
});

describe('buildSlides', () => {
  it('omits the review-personality slide when review_analysis has no reviews', () => {
    const slides = buildSlides(STATS as unknown as StatsData);
    expect(slides.some((s) => s.key === 'review-personality')).toBe(false);
  });

  it('includes the review-personality slide, gems beat included, when reviews are present', () => {
    const stats = {
      ...STATS,
      review_analysis: {
        total_words_written: 500,
        reviews: [
          { title: 'Aftersun', text: 'short actual text', text_length: 5000, likes: 3 },
          { title: 'Memories of Underdevelopment', text: 'a much longer review body by actual character count', text_length: 10, likes: 0 },
        ],
      },
    };
    const slides = buildSlides(stats as unknown as StatsData);
    const reviewSlide = slides.find((s) => s.key === 'review-personality');
    expect(reviewSlide).toBeDefined();
    render(<>{reviewSlide!.body}</>);
    expect(screen.getByText('Memories of Underdevelopment')).toBeInTheDocument();
    expect(screen.getByText(/0 likes, but it had conviction/i)).toBeInTheDocument();
  });
});
