import { describe, expect, it, vi, afterEach } from 'vitest';

import { isWorkerFleetEmpty } from './api';

describe('isWorkerFleetEmpty', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns true when the health endpoint reports zero workers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workers: [], queue_depth: 0, oldest_queued_age_seconds: 0 }),
    }));

    expect(await isWorkerFleetEmpty()).toBe(true);
  });

  it('returns false when at least one worker is online', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ workers: [{ worker_id: 'desktop-pc', status: 'online' }] }),
    }));

    expect(await isWorkerFleetEmpty()).toBe(false);
  });

  it('returns false when the endpoint is unreachable (no error thrown)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    expect(await isWorkerFleetEmpty()).toBe(false);
  });

  it('returns false when the endpoint answers non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    expect(await isWorkerFleetEmpty()).toBe(false);
  });

  it('returns false when workers is missing or not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ queue_depth: 2 }),
    }));

    expect(await isWorkerFleetEmpty()).toBe(false);
  });
});
