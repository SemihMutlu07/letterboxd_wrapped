'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { Heart, X, Star, TrendingUp } from 'lucide-react';

import type { WatchlistFilm } from '@/lib/api';
import { getPosterUrl } from '@/lib/analytics';
import { PosterPlaceholder } from '@/components/results/Placeholders';

type SortMode = 'popularity' | 'rating' | 'year';

const SORT_LABELS: Record<SortMode, string> = {
  popularity: 'Most popular',
  rating: 'Highest rated',
  year: 'Newest',
};

function sortFilms(films: WatchlistFilm[], mode: SortMode): WatchlistFilm[] {
  const sorted = [...films];
  if (mode === 'popularity') {
    sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } else if (mode === 'rating') {
    sorted.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  } else {
    sorted.sort((a, b) => String(b.year).localeCompare(String(a.year)));
  }
  return sorted;
}

export default function SwipeDeck({ films }: { films: WatchlistFilm[] }) {
  const [sortMode, setSortMode] = useState<SortMode>('popularity');
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<WatchlistFilm[]>([]);
  const [skipped, setSkipped] = useState<WatchlistFilm[]>([]);
  const [direction, setDirection] = useState<0 | 1 | -1>(0);

  const sorted = useMemo(() => sortFilms(films, sortMode), [films, sortMode]);
  const current = sorted[index];
  const isDone = index >= sorted.length;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setDirection(1);
      setKept((prev) => [...prev, current]);
      setIndex((i) => i + 1);
    } else if (info.offset.x < -threshold) {
      setDirection(-1);
      setSkipped((prev) => [...prev, current]);
      setIndex((i) => i + 1);
    }
  };

  const handleKeep = () => {
    if (!current) return;
    setDirection(1);
    setKept((prev) => [...prev, current]);
    setIndex((i) => i + 1);
  };

  const handleSkip = () => {
    if (!current) return;
    setDirection(-1);
    setSkipped((prev) => [...prev, current]);
    setIndex((i) => i + 1);
  };

  const handleReset = () => {
    setIndex(0);
    setKept([]);
    setSkipped([]);
    setDirection(0);
  };

  if (films.length === 0) {
    return (
      <section className="border border-stone-800 bg-[#171411] p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">No films to swipe</p>
        <p className="mt-2 text-sm text-stone-400">The shared shelf is empty.</p>
      </section>
    );
  }

  return (
    <section className="border border-stone-800 bg-[#171411] p-5">
      {/* Sort control */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-stone-500">Sort by</span>
          <div className="flex gap-1">
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setSortMode(mode); setIndex(0); setKept([]); setSkipped([]); }}
                className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  sortMode === mode
                    ? 'border-amber-300 bg-amber-300 text-stone-950'
                    : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-100'
                }`}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono text-[11px] text-stone-500">
          {index} / {sorted.length} · {kept.length} kept
        </p>
      </div>

      {isDone ? (
        <div className="py-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">All done</p>
          <p className="mt-2 text-sm text-stone-400">
            You kept {kept.length} and skipped {skipped.length} of {sorted.length} films.
          </p>
          {kept.length > 0 && (
            <div className="mx-auto mt-4 max-w-sm space-y-1">
              {kept.map((film) => (
                <div key={`${film.title}-${film.year}`} className="flex items-center gap-2 border border-stone-800 px-3 py-2">
                  <Heart className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" />
                  <span className="truncate text-sm text-stone-200">{film.title}</span>
                  <span className="font-mono text-[11px] text-stone-500">{film.year}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 border border-stone-700 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-stone-300 transition-colors hover:border-stone-500 hover:text-stone-100"
          >
            Start over
          </button>
        </div>
      ) : (
        <>
          {/* Card stack */}
          <div className="relative mx-auto flex h-[420px] max-w-sm items-center justify-center">
            <AnimatePresence mode="popLayout">
              {/* Next card (peek) */}
              {sorted[index + 1] && (
                <motion.div
                  key={`peek-${index + 1}`}
                  className="absolute inset-0 scale-95 opacity-40"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 0.95, opacity: 0.4 }}
                  transition={{ duration: 0.2 }}
                >
                  <SwipeCard film={sorted[index + 1]} />
                </motion.div>
              )}

              {/* Current card */}
              <motion.div
                key={`card-${index}`}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                initial={{ scale: 1, x: 0, opacity: 1 }}
                animate={{ scale: 1, x: 0, opacity: 1 }}
                exit={{
                  x: direction > 0 ? 300 : -300,
                  opacity: 0,
                  transition: { duration: 0.2 },
                }}
              >
                <SwipeCard film={current} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleSkip}
              className="grid h-14 w-14 place-items-center rounded-full border-2 border-stone-700 text-stone-400 transition-all hover:border-red-500 hover:text-red-400 active:scale-90"
              aria-label="Skip film"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={handleKeep}
              className="grid h-14 w-14 place-items-center rounded-full border-2 border-stone-700 text-stone-400 transition-all hover:border-amber-300 hover:text-amber-300 active:scale-90"
              aria-label="Keep film"
            >
              <Heart className="h-6 w-6" />
            </button>
          </div>
          <p className="mt-2 text-center font-mono text-[11px] text-stone-600">
            Drag left to skip · Drag right to keep
          </p>
        </>
      )}
    </section>
  );
}

function SwipeCard({ film }: { film: WatchlistFilm }) {
  // poster_path is the TMDB-enriched field; poster_url is the raw scraper
  // value (often a broken /image-150/ AJAX endpoint, not an image).
  const poster = getPosterUrl(film.poster_path) || getPosterUrl(film.poster_url);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-stone-700 bg-[#0f0d0b] shadow-2xl">
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-stone-900">
        {poster ? (
          <>
            <img
              src={poster}
              alt={`${film.title} poster`}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
              crossOrigin="anonymous"
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
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d0b] via-transparent to-transparent" />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-black leading-tight text-stone-100">{film.title}</h3>
        <p className="font-mono text-xs text-stone-500">{film.year}</p>

        {film.genres && film.genres.length > 0 && (
          <p className="mt-1 text-xs text-stone-400">{film.genres.slice(0, 3).join(' · ')}</p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-2">
          {film.vote_average != null && film.vote_average > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {film.vote_average.toFixed(1)}
            </span>
          )}
          {film.popularity != null && film.popularity > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <TrendingUp className="h-3.5 w-3.5 text-stone-500" />
              {Math.round(film.popularity)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
