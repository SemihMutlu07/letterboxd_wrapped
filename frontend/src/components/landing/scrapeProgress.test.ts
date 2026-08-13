import { describe, expect, it } from 'vitest';

import type { ScrapeTraceEvent } from '@/lib/api';

import { resolveScrapeProgress } from './scrapeProgress';

function event(stage: string, metrics: Record<string, unknown> = {}): ScrapeTraceEvent {
  return { stage, message: stage, metrics };
}

describe('resolveScrapeProgress', () => {
  it('stays near empty before any worker events', () => {
    expect(resolveScrapeProgress([])).toEqual({
      pct: 6,
      filmsFound: 0,
      labelKey: 'landing.loading.stage.starting',
    });
  });

  it('keeps queued jobs at a low pct and ignores scrape events', () => {
    const view = resolveScrapeProgress([event('diary_page', { page: 4, films: 50 })], true);
    expect(view.pct).toBe(4);
    expect(view.filmsFound).toBe(0);
    expect(view.labelKey).toBe('landing.loading.queued');
  });

  it('advances from diary pages and sums films instead of using one page size', () => {
    const view = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'lifetime' }),
      event('diary_page', { page: 1, films: 50 }),
      event('diary_page', { page: 2, films: 50 }),
    ]);
    expect(view.pct).toBeGreaterThan(6);
    expect(view.pct).toBeLessThan(80);
    expect(view.filmsFound).toBe(100);
    expect(view.labelKey).toBe('landing.loading.stage.diary');
  });

  it('treats diary, grid, and reviews as parallel sources', () => {
    const diaryOnly = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'lifetime' }),
      event('diary_page', { page: 1, films: 50 }),
    ]);
    const diaryAndGrid = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'lifetime' }),
      event('diary_page', { page: 1, films: 50 }),
      event('grid_page', { page: 1, films: 72 }),
    ]);
    expect(diaryAndGrid.pct).toBeGreaterThan(diaryOnly.pct);
    expect(diaryAndGrid.filmsFound).toBe(72);
  });

  it('skips grid weight for a year-period scrape', () => {
    const yearDone = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'year' }),
      event('overview', { film_count: 200 }),
      event('diary_done', { films: 80 }),
      event('reviews_done', { reviews: 12 }),
    ]);
    const lifetimeStuckWithoutGrid = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'lifetime' }),
      event('overview', { film_count: 200 }),
      event('diary_done', { films: 80 }),
      event('reviews_done', { reviews: 12 }),
    ]);
    expect(yearDone.pct).toBeGreaterThan(lifetimeStuckWithoutGrid.pct);
  });

  it('jumps to analysis after scrape_done and never fills the bar', () => {
    const scraped = resolveScrapeProgress([
      event('scrape_started', { analysis_period: 'lifetime' }),
      event('diary_done', { films: 400 }),
      event('grid_done', { films: 700 }),
      event('reviews_done', { reviews: 40 }),
      event('scrape_done', { film_count: 700, scrape_seconds: 41 }),
    ]);
    expect(scraped.pct).toBe(80);
    expect(scraped.labelKey).toBe('landing.loading.stage.analysis');
    expect(scraped.filmsFound).toBe(700);

    const analyzed = resolveScrapeProgress([
      event('scrape_done', { film_count: 700 }),
      event('analysis_started', { films: 680 }),
      event('analysis_done', { analysis_seconds: 12 }),
      event('postback_started'),
    ]);
    expect(analyzed.pct).toBe(98);
    expect(analyzed.pct).toBeLessThan(100);
    expect(analyzed.labelKey).toBe('landing.loading.almostThere');
    expect(analyzed.filmsFound).toBe(680);
  });
});
