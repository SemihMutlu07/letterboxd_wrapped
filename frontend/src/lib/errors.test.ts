import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('normalizeError desktop worker offline', () => {
  it('maps desktop_worker_offline from error code', () => {
    const err = Object.assign(new Error('temporary failure'), { code: 'desktop_worker_offline' });
    const normalized = normalizeError(err);

    expect(normalized.reason).toBe('desktop_worker_offline');
    expect(normalized.title).toBe('Desktop scraper offline');
  });

  it('maps desktop_worker_offline from backend message', () => {
    const normalized = normalizeError('The desktop scraper is offline right now.');

    expect(normalized.reason).toBe('desktop_worker_offline');
  });
});
