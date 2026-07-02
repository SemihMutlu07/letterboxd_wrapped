'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import type { StatsData } from '@/containers/results/experimental/types';
import { resultPath } from '@/lib/routes';

/**
 * Experiment: Spotify-Wrapped-style story mode over an existing result.
 * Reads sessionStorage['letterboxdStats'] (same source as /results) — seed it
 * via a real analysis or /dev/load-run. Tap right/left or use arrow keys;
 * slides auto-advance.
 */

const SLIDE_MS = 6000;

type Slide = { key: string; body: ReactNode };

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">{children}</p>;
}

function Big({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-6xl font-black leading-none text-stone-50 sm:text-7xl">{children}</p>;
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-base text-stone-400">{children}</p>;
}

function buildSlides(stats: StatsData): Slide[] {
  const slides: Slide[] = [];
  const username = stats.scraped_username;

  slides.push({
    key: 'intro',
    body: (
      <>
        <Label>Movies Wrapped</Label>
        <Big>{username ? `@${username}` : 'Your year in film'}</Big>
        {stats.data_timeline?.period_description && <Sub>{stats.data_timeline.period_description}</Sub>}
      </>
    ),
  });

  if (stats.total_films) {
    slides.push({
      key: 'volume',
      body: (
        <>
          <Label>The count</Label>
          <Big>{stats.total_films} films</Big>
          {stats.days_watched ? <Sub>{stats.days_watched} days of your life on screen.</Sub> : null}
        </>
      ),
    });
  }

  if (stats.favorite_genre?.name) {
    slides.push({
      key: 'genre',
      body: (
        <>
          <Label>Where you kept returning</Label>
          <Big>{stats.favorite_genre.name}</Big>
          <Sub>{stats.favorite_genre.count} times. Not a phase, apparently.</Sub>
        </>
      ),
    });
  }

  if (stats.most_watched_director?.name) {
    slides.push({
      key: 'director',
      body: (
        <>
          <Label>Your director</Label>
          <Big>{stats.most_watched_director.name}</Big>
          <Sub>{stats.most_watched_director.count} films together.</Sub>
        </>
      ),
    });
  }

  if (stats.average_rating != null) {
    slides.push({
      key: 'taste',
      body: (
        <>
          <Label>The verdicts</Label>
          <Big>{stats.average_rating.toFixed(2)} ★</Big>
          {stats.total_countries ? <Sub>Average rating, across {stats.total_countries} countries of cinema.</Sub> : null}
        </>
      ),
    });
  }

  if (stats.sinefil_meter?.score != null) {
    slides.push({
      key: 'sinefil',
      body: (
        <>
          <Label>Cinema scale</Label>
          <Big>{stats.sinefil_meter.score} / 100</Big>
          {stats.sinefil_meter.type && <Sub>{stats.sinefil_meter.type}</Sub>}
        </>
      ),
    });
  }

  if (stats.cinematic_persona?.persona) {
    slides.push({
      key: 'persona',
      body: (
        <>
          <Label>Which makes you</Label>
          <Big>{stats.cinematic_persona.persona}</Big>
          {stats.cinematic_persona.description && <Sub>{stats.cinematic_persona.description}</Sub>}
        </>
      ),
    });
  }

  slides.push({
    key: 'outro',
    body: (
      <>
        <Label>That&apos;s the short version</Label>
        <Big>The full picture waits.</Big>
        <a
          href={resultPath(username)}
          className="mt-8 inline-block bg-amber-300 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 hover:bg-amber-200"
        >
          Open full results
        </a>
      </>
    ),
  });

  return slides;
}

export default function StoryPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('letterboxdStats');
      if (saved) setStats(JSON.parse(saved) as StatsData);
    } catch (err) {
      console.error('[story] failed to parse stored stats:', err);
    }
    setLoaded(true);
  }, []);

  const slides = useMemo(() => (stats ? buildSlides(stats) : []), [stats]);
  const isLast = index >= slides.length - 1;

  useEffect(() => {
    if (slides.length === 0 || isLast) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, slides.length, isLast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  if (!loaded) return null;

  if (!stats || slides.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f0d0b] p-8 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">No result data in this session</p>
          <p className="mt-3 text-sm text-stone-400">Run an analysis first, or seed one from /dev/load-run.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen select-none overflow-hidden bg-[#0f0d0b]">
      {/* Story progress bars */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
        {slides.map((slide, i) => (
          <div key={slide.key} className="h-0.5 flex-1 overflow-hidden bg-stone-800">
            {i < index && <div className="h-full w-full bg-amber-300" />}
            {i === index && (
              <motion.div
                key={`fill-${index}`}
                className="h-full bg-amber-300"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: isLast ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Slide */}
      <div className="grid min-h-screen place-items-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[index].key}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="max-w-xl"
          >
            {slides[index].body}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tap zones: left third = back, rest = next */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => setIndex((i) => Math.max(i - 1, 0))}
        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize"
      />
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
        className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize"
      />
    </main>
  );
}
