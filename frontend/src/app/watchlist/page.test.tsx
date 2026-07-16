import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import WatchlistPage from './page';

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));

describe('WatchlistPage shared profiles', () => {
  it('keeps Compare and Date Night on one username pair', async () => {
    render(<WatchlistPage />);
    const compareFirst = screen.getByLabelText('First watchlist');
    const dateFirst = screen.getByLabelText('First Letterboxd username');

    await userEvent.type(compareFirst, 'semih');
    expect(dateFirst).toHaveValue('semih');
    await userEvent.type(dateFirst, 'mutsuz');
    expect(compareFirst).toHaveValue('semihmutsuz');
  });
});
