import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ResultsLayout from './results/layout';
import WatchlistLayout from './watchlist/layout';

vi.mock('@/components/AppHeader', () => ({
  default: () => <header data-testid="app-header">Movies Wrapped navigation</header>,
}));

function expectHeaderAround(Layout: ({ children }: { children: ReactNode }) => ReactNode) {
  render(
    <Layout>
      <main>Page content</main>
    </Layout>,
  );

  expect(screen.getByTestId('app-header')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveTextContent('Page content');
}

describe('shared surface navigation', () => {
  it('wraps results pages with the app header', () => {
    expectHeaderAround(ResultsLayout);
  });

  it('wraps watchlist pages with the app header', () => {
    expectHeaderAround(WatchlistLayout);
  });
});
