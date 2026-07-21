import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SmtPage from './page';
import { loadSmtFixture } from '@/lib/smt-loader';

describe('/smt dev loader', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('seeds the real results storage contract from the fixture endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        username: 'semihmutsuz',
        summary: { details: { total_films: 692 } },
      }),
    }));
    const navigate = vi.fn();
    await loadSmtFixture(fetch, sessionStorage, navigate);

    expect(sessionStorage.getItem('letterboxdStats')).toBe('{"total_films":692}');
    expect(sessionStorage.getItem('username')).toBe('semihmutsuz');
    expect(sessionStorage.getItem('lb_username')).toBe('semihmutsuz');
    expect(navigate).toHaveBeenCalledWith('/results?u=semihmutsuz');
    expect(fetch).toHaveBeenCalledWith('/.dev/smt-fixture.json', { cache: 'no-store' });
  });

  it('shows a readable error without redirecting when fixture loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Fixture missing' }),
    }));

    render(<SmtPage />);

    expect(await screen.findByText('Fixture missing')).toBeInTheDocument();
    expect(sessionStorage.getItem('letterboxdStats')).toBeNull();
  });
});
