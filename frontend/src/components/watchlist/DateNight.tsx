'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, HeartHandshake, Search } from 'lucide-react';

import { dateNight, handleApiError, type DateNightResult } from '@/lib/api';
import { getPosterUrl } from '@/lib/analytics';
import { pickRandomUsernames } from '@/lib/usernames';

function cleanUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

type Props = {
  first?: string;
  second?: string;
  onFirstChange?: (value: string) => void;
  onSecondChange?: (value: string) => void;
};

export default function DateNight({ first: controlledFirst, second: controlledSecond, onFirstChange, onSecondChange }: Props = {}) {
  const placeholders = useMemo(() => pickRandomUsernames(2), []);
  const [localFirst, setLocalFirst] = useState('');
  const [localSecond, setLocalSecond] = useState('');
  const first = controlledFirst ?? localFirst;
  const second = controlledSecond ?? localSecond;
  const changeFirst = onFirstChange ?? setLocalFirst;
  const changeSecond = onSecondChange ?? setLocalSecond;
  const [result, setResult] = useState<DateNightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroredPosters, setErroredPosters] = useState<Set<string>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);
  const normalized = useMemo(() => [cleanUsername(first), cleanUsername(second)] as const, [first, second]);
  const canSubmit = normalized[0].length > 0 && normalized[1].length > 0 && normalized[0] !== normalized[1];

  useEffect(() => {
    if (!result) return;
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resultRef.current?.focus({ preventScroll: true });
    });
  }, [result]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await dateNight(normalized[0], normalized[1]));
    } catch (err) {
      setError(handleApiError(err, 'date night recommendations').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 border border-stone-800 bg-[#15120f] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center bg-red-900/50 text-red-200">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-stone-100">Date Night Engine</h2>
          <p className="text-sm text-stone-500">Taste-profile recommendations beyond watchlist overlap.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">First profile</span>
          <input
            value={first}
            onChange={(event) => changeFirst(event.target.value)}
            placeholder={placeholders[0]}
            aria-label="First Letterboxd username"
            className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 transition-colors duration-150 ease-out focus:border-red-300 focus:outline-none focus-visible:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Second profile</span>
          <input
            value={second}
            onChange={(event) => changeSecond(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSubmit();
            }}
            placeholder={placeholders[1]}
            aria-label="Second Letterboxd username"
            className="mt-2 w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 transition-colors duration-150 ease-out focus:border-red-300 focus:outline-none focus-visible:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || loading}
          className="mt-6 inline-flex h-[46px] items-center justify-center gap-2 bg-red-200 px-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 transition-[background-color,transform,opacity] duration-150 ease-out hover:bg-red-100 active:scale-[0.97] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200 disabled:bg-stone-800 disabled:text-stone-500 disabled:active:scale-100 disabled:active:opacity-100"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Profiling' : 'Find films'}
        </button>
      </div>

      {error && <p className="border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>}

      {loading && (
        <section className="border border-red-200/50 bg-[#201612] p-4">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-4">
                <span className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-red-100/20 border-t-red-200" />
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-red-200">Building mutual profile</p>
                  <p className="mt-1 text-sm text-stone-400">Scanning both public profiles, finding shared taste signals, then looking for unwatched recommendations.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-24 w-16 border border-red-200/30 bg-gradient-to-b from-stone-700 via-stone-950 to-red-950/50"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="h-full w-full animate-pulse bg-red-100/10" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {result && (
        <div
          ref={resultRef}
          role="region"
          aria-label="Date night results"
          aria-live="polite"
          tabIndex={-1}
          className="space-y-5 outline-none"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Genres</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.top_genres.join(', ') || 'Mixed'}</p>
            </div>
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Directors</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.top_directors.join(', ') || 'No shared auteur yet'}</p>
            </div>
            <div className="border border-stone-800 bg-[#201b16] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Era</p>
              <p className="mt-2 text-sm text-stone-100">{result.mutual_profile.era_overlap}</p>
            </div>
          </div>

          {result.recommendations.length === 0 ? (
            <div className="border border-stone-800 bg-[#201b16] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">No mutual picks</p>
              <p className="mt-2 text-sm text-stone-400">
                Zero overlap between your watchlists — no films on both lists. But you can still check what's on <em>their</em> watchlist by scrolling down.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendations.map((film, index) => {
                const posterUrl = film.poster_path ? getPosterUrl(film.poster_path) : null;
                const director = film.director;
                const overview = film.overview;
                const extra = film as unknown as Record<string, unknown>;
                const watchlistAddedAt = extra.watchlist_added_at as string | undefined;
                const slug = (extra.letterboxd_slug as string) || film.slug;
                const letterboxdUrl = slug
                  ? `https://letterboxd.com/film/${slug}/`
                  : `https://letterboxd.com/search/${encodeURIComponent(film.title)}/`;
                const posterKey = `${film.title}-${film.year}`;
                const imgError = erroredPosters.has(posterKey);

                return (
                  <article
                    key={`${film.title}-${film.year}-${index}`}
                    className="flex gap-4 border border-stone-800 bg-[#201b16] p-4 transition-colors duration-150 ease-out hover:border-stone-600"
                  >
                    <div className="relative h-[120px] w-[80px] shrink-0 overflow-hidden bg-stone-800">
                      {posterUrl && !imgError ? (
                        <img
                          src={posterUrl}
                          alt={`${film.title} poster`}
                          width={80}
                          height={120}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                          onError={() => setErroredPosters(prev => new Set(prev).add(posterKey))}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-600" aria-hidden="true">
                          <ExternalLink className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex flex-col justify-center gap-1">
                      <h3 className="text-base font-black text-stone-100 leading-tight">{film.title}</h3>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-stone-500">
                        <span>{film.year || '—'}</span>
                        <span>·</span>
                        <span>{director || '—'}</span>
                      </div>
                      <p className="text-xs text-stone-600 line-clamp-2">{overview || '—'}</p>
                      <p className="text-xs italic text-stone-400">{film.reason}</p>
                      {watchlistAddedAt && (
                        <span className="text-xs text-stone-500">added {watchlistAddedAt}</span>
                      )}
                      <a
                        href={letterboxdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300 transition-colors duration-150 ease-out hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View on Letterboxd
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
