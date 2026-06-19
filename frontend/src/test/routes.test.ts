import { describe, expect, it } from 'vitest';

import {
  cleanRouteUsername,
  isValidRouteUsername,
  resultPath,
  watchlistPath,
} from '@/lib/routes';

describe('route helpers', () => {
  it('normalizes and validates usernames', () => {
    expect(cleanRouteUsername('@SemihMutsuz')).toBe('semihmutsuz');
    expect(isValidRouteUsername('semihmutsuz')).toBe(true);
    expect(isValidRouteUsername('semih-mutsuz')).toBe(false);
  });

  it('builds canonical result routes', () => {
    expect(resultPath('semihmutsuz')).toBe('/results?u=semihmutsuz');
    expect(resultPath('bad-name')).toBe('/results');
  });

  it('builds canonical watchlist routes', () => {
    expect(watchlistPath('alice', 'bob')).toBe('/watchlist?a=alice&b=bob');
    expect(watchlistPath('alice', 'alice')).toBe('/watchlist');
  });
});
