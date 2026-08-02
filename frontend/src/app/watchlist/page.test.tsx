import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import WatchlistPage from './page';

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));

describe('WatchlistPage independent profiles', () => {
  it('keeps Compare and Date Night username inputs independent', async () => {
    render(<WatchlistPage />);
    const compareFirst = screen.getByLabelText('First watchlist');
    const dateFirst = screen.getByLabelText('First Letterboxd username');

    await userEvent.type(compareFirst, 'semih');
    expect(dateFirst).toHaveValue('');
    await userEvent.type(dateFirst, 'mutsuz');
    expect(compareFirst).toHaveValue('semih');
    expect(dateFirst).toHaveValue('mutsuz');
  });
});
