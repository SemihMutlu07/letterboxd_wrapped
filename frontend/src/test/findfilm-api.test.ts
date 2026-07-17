import { afterEach, describe, expect, it, vi } from 'vitest';
import { findFilm } from '@/lib/api';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const findFilmResult = {
  status: 'success' as const,
  users: ['one', 'two', 'three'],
  counts: { per_user: { one: 3, two: 3, three: 3 }, intersection: 2, watched_removed: 1, candidates: 1, returned: 1, truncated: false },
  films: [{ title: 'Dune', year: '2021', slug: 'dune', poster_path: '/dune.jpg', popularity: 50 }],
};

afterEach(() => vi.restoreAllMocks());

describe('findFilm API', () => {
  it('polls a 202 response until done and sends all usernames', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(202, { task_id: 'job-1', poll_token: 'poll-secret' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'done', result: findFilmResult }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(findFilm(['one', 'two', 'three'])).resolves.toEqual(findFilmResult);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ usernames: ['one', 'two', 'three'] });
    expect(fetchMock.mock.calls[1][1].headers['X-Task-Token']).toBe('poll-secret');
  });

  it('preserves a failed poll error_code on the thrown Error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(202, { task_id: 'job-1', poll_token: 'poll-secret' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        status: 'failed',
        error: 'TMDB finalization failed',
        error_code: 'find_film_processing_failed',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await findFilm(['one', 'two']).catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.error_code).toBe('find_film_processing_failed');
  });

  it('surfaces a rejected request error_code (e.g. duplicate_username)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, {
      detail: { error_code: 'duplicate_username', message: 'Enter at least two different Letterboxd usernames.' },
    })));

    const error = await findFilm(['one', 'one']).catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('duplicate_username');
  });
});
