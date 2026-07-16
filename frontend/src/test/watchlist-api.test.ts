import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWatchlists, dateNight } from '@/lib/api';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const compareResult = {
  status: 'success' as const,
  users: ['one', 'two'] as [string, string],
  counts: { first_total: 1, second_total: 1, common: 1, first_only: 0, second_only: 0 },
  match_score: 100,
  common: [],
  first_only: [],
  second_only: [],
};

const dateNightResult = {
  mutual_profile: { top_genres: ['Drama'], top_directors: [], era_overlap: 'modern' },
  recommendations: [],
};

afterEach(() => vi.restoreAllMocks());

describe('watchlist async API compatibility', () => {
  it.each([
    ['compare', compareWatchlists, compareResult],
    ['date night', dateNight, dateNightResult],
  ])('accepts a legacy 200 response for %s', async (_name, call, result) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, result)));
    await expect(call('one', 'two')).resolves.toEqual(result);
  });

  it.each([
    ['compare', compareWatchlists, compareResult],
    ['date night', dateNight, dateNightResult],
  ])('polls a 202 response for %s', async (_name, call, result) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(202, { task_id: 'job-1', poll_token: 'poll-secret' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'done', result }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(call('one', 'two')).resolves.toEqual(result);
    expect(fetchMock.mock.calls[1][1].headers['X-Task-Token']).toBe('poll-secret');
  });

  it('preserves a failed poll error_code on the thrown Error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(202, { task_id: 'job-1', poll_token: 'poll-secret' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        status: 'failed',
        error: 'TMDB finalization failed',
        error_code: 'watchlist_processing_failed',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await compareWatchlists('one', 'two').catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.error_code).toBe('watchlist_processing_failed');
  });
});
