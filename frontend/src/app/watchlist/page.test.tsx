import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import WatchlistPage from './page';
import { I18nProvider } from '@/i18n/I18nProvider';

vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));

describe('WatchlistPage independent profiles', () => {
  it('keeps Compare and Date Night username inputs independent', async () => {
    render(<I18nProvider locale="en"><WatchlistPage /></I18nProvider>);
    const compareFirst = screen.getByLabelText('First watchlist');
    const dateFirst = screen.getByLabelText('First Letterboxd username');

    await userEvent.type(compareFirst, 'semih');
    expect(dateFirst).toHaveValue('');
    await userEvent.type(dateFirst, 'mutsuz');
    expect(compareFirst).toHaveValue('semih');
    expect(dateFirst).toHaveValue('mutsuz');
  });
});
