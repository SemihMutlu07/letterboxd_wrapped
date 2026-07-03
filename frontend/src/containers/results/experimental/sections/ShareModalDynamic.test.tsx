import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsContent } from '../../../../app/results/page';
import { ThemeProvider } from '@/lib/theme';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/analytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  return {
    ...actual,
    trackEvent: vi.fn(),
    trackConsentedEvent: vi.fn(),
    getTmdbImageUrl: (path: string | null | undefined) => (path ? `http://localhost:8000${path}` : null),
  };
});

vi.mock('@/components/ShareModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="share-modal"><button onClick={onClose}>Close share</button></div> : null,
}));

const baseProps = {
  stats: {
    total_films: 50,
    average_rating: 3.5,
    top_directors: [],
    top_actors: [],
    top_genres: [],
    top_countries: [],
    top_languages: [],
    decades: [],
    rating_distribution: {},
    favorite_decade: { name: '2020s', count: 10 },
    all_films: [],
  },
  sessionId: 'session-1',
  username: 'testuser',
  dateRangeText: 'Analysed over the past year',
  timePct: '5%',
  runtimeHours: 120,
  decadeData: [],
  decadeMax: 10,
  isMobile: false,
  ratingsArr: [],
  ratingMax: 10,
  quickMetrics: {},
  cineScore: 60,
  shareCardData: {
    onScreenCrush: { name: 'Actor One', headshotUrl: '', count: 4 },
    favoriteDirector: { name: 'Director One', headshotUrl: '', count: 5 },
    watchedFilms: 50,
    spentDays: 5,
    spentHours: 120,
    timePercent: 5,
    cinemaScale: 60,
    personaLabel: 'Archivist',
    minutesAverage: 108,
    mostCommonRating: 3.5,
    peakDecade: '2020s',
    peakDecadeCount: 10,
  },
  orientation: 'vertical' as const,
  setOrientation: () => {},
  hasTriggeredFeedback: false,
  setHasTriggeredFeedback: () => {},
  feedbackRef: { current: null },
};

describe('ResultsPage ShareModal dynamic loading', () => {
  it('does not render ShareModal until triggered and opens on share button click', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <ThemeProvider>
          <ResultsContent {...baseProps} showShareModal={open} setShowShareModal={setOpen} />
        </ThemeProvider>
      );
    }

    render(<Harness />);
    expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /share your wrapped/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId('share-modal')).toBeInTheDocument();
    });
  });
});
