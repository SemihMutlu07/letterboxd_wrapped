import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// desktop_server branch: RSS-first preview is SUSPENDED. The username "Analyze"
// flow must call scrapeProfile() directly (full scrape via the desktop worker)
// and must NOT touch rssPreview().

vi.mock('@/lib/api', () => ({
  analyzeFiles: vi.fn(),
  parseLetterboxdUsername: vi.fn(async () => ({ username: null })),
  rssPreview: vi.fn(),
  scrapeProfile: vi.fn(),
  testBackend: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/lib/supabase/analysis_runs', () => ({
  startAnalysis: vi.fn(async () => ({ id: 'run-1' })),
  finishAnalysis: vi.fn(async () => {}),
  buildSummaryForPersistence: vi.fn(() => ({})),
}));
vi.mock('@/lib/supabase/sessions', () => ({ upsertUserSession: vi.fn(async () => {}) }));
vi.mock('@/lib/session-id', () => ({
  ensureSessionId: vi.fn(() => 'sess-1'),
  getUsername: vi.fn(() => null),
  setUsername: vi.fn(),
  getConsent: vi.fn(() => 'decline'),
}));
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  trackConsentedEvent: vi.fn(),
  trackFilmStats: vi.fn(),
}));
vi.mock('@/lib/errors', () => ({
  normalizeError: (e: unknown) => ({ title: 'err', message: String(e), reason: 'rss_failed' }),
}));
vi.mock('@/components/landing/LoadingScreen', () => ({ default: () => null }));
vi.mock('@/components/landing/UploadZone', () => ({ default: () => null }));
vi.mock('@/components/landing/ExportInstructions', () => ({ default: () => null }));
vi.mock('@/components/ErrorBanner', () => ({ default: () => null }));

import LetterboxdLanding from '@/components/LetterboxdLanding';
import { rssPreview, scrapeProfile } from '@/lib/api';

async function analyzeUsername(name: string) {
  render(<LetterboxdLanding />);
  await userEvent.type(screen.getByPlaceholderText('your_username'), name);
  await userEvent.click(screen.getByRole('button', { name: /analyze/i }));
}

describe('LetterboxdLanding direct-scrape flow (RSS suspended)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('scrapes the full profile directly and stores its stats', async () => {
    vi.mocked(scrapeProfile).mockResolvedValueOnce({
      status: 'success',
      stats: { total_films: 394, scraped_username: 'semihmutsuz' },
    });

    await analyzeUsername('semihmutsuz');

    await waitFor(() => expect(scrapeProfile).toHaveBeenCalledWith('semihmutsuz', undefined, expect.any(Function)));
    expect(sessionStorage.getItem('letterboxdStats')).toContain('"total_films":394');
  });

  it('never calls the suspended rssPreview path', async () => {
    vi.mocked(scrapeProfile).mockResolvedValueOnce({
      status: 'success',
      stats: { total_films: 394, scraped_username: 'semihmutsuz' },
    });

    await analyzeUsername('semihmutsuz');

    await waitFor(() => expect(scrapeProfile).toHaveBeenCalled());
    expect(rssPreview).not.toHaveBeenCalled();
  });
});
