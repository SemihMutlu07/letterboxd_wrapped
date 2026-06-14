import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrapeProfile } from '@/lib/api';

// scrapeProfile() must transparently support both backend contracts:
//   - synchronous { status, stats } (local / no desktop worker)
//   - desktop-worker 202 { task_id } → poll /api/progress until done
// and surface the desktop_worker_offline guidance message on a 503.

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scrapeProfile', () => {
  it('handles the legacy synchronous { status, stats } response', async () => {
    const stats = { total_films: 394, scraped_username: 'semihmutsuz' };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { status: 'success', stats })));

    const result = await scrapeProfile('semihmutsuz');
    expect(result.stats.total_films).toBe(394);
  });

  it('handles a 202 { task_id } by polling /api/progress until done', async () => {
    const stats = { total_films: 1066, scraped_username: 'semihmutsuz' };
    const fetchMock = vi
      .fn()
      // 1st call: POST /api/scrape-profile → queued
      .mockResolvedValueOnce(jsonResponse(202, { task_id: 'job-1', status: 'pending' }))
      // 2nd call: GET /api/progress/job-1 → done
      .mockResolvedValueOnce(jsonResponse(200, { status: 'done', result: { status: 'success', stats } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await scrapeProfile('semihmutsuz');
    expect(result.stats.total_films).toBe(1066);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/progress/job-1');
  });

  it('surfaces the desktop_worker_offline guidance on a 503', async () => {
    const message = 'The desktop scraper is offline right now. Upload your Letterboxd export for a full Wrapped, or try again shortly.';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(503, { detail: { error_code: 'desktop_worker_offline', message } })));

    await expect(scrapeProfile('semihmutsuz')).rejects.toThrow(/desktop scraper is offline/i);
  });
});
