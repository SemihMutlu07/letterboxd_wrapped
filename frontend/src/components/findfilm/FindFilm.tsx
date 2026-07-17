'use client';

import { Clapperboard, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { findFilm, type FindFilmResult, type ScrapeProgress } from '@/lib/api';
import { getPosterUrl } from '@/lib/analytics';
import { findFilmPath } from '@/lib/routes';
import { PosterPlaceholder } from '@/components/results/Placeholders';

const MAX_USERS = 6;
const USERNAME_RE = /^[a-z0-9_]+$/;

function cleanUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export default function FindFilm({
  users,
  onUsersChange,
  storageKey,
}: {
  users: string[];
  onUsersChange: (users: string[]) => void;
  storageKey: string;
}) {
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<FindFilmResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const validUsers = useMemo(() => {
    const seen: string[] = [];
    for (const value of users.map(cleanUsername)) {
      if (USERNAME_RE.test(value) && !seen.includes(value)) seen.push(value);
    }
    return seen;
  }, [users]);

  const hasDuplicates = useMemo(() => {
    const cleaned = users.map(cleanUsername).filter(Boolean);
    return new Set(cleaned).size !== cleaned.length;
  }, [users]);

  const canSubmit = validUsers.length >= 2 && !hasDuplicates;

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(users));
    } catch {
      // storage unavailable (private mode) — the form still works
    }
    window.history.replaceState(null, '', findFilmPath(users));
  }, [users, storageKey]);

  const setUser = (index: number, value: string) => {
    onUsersChange(users.map((current, i) => (i === index ? value : current)));
  };
  const addUser = () => {
    if (users.length < MAX_USERS) onUsersChange([...users, '']);
  };
  const removeUser = (index: number) => {
    if (users.length > 2) onUsersChange(users.filter((_, i) => i !== index));
  };

  const handleFind = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    setProgressMessage('Queued on the desktop scraper.');
    try {
      const data = await findFilm(validUsers, (progress: ScrapeProgress) => {
        if (progress.message) setProgressMessage(progress.message);
      });
      setResult(data);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const emptyWatchlistUsers = result
    ? Object.entries(result.counts.per_user)
        .filter(([, count]) => count === 0)
        .map(([user]) => user)
    : [];

  return (
    <div className="space-y-8">
      {/* ── Username entry ─────────────────────────────────────────────── */}
      <section className="border border-stone-800 bg-[#14110e] p-5 sm:p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Who is watching?</h2>
        <div className="mt-4 space-y-3">
          {users.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <label className="block flex-1">
                <span className="sr-only">{`Letterboxd username ${index + 1}`}</span>
                <input
                  value={value}
                  onChange={(event) => setUser(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleFind();
                  }}
                  placeholder={`letterboxd username ${index + 1}`}
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full border border-stone-700 bg-[#0f0d0b] px-4 py-3 text-sm text-stone-100 transition-colors duration-150 ease-out focus:border-amber-400 focus:outline-none focus-visible:outline-none"
                />
              </label>
              {users.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeUser(index)}
                  aria-label={`Remove username ${index + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center border border-stone-800 text-stone-500 transition-colors hover:border-red-900 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addUser}
          disabled={users.length >= MAX_USERS}
          className="mt-3 inline-flex items-center gap-1.5 border border-stone-700 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-stone-300 transition hover:border-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add friend
        </button>

        {hasDuplicates && (
          <p className="mt-4 border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            Two of those usernames are the same — every name has to be different.
          </p>
        )}
        {error && (
          <div className="mt-4 border border-red-900/70 bg-red-950/40 px-4 py-3">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void handleFind()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 transition-colors hover:text-red-100"
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        <div className="sticky bottom-4 mt-5">
          <button
            type="button"
            onClick={() => void handleFind()}
            disabled={!canSubmit || loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 border border-amber-400/70 bg-amber-400/10 font-mono text-sm uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:border-stone-800 disabled:bg-transparent disabled:text-stone-600"
          >
            <Clapperboard className="h-4 w-4" />
            {loading ? 'Reading watchlists' : 'Find our film'}
          </button>
        </div>
      </section>

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {loading && (
        <section className="border border-amber-300/60 bg-[#171411] p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" aria-hidden />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Finding your film</p>
          </div>
          <p className="mt-3 text-sm text-stone-400">{progressMessage}</p>
        </section>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {result && (
        <div ref={resultRef} tabIndex={-1} aria-live="polite" aria-label="Find film results" className="space-y-6 outline-none">
          <section className="border border-amber-400/40 bg-[#0f0d0b] p-5 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">The shared shelf</p>
            <p className="mt-2 text-7xl font-black leading-none text-stone-50">{result.counts.returned}</p>
            <p className="mt-2 text-sm text-stone-400">
              films all {result.users.length} of you want to watch — and none of you has seen.
            </p>
            {result.counts.truncated && (
              <p className="mt-1 font-mono text-[11px] text-stone-600">showing the first {result.films.length} matches</p>
            )}
          </section>

          {result.films.length > 0 ? (
            <section>
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Most popular first</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                {result.films.map((film) => {
                  const poster = getPosterUrl(film.poster_path) || getPosterUrl(film.poster_url);
                  return (
                    <li key={`${film.title}-${film.year}-${film.slug}`}>
                      <a
                        href={film.slug ? `https://letterboxd.com/film/${film.slug}/` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-colors duration-150 ease-out hover:bg-stone-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden border border-stone-800 bg-stone-900">
                          {poster ? (
                            <>
                              <img
                                src={poster}
                                alt={`${film.title} poster`}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                  const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                                  if (fallback) fallback.style.display = 'block';
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
                        <p className="mt-1.5 truncate text-xs text-stone-100 sm:text-sm">{film.title}</p>
                        <p className="font-mono text-[10px] text-stone-500 sm:text-[11px]">{film.year}</p>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <section className="border border-stone-800 bg-[#14110e] p-5">
              <p className="text-sm text-stone-300">No unseen overlap yet — the watchlists do not share a film nobody has watched.</p>
              {emptyWatchlistUsers.length > 0 && (
                <p className="mt-2 text-sm text-stone-500">
                  {emptyWatchlistUsers.map((user) => `@${user}`).join(', ')}
                  {emptyWatchlistUsers.length === 1 ? "'s watchlist looks" : "'s watchlists look"} empty or private.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
