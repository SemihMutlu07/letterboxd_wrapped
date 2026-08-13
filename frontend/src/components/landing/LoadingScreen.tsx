'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PosterGuessGame, type PosterGameProps } from '@/components/landing/PosterGuessGame';
import { resolveScrapeProgress } from '@/components/landing/scrapeProgress';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/catalogs';

function formatElapsed(seconds: number, t: (key: MessageKey) => string): string {
  if (seconds < 60) return t('landing.loading.seconds').replace('{value}', String(seconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return t('landing.loading.minutesSeconds').replace('{minutes}', String(m)).replace('{seconds}', String(s));
}

type Props = {
  title?: string;
  message?: string;
  detail?: string;
  onCancel?: () => void;
  mode?: 'upload' | 'scrape';
  estimatedFilms?: number;
  /** Typical total duration in seconds (hardcoded or from historical data). */
  typicalSeconds?: number;
  /** Live scrape trace events from /api/progress — real discovery feed. */
  events?: { stage?: string; message?: string; metrics?: Record<string, unknown>; elapsed_seconds?: number }[];
  /** Pixelated poster guessing game, shown while scraping. */
  posterGame?: PosterGameProps | null;
  /** Legacy transition signal. LoadingScreen intentionally never exposes navigation. */
  resultReady?: string | null;
  /** Worker fleet is empty (degraded): the job is queued but may take longer. */
  queued?: boolean;
};

const FUN_MESSAGE_KEYS = [
  'landing.loading.fun.1', 'landing.loading.fun.2', 'landing.loading.fun.3', 'landing.loading.fun.4',
  'landing.loading.fun.5', 'landing.loading.fun.6', 'landing.loading.fun.7', 'landing.loading.fun.8',
  'landing.loading.fun.9', 'landing.loading.fun.10', 'landing.loading.fun.11', 'landing.loading.fun.12',
  'landing.loading.fun.13', 'landing.loading.fun.14', 'landing.loading.fun.15', 'landing.loading.fun.16',
  'landing.loading.fun.17', 'landing.loading.fun.18', 'landing.loading.fun.19', 'landing.loading.fun.20',
  'landing.loading.fun.21', 'landing.loading.fun.22', 'landing.loading.fun.23', 'landing.loading.fun.24',
] as const satisfies readonly MessageKey[];

export default function LoadingScreen({
  title,
  message,
  onCancel,
  mode = 'upload',
  estimatedFilms,
  typicalSeconds,
  events,
  posterGame,
  queued,
}: Props) {
  const { t, formatNumber } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const [funMessageIndex, setFunMessageIndex] = useState(0);
  const isScrape = mode === 'scrape';

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isScrape) return;
    const interval = setInterval(() => {
      setFunMessageIndex((i) => (i + 1) % FUN_MESSAGE_KEYS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isScrape]);

  const scrape = isScrape ? resolveScrapeProgress(events, queued) : null;
  const defaultTypical = isScrape ? 30 : 45;
  const typical = typicalSeconds ?? defaultTypical;
  const remaining = Math.max(0, typical - elapsed);
  const pct = scrape ? scrape.pct : Math.min(100, Math.round((elapsed / typical) * 100));
  const liveFilms = scrape?.filmsFound ?? 0;
  const scrapeSlow = Boolean(scrape && elapsed > 90 && scrape.pct < 90);

  const displayTitle = isScrape ? t('landing.loading.scrape.title') : title ?? t('landing.loading.upload.title');
  const displayMessage = isScrape
    ? estimatedFilms && estimatedFilms > 0
      ? t('landing.loading.scrape.readingFilms').replace('{count}', formatNumber(estimatedFilms))
      : t('landing.loading.scrape.readingProfile')
    : message ?? t('landing.loading.upload.message');
  const displayDetail = isScrape
    ? t('landing.loading.elapsedShort').replace('{time}', formatElapsed(elapsed, t))
    : t('landing.loading.elapsed').replace('{time}', formatElapsed(elapsed, t)).replace('{source}', t('landing.loading.source.exports'));

  return (
    <div className="min-h-dvh overflow-y-auto bg-slate-900 text-white flex flex-col items-center justify-start px-4 py-5 sm:justify-center sm:py-8">
      {/* Keep the rotating prompt in one place, above the loading container. */}
      {isScrape && (
        <div className="mt-1 mb-4 max-w-xl text-center">
          <p
            key={funMessageIndex}
            className="text-lg md:text-xl font-semibold italic leading-snug tracking-tight text-white/80 transition-opacity duration-500"
          >
            {t(FUN_MESSAGE_KEYS[funMessageIndex])}
          </p>
        </div>
      )}

      <div className="relative w-full max-w-xl text-center rounded-3xl border border-slate-700/70 bg-slate-800/55 p-5 md:p-6 backdrop-blur-sm">
        {onCancel && (
          <button
            onClick={onCancel}
            className="group absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white/85 shadow-sm shadow-black/20 transition-all duration-200 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white hover:shadow-rose-500/15 active:scale-[0.96]"
          >
            <X className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
            {t('landing.loading.cancel')}
          </button>
        )}

        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1.5">{displayTitle}</h1>
        {!isScrape && <p className="text-sm text-slate-300 mb-2">{displayMessage}</p>}

        {/* Live film count — one line, pops on every increase */}
        {isScrape && liveFilms > 0 && (
          <p className="mb-2 text-2xl font-black tabular-nums text-orange-300">
            <span key={liveFilms} className="inline-block animate-[score-pop_1.1s_ease-out]">
              {formatNumber(liveFilms)}
            </span>{' '}
            <span className="text-sm font-medium text-slate-400">{t('landing.loading.filmsFound')}</span>
          </p>
        )}

        {/* Status — two lines: elapsed/almost-there, then trouble hint if it's taking a while */}
        <div className="mb-4 space-y-1">
          {queued ? (
            <p className="text-xs text-amber-300/90 animate-pulse">
              {t('landing.loading.queued')}
            </p>
          ) : (
            <>
              <p className="text-xs text-orange-300 font-medium">
                {isScrape && scrape
                  ? t(scrape.labelKey)
                  : remaining <= 0
                    ? t('landing.loading.almostThere')
                    : displayDetail}
              </p>
              {isScrape && <p className="text-xs text-slate-500">{displayDetail}</p>}
              {(isScrape ? scrapeSlow : elapsed > typical) && (
                <p className="text-xs text-amber-300/90 animate-pulse">
                  {t('landing.loading.slow')}
                </p>
              )}
            </>
          )}
        </div>

        {isScrape && posterGame && (
          <div className="mb-5">
            <PosterGuessGame {...posterGame} />
          </div>
        )}

        {/* Progress: scrape follows worker stages; upload still uses a typical-duration clock. */}
        <div className="mt-4 space-y-2">
          {!isScrape && (
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-slate-300">{t('landing.loading.typical')}</span>
              <span className="text-slate-200">{formatElapsed(typical, t)}</span>
            </div>
          )}
          <div
            className="h-2 rounded-full bg-slate-700/80 overflow-hidden"
            role="progressbar"
            aria-label={t('landing.loading.progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {!isScrape && remaining > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{t('landing.loading.remaining')}</span>
              <span className="text-orange-300 font-medium">{formatElapsed(remaining, t)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
