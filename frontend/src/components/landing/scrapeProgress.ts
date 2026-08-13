import type { MessageKey } from '@/i18n/catalogs';
import type { ScrapeTraceEvent } from '@/lib/api';

const DIARY_PAGE_SIZE = 50;
const GRID_PAGE_SIZE = 72;

export type ScrapeProgressView = {
  pct: number;
  filmsFound: number;
  labelKey: MessageKey;
};

function metricNumber(metrics: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function metricString(metrics: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metrics?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function hasStage(events: ScrapeTraceEvent[], stage: string): boolean {
  return events.some((event) => event.stage === stage);
}

function countStage(events: ScrapeTraceEvent[], stage: string): number {
  return events.filter((event) => event.stage === stage).length;
}

function lastPage(events: ScrapeTraceEvent[], stage: string): number {
  let page = 0;
  for (const event of events) {
    if (event.stage !== stage) continue;
    page = Math.max(page, metricNumber(event.metrics, 'page') ?? 0);
  }
  return page;
}

function sumMetric(events: ScrapeTraceEvent[], stage: string, key: string): number {
  let total = 0;
  for (const event of events) {
    if (event.stage !== stage) continue;
    total += metricNumber(event.metrics, key) ?? 0;
  }
  return total;
}

function doneOrSum(
  events: ScrapeTraceEvent[],
  pageStage: string,
  doneStage: string,
  key: string,
): number {
  const done = [...events].reverse().find((event) => event.stage === doneStage);
  const fromDone = metricNumber(done?.metrics, key);
  if (fromDone != null) return fromDone;
  return sumMetric(events, pageStage, key);
}

function sourceProgress(
  events: ScrapeTraceEvent[],
  pageStage: string,
  doneStage: string,
  estimatedPages: number,
): number {
  if (hasStage(events, doneStage)) return 1;
  const page = lastPage(events, pageStage);
  if (page <= 0) return 0;
  if (estimatedPages > 0) return Math.min(0.92, page / estimatedPages);
  return Math.min(0.85, 1 - 1 / (1 + page));
}

function analysisPeriod(events: ScrapeTraceEvent[]): string | undefined {
  for (const stage of ['scrape_started', 'worker_received'] as const) {
    for (const event of events) {
      if (event.stage !== stage) continue;
      const period = metricString(event.metrics, 'analysis_period');
      if (period) return period;
    }
  }
  return undefined;
}

function includeGrid(events: ScrapeTraceEvent[]): boolean {
  const sawGrid = hasStage(events, 'grid_page') || hasStage(events, 'grid_done');
  if (sawGrid) return true;
  const period = analysisPeriod(events);
  if (period === 'month' || period === 'year') return false;
  if (hasStage(events, 'scrape_done')) return false;
  return true;
}

function labelKeyFor(events: ScrapeTraceEvent[], grid: boolean): MessageKey {
  if (hasStage(events, 'postback_started') || countStage(events, 'analysis_done') >= 1) {
    return 'landing.loading.almostThere';
  }
  if (hasStage(events, 'analysis_started') || hasStage(events, 'scrape_done')) {
    return 'landing.loading.stage.analysis';
  }
  const diaryOpen = !hasStage(events, 'diary_done') && lastPage(events, 'diary_page') > 0;
  const gridOpen = grid && !hasStage(events, 'grid_done') && lastPage(events, 'grid_page') > 0;
  const reviewsOpen = !hasStage(events, 'reviews_done') && lastPage(events, 'reviews_page') > 0;
  const latestOpen = [...events].reverse().find((event) => {
    if (diaryOpen && event.stage === 'diary_page') return true;
    if (gridOpen && event.stage === 'grid_page') return true;
    if (reviewsOpen && event.stage === 'reviews_page') return true;
    return false;
  });
  if (latestOpen?.stage === 'grid_page') return 'landing.loading.stage.grid';
  if (latestOpen?.stage === 'reviews_page') return 'landing.loading.stage.reviews';
  if (diaryOpen || latestOpen?.stage === 'diary_page') return 'landing.loading.stage.diary';
  if (gridOpen) return 'landing.loading.stage.grid';
  if (reviewsOpen) return 'landing.loading.stage.reviews';
  return 'landing.loading.stage.starting';
}

export function resolveScrapeProgress(
  events: ScrapeTraceEvent[] | undefined,
  queued = false,
): ScrapeProgressView {
  if (queued) {
    return { pct: 4, filmsFound: 0, labelKey: 'landing.loading.queued' };
  }

  const list = events ?? [];
  if (list.length === 0) {
    return { pct: 6, filmsFound: 0, labelKey: 'landing.loading.stage.starting' };
  }

  const grid = includeGrid(list);
  const overviewFilms = (() => {
    const overview = [...list].reverse().find((event) => event.stage === 'overview');
    return metricNumber(overview?.metrics, 'film_count') ?? 0;
  })();
  const diaryEst = overviewFilms > 0 ? Math.max(1, Math.ceil(overviewFilms / DIARY_PAGE_SIZE)) : 0;
  const gridEst = overviewFilms > 0 ? Math.max(1, Math.ceil(overviewFilms / GRID_PAGE_SIZE)) : 0;

  const diary = sourceProgress(list, 'diary_page', 'diary_done', diaryEst);
  const gridPct = grid ? sourceProgress(list, 'grid_page', 'grid_done', gridEst) : 1;
  const reviews = sourceProgress(list, 'reviews_page', 'reviews_done', 0);
  const overview = hasStage(list, 'overview') ? 1 : 0;

  const diaryW = grid ? 0.35 : 0.55;
  const gridW = grid ? 0.35 : 0;
  const scrapeFrac = overview * 0.05 + diary * diaryW + gridPct * gridW + reviews * 0.25;

  const analysisStarts = countStage(list, 'analysis_started');
  const analysisDones = countStage(list, 'analysis_done');
  let pct: number;
  if (hasStage(list, 'postback_started')) pct = 98;
  else if (analysisDones >= 2) pct = 96;
  else if (analysisDones === 1 && analysisStarts >= 2) pct = 92;
  else if (analysisDones === 1) pct = 90;
  else if (analysisStarts >= 1) pct = 84;
  else if (hasStage(list, 'scrape_done')) pct = 80;
  else pct = 8 + scrapeFrac * 70;

  const analysisFilms = metricNumber(
    [...list].reverse().find((event) => event.stage === 'analysis_started')?.metrics,
    'films',
  ) ?? 0;
  const scrapeFilms = metricNumber(
    [...list].reverse().find((event) => event.stage === 'scrape_done')?.metrics,
    'film_count',
  ) ?? 0;
  const filmsFound =
    analysisFilms ||
    scrapeFilms ||
    Math.max(
      doneOrSum(list, 'diary_page', 'diary_done', 'films'),
      doneOrSum(list, 'grid_page', 'grid_done', 'films'),
    );

  return {
    pct: Math.round(Math.min(98, Math.max(4, pct))),
    filmsFound,
    labelKey: labelKeyFor(list, grid),
  };
}
