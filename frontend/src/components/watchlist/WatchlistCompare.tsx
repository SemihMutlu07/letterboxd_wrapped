'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clapperboard, Layers, List, Shuffle, Sparkles, X } from 'lucide-react';

import {
  compareWatchlists,
  enrichWatchlistFilms,
  recommendFromCompare,
  handleApiError,
  type FilmRecommendation,
  type RecommendationStrategy,
  type WatchlistCompareResult,
  type WatchlistFilm,
} from '@/lib/api';
import { readWatchlistUsersFromLocation, watchlistPath } from '@/lib/routes';
import { pickRandomUsernames } from '@/lib/usernames';
import { PosterPlaceholder } from '@/components/results/Placeholders';
import { getPosterUrl } from '@/lib/analytics';
import SwipeDeck from './SwipeDeck';

const COLLAPSED_FILM_LIMIT = 10;

/* ── Toggle-able loading panel with close button ───────────────────────────── */

function LoadingPanel({
  title,
  message,
  showPosterRail = false,
  onClose,
}: {
  title: string;
  message: string;
  showPosterRail?: boolean;
  onClose?: () => void;
}) {
  return (
    <section className="border border-amber-300/60 bg-[#171411] p-5 relative">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-stone-500 hover:text-stone-200 transition-colors"
          aria-label="Close loading panel"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex items-center gap-4">
            <span className="h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-300" />
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{title}</p>
              <p className="mt-1 text-sm text-stone-400">{message}</p>
            </div>
          </div>
          <div className="mt-4 h-1 overflow-hidden bg-stone-900">
            <div className="h-full w-1/2 animate-pulse bg-amber-300" />
          </div>
        </div>
        {showPosterRail && (
          <div className="flex gap-2">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-24 w-16 border border-amber-300/30 bg-gradient-to-b from-stone-700 via-stone-900 to-amber-950/50"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="h-full w-full animate-pulse bg-amber-200/10" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

const USERNAME_RE = /^[a-z0-9_]+$/;

/* ── Shared film-row renderer (used by both open + accordion) ──────────────── */

function FilmRows({ films }: { films: WatchlistFilm[] }) {
  return (
    <>
      {films.map((film) => {
        const slug = film.slug?.replace(/^\/film\/|\/$/g, '');
        const href = slug ? `https://letterboxd.com/film/${slug}/` : null;
        const posterUrl = getPosterUrl(film.poster_path) || getPosterUrl(film.poster_url);
        const content = (
          <div className="flex items-center gap-3 py-2">
            <div className="relative h-[60px] w-10 shrink-0 overflow-hidden bg-stone-900">
              {posterUrl ? (
                <>
                  <img
                    src={posterUrl}
                    alt={`${film.title} poster`}
                    width={40}
                    height={60}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.style.display = 'none';
                      const sib = el.nextElementSibling as HTMLElement | null;
                      if (sib) sib.style.display = '';
                    }}
                  />
                  <div style={{ display: 'none' }} className="absolute inset-0">
                    <PosterPlaceholder />
                  </div>
                </>
              ) : (
                <PosterPlaceholder />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-stone-100">{film.title}</p>
              <p className="font-mono text-[11px] text-stone-500">{film.year}</p>
            </div>
          </div>
        );
        return (
          <li key={`${film.title}-${film.year}-${film.slug}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block transition-colors duration-150 ease-out hover:bg-stone-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        );
      })}
    </>
  );
}

/* ── Always-open list (used for Common / both watchlists) ──────────────────── */

function FilmListOpen({
  title,
  films,
  totalCount,
  truncated,
  emptyMessage,
}: {
  title: string;
  films: WatchlistFilm[];
  totalCount: number;
  truncated?: boolean;
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, COLLAPSED_FILM_LIMIT);
  const remaining = films.length - visible.length;

  return (
    <section className="border border-stone-800 bg-[#171411] p-4">
      <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300">{title}</h3>
      <ul className="mt-4 divide-y divide-stone-800/80">
        {films.length === 0 && (
          <li className="py-2 text-sm text-stone-500">
            {emptyMessage || 'No films in this bucket.'}
          </li>
        )}
        <FilmRows films={visible} />
      </ul>

      {(films.length > COLLAPSED_FILM_LIMIT || (truncated && films.length > 0)) && (
        <div className="mt-3 space-y-2">
          {films.length > COLLAPSED_FILM_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border border-stone-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-stone-300 transition-colors duration-150 ease-out hover:border-stone-500 hover:text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              {expanded ? `Hide ${films.length - COLLAPSED_FILM_LIMIT}` : `Show ${remaining} more`}
            </button>
          )}
          {truncated && (
            <p className="font-mono text-[11px] text-stone-500">
              Showing {films.length} of {totalCount}. Backend caps each bucket at {films.length}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Accordion list (used for individual watchlists) ───────────────────────── */

function WatchlistAccordion({
  user,
  count,
  films,
}: {
  user: string;
  count: number;
  films: WatchlistFilm[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, COLLAPSED_FILM_LIMIT);
  const remaining = films.length - visible.length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between border border-stone-700 bg-[#171411] px-4 py-3 text-left transition-colors duration-150 ease-out hover:border-stone-500 hover:bg-[#1e1a14]"
      >
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-stone-300">
          Only @{user} <span className="ml-1 text-amber-300">({count})</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" />
      </button>
    );
  }

  return (
    <section className="border border-stone-800 bg-[#171411] p-4">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
          Only @{user} <span className="text-stone-400">({count})</span>
        </h3>
        <ChevronUp className="h-4 w-4 shrink-0 text-stone-500" />
      </button>

      <ul className="divide-y divide-stone-800/80">
        <FilmRows films={visible} />
      </ul>

      {films.length > COLLAPSED_FILM_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full border border-stone-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-stone-300 transition-colors duration-150 ease-out hover:border-stone-500 hover:text-stone-100"
        >
          {expanded ? `Hide ${films.length - COLLAPSED_FILM_LIMIT}` : `Show ${remaining} more`}
        </button>
      )}
    </section>
  );
}

/* ── Recommendation strip ──────────────────────────────────────────────────── */

function RecommendationStrip({ recommendation }: { recommendation: FilmRecommendation }) {
  return (
    <div className="border border-amber-400/40 bg-amber-300 p-4 text-stone-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Tonight's pick</p>
          <p className="mt-1 text-2xl font-black leading-tight">{recommendation.title}</p>
          <p className="mt-1 font-mono text-xs text-stone-700">{recommendation.year}</p>
        </div>
        <Sparkles className="h-6 w-6 shrink-0" />
      </div>
      <p className="mt-3 text-sm font-medium text-stone-800">{recommendation.reason}</p>
    </div>
  );
}

/* ── Main exported component ───────────────────────────────────────────────── */

export default function WatchlistCompare() {
  const placeholders = useMemo(() => pickRandomUsernames(2), []);
  const [first, setFirst] = useState(() => {
    const [routeFirst] = readWatchlistUsersFromLocation();
    if (routeFirst) return routeFirst;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('wc_first') || '';
  });
  const [second, setSecond] = useState(() => {
    const [, routeSecond] = readWatchlistUsersFromLocation();
    if (routeSecond) return routeSecond;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('wc_second') || '';
  });
  const [strategy, setStrategy] = useState<RecommendationStrategy>('random');
  const [result, setResult] = useState<WatchlistCompareResult | null>(null);
  const [recommendation, setRecommendation] = useState<FilmRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissLoading, setDismissLoading] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'swipe'>('list');
  const [enrichedFilms, setEnrichedFilms] = useState<WatchlistFilm[] | null>(null);
  const [enriching, setEnriching] = useState(false);
  const autoComparedRef = useRef(false);

  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const validationMessage = useMemo(() => {
    const filled = normalized.filter(Boolean);
    if (filled.some((username) => !USERNAME_RE.test(username))) {
      return 'Use only lowercase letters, numbers, or underscores for Letterboxd usernames.';
    }
    if (normalized[0] && normalized[1] && normalized[0] === normalized[1]) {
      return 'Enter two different Letterboxd usernames.';
    }
    return null;
  }, [normalized]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && !validationMessage;

  // Persist inputs so users don't re-type after error / refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wc_first', first);
    }
  }, [first]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wc_second', second);
    }
  }, [second]);

  const handleCompare = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setDismissLoading(false);
    setError(null);
    try {
      const next = await compareWatchlists(normalized[0], normalized[1]);
      setResult(next);
      setRecommendation(null);
      const nextPath = watchlistPath(normalized[0], normalized[1]);
      if (typeof window !== 'undefined' && `${window.location.pathname}${window.location.search}` !== nextPath) {
        window.history.pushState(null, '', nextPath);
      }
    } catch (err) {
      setError(handleApiError(err, 'watchlist comparison').message);
    } finally {
      setLoading(false);
    }
  }, [canSubmit, normalized]);

  useEffect(() => {
    const [routeFirst, routeSecond] = readWatchlistUsersFromLocation();
    if (!routeFirst || !routeSecond || autoComparedRef.current) return;
    autoComparedRef.current = true;
    void handleCompare();
  }, [handleCompare]);

  const handleRecommend = async () => {
    if (!canSubmit) return;
    setRecommending(true);
    setError(null);
    try {
      const next = await recommendFromCompare(normalized[0], normalized[1], strategy);
      setRecommendation(next.recommendation);
    } catch (err) {
      setError(handleApiError(err, 'recommendation').message);
    } finally {
      setRecommending(false);
    }
  };

  const handleSwitchToSwipe = async () => {
    setViewMode('swipe');
    if (enrichedFilms !== null || !result) return;
    setEnriching(true);
    setError(null);
    try {
      const res = await enrichWatchlistFilms(normalized[0], normalized[1]);
      setEnrichedFilms(res.films);
    } catch (err) {
      setError(handleApiError(err, 'watchlist enrichment').message);
    } finally {
      setEnriching(false);
    }
  };

  const counts = result?.counts;
  const barTotal = counts ? Math.max(counts.first_only + counts.common + counts.second_only, 1) : 1;
  const formatPct = (n: number) => `${Math.round((n / barTotal) * 100)}%`;

  return (
    <div className="space-y-8">
      <section className="border border-stone-800 bg-[#201b16] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">First watchlist</span>
            <input
              value={first}
              onChange={(event) => setFirst(event.target.value)}
              placeholder={placeholders[0]}
              className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 transition-colors duration-150 ease-out focus:border-amber-400 focus:outline-none focus-visible:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-stone-500">Second watchlist</span>
            <input
              value={second}
              onChange={(event) => setSecond(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleCompare();
              }}
              placeholder={placeholders[1]}
              className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 transition-colors duration-150 ease-out focus:border-amber-400 focus:outline-none focus-visible:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCompare()}
            disabled={!canSubmit || loading}
            className="mt-6 inline-flex h-[46px] items-center justify-center gap-2 bg-amber-300 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-amber-200 active:scale-[0.97] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:bg-stone-800 disabled:text-stone-500 disabled:active:scale-100 disabled:active:opacity-100"
          >
            <Clapperboard className="h-4 w-4" />
            {loading ? 'Reading' : 'Compare'}
          </button>
        </div>
        {validationMessage && <p className="mt-4 border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{validationMessage}</p>}
        {error && (
          <div className="mt-4 border border-red-900/70 bg-red-950/40 px-4 py-3">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void handleCompare()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 hover:text-red-100 transition-colors"
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}
      </section>

      {loading && !dismissLoading && (
        <LoadingPanel
          title="Comparing watchlists"
          message="Reading both public watchlists and sorting the shared shelf from the one-sided picks."
          onClose={() => setDismissLoading(true)}
        />
      )}

      {result && (
        <>
          {/* Match score header */}
          <section className="border border-amber-400/40 bg-[#0f0d0b] p-5 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Match score</p>
            <p className="mt-2 text-7xl font-black leading-none text-stone-50">{result.match_score}%</p>
            <p className="mt-2 text-sm text-stone-400">
              <span className="font-semibold text-orange-400">@{result.users[0]}</span>
              <span className="mx-1.5 text-stone-600">vs</span>
              <span className="font-semibold text-emerald-400">@{result.users[1]}</span>
            </p>
          </section>

          {/* Responsive summary cards */}
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="border border-orange-500/30 bg-[#171411] p-2 sm:p-4 text-center min-w-0">
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] text-orange-400 truncate">
                Only @{result.users[0]}
              </p>
              <p className="mt-1 text-lg sm:text-2xl font-black text-stone-100 leading-none">{counts?.first_only ?? 0}</p>
            </div>
            <div className="border border-amber-300/40 bg-[#171411] p-2 sm:p-4 text-center min-w-0">
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] text-amber-300">
                Both
              </p>
              <p className="mt-1 text-lg sm:text-2xl font-black text-stone-100 leading-none">{counts?.common ?? 0}</p>
            </div>
            <div className="border border-emerald-500/30 bg-[#171411] p-2 sm:p-4 text-center min-w-0">
              <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-[0.12em] text-emerald-400 truncate">
                Only @{result.users[1]}
              </p>
              <p className="mt-1 text-lg sm:text-2xl font-black text-stone-100 leading-none">{counts?.second_only ?? 0}</p>
            </div>
          </section>

          {/* Proportional bar */}
          <section className="border border-stone-800 bg-[#171411] p-5">
            <div className="flex w-full gap-0.5">
              {counts && (
                <>
                  <div
                    style={{ flex: counts.first_only || 1 }}
                    className="group relative h-12 bg-orange-500/80"
                    title={`Only @${result.users[0]}: ${counts.first_only} (${formatPct(counts.first_only)})`}
                  >
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatPct(counts.first_only)}
                    </span>
                  </div>
                  <div
                    style={{ flex: counts.common || 1 }}
                    className="group relative h-12 bg-amber-300"
                    title={`Both: ${counts.common} (${formatPct(counts.common)})`}
                  >
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-stone-950 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatPct(counts.common)}
                    </span>
                  </div>
                  <div
                    style={{ flex: counts.second_only || 1 }}
                    className="group relative h-12 bg-emerald-500/80"
                    title={`Only @${result.users[1]}: ${counts.second_only} (${formatPct(counts.second_only)})`}
                  >
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatPct(counts.second_only)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] uppercase tracking-[0.12em]">
              <span className="text-orange-400/90 text-center">Only @{result.users[0]}: {counts?.first_only}</span>
              <span className="text-amber-300 text-center">Both: {counts?.common}</span>
              <span className="text-emerald-400/90 text-center">Only @{result.users[1]}: {counts?.second_only}</span>
            </div>
          </section>

          {/* View mode toggle */}
          {result.counts.common > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  viewMode === 'list'
                    ? 'border-amber-300 bg-amber-300 text-stone-950'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-100'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={handleSwitchToSwipe}
                className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  viewMode === 'swipe'
                    ? 'border-amber-300 bg-amber-300 text-stone-950'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-100'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Swipe
              </button>
            </div>
          )}

          {/* Common shelf — list view */}
          {viewMode === 'list' && (
            <FilmListOpen
              title="Shared shelf"
              films={result.common}
              totalCount={result.counts.common}
              emptyMessage="Zero shared films in both watchlists."
            />
          )}

          {/* Swipe deck — alternate view */}
          {viewMode === 'swipe' && (
            enriching ? (
              <section className="border border-stone-800 bg-[#171411] p-8 text-center">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-300" />
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-stone-400">Enriching films with TMDB data…</p>
              </section>
            ) : enrichedFilms ? (
              <SwipeDeck films={enrichedFilms} />
            ) : null
          )}

          {/* Individual watchlists — collapsed by default */}
          <div className="grid grid-cols-1 gap-3">
            <WatchlistAccordion
              user={result.users[0]}
              count={result.counts.first_only}
              films={result.first_only}
            />
            <WatchlistAccordion
              user={result.users[1]}
              count={result.counts.second_only}
              films={result.second_only}
            />
          </div>

          {result.counts.common === 0 && (
            <section className="border border-stone-800 bg-[#171411] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">No overlap yet</p>
              <p className="mt-2 text-sm text-stone-400">
                Zero shared films. Expand individual watchlists above to see what each person wants to watch.
              </p>
            </section>
          )}

          <section className="grid gap-4 border border-stone-800 bg-[#201b16] p-5 md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">What should we watch?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['random', 'highest_rated', 'newest'] as RecommendationStrategy[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStrategy(item)}
                    className={`border px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-150 ease-out active:scale-[0.97] active:opacity-90 ${
                      strategy === item ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-100'
                    }`}
                  >
                    {item.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleRecommend()}
              disabled={recommending || result.counts.common === 0}
              className="inline-flex h-[46px] items-center justify-center gap-2 bg-stone-100 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition-colors duration-150 ease-out hover:bg-white active:scale-[0.97] active:opacity-90 disabled:bg-stone-800 disabled:text-stone-500 disabled:active:scale-100 disabled:active:opacity-100"
            >
              <Shuffle className="h-4 w-4" />
              {recommending ? 'Choosing' : 'Pick one'}
            </button>
          </section>

          {recommendation && <RecommendationStrip recommendation={recommendation} />}
        </>
      )}

      {recommending && (
        <LoadingPanel
          title="Choosing from the overlap"
          message="Enriching shared watchlist films with TMDB data before picking one."
          showPosterRail
          onClose={() => {/* recommending state is handled by the async call, can't be dismissed mid-flight */}}
        />
      )}
    </div>
  );
}
