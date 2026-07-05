'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import type { StatsData } from '@/containers/results/experimental/types';
import { resultPath } from '@/lib/routes';

/**
 * Spotify-Wrapped-style story mode over an existing result.
 * Reads sessionStorage['letterboxdStats'] (same source as /results) — seed it
 * via a real analysis, /dev/load-run, or the experiment picker. Tap right/left
 * or use arrow keys; slides auto-advance.
 */

const SLIDE_MS = 6000;

type Slide = { key: string; body: ReactNode };

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">{children}</p>;
}

function Big({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-6xl font-black leading-none text-stone-50 sm:text-7xl">{children}</p>;
}

function Sub({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mt-3 text-base text-stone-400 ${className}`}>{children}</p>;
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
        <Sub className="mt-6">
          They say the movies you choose say more about you than the ones you skip.
          Let&apos;s find out what yours are saying.
        </Sub>
      </>
    ),
  });

  if (stats.total_films) {
    const d = stats.days_watched;
    slides.push({
      key: 'volume',
      body: (
        <>
          <Label>The count</Label>
          <Big>{stats.total_films} films</Big>
          {d || stats.hours_watched ? (
            <Sub>
              {d
                ? `${d} days of your life, in the dark, watching other people live.`
                : stats.hours_watched
                  ? `${Math.round(stats.hours_watched)} hours. That&apos;s not a hobby, that&apos;s a parallel life.`
                  : null}
            </Sub>
          ) : null}
        </>
      ),
    });
  }

  const peakMonth = (stats.monthly_viewing_habits ?? []).reduce<{ month: string; count: number } | null>(
    (best, m) => (!best || m.count > best.count ? m : best),
    null,
  );
  if (peakMonth || stats.story_analytics?.viewing_season) {
    slides.push({
      key: 'rhythm',
      body: (
        <>
          <Label>Your rhythm</Label>
          <Big>{peakMonth ? peakMonth.month : stats.story_analytics?.viewing_season}</Big>
          <Sub>
            {peakMonth
              ? `${peakMonth.count} films that month — you weren't watching, you were processing something.`
              : null}
            {stats.story_analytics?.most_active_day
              ? ` Your comfort zone had subtitles and you pressed play most on ${stats.story_analytics.most_active_day}s.`
              : ''}
          </Sub>
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
          <Sub>{stats.favorite_genre.count} times. Not a phase, apparently — some places just feel like home.</Sub>
        </>
      ),
    });
  }

  if (stats.most_watched_director?.name) {
    const topActor = stats.top_actors?.[0];
    slides.push({
      key: 'director',
      body: (
        <>
          <Label>Your comfort zone had subtitles</Label>
          <Big>{stats.most_watched_director.name}</Big>
          <Sub>
            {stats.most_watched_director.count} films together.
            {topActor
              ? ` And you kept showing up for ${topActor.name} — ${topActor.count} times, like a familiar face in the crowd.`
              : ''}
          </Sub>
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
          {stats.total_countries
            ? <Sub>Your average rating across {stats.total_countries} countries of cinema. Not generous, not cruel — just honest.</Sub>
            : <Sub>Your average rating. Not generous, not cruel — just honest.</Sub>}
        </>
      ),
    });
  }

  if (stats.rating_personality || stats.most_common_rating != null) {
    slides.push({
      key: 'rating-personality',
      body: (
        <>
          <Label>How you judge</Label>
          <Big>{stats.rating_personality ?? `${stats.most_common_rating} ★, mostly`}</Big>
          {stats.most_common_rating != null ? (
            <Sub>
              {stats.most_common_rating <= 2.5
                ? `You gave ${stats.most_common_rating} ★ more than anything else. You know what you don't like, and you're not quiet about it.`
                : stats.most_common_rating >= 4
                  ? `You gave ${stats.most_common_rating} ★ more than anything else. An optimist, or just easily pleased?`
                  : `You gave ${stats.most_common_rating} ★ more than anything else. The solid middle — no regrets, no hype.`}
            </Sub>
          ) : null}
        </>
      ),
    });
  }

  const reviews = stats.review_analysis?.reviews ?? [];
  if (reviews.length > 0) {
    const longest = reviews.reduce((a, b) =>
      (b.text_length ?? b.text?.length ?? 0) > (a.text_length ?? a.text?.length ?? 0) ? b : a,
    );
    const longestLikes = longest.likes ?? 0;
    slides.push({
      key: 'review-personality',
      body: (
        <>
          <Label>Your longest word</Label>
          <Big>{longest.title}</Big>
          <Sub>
            {stats.review_analysis?.total_words_written
              ? `${stats.review_analysis.total_words_written.toLocaleString()} words written total. `
              : ''}
            {longestLikes === 0
              ? "Your longest review got 0 likes, but it had conviction. Some stories are for the writer, not the crowd."
              : `That one got ${longestLikes} like${longestLikes === 1 ? '' : 's'} — someone out there gets you.`}
          </Sub>
        </>
      ),
    });
  }

  if (stats.sinefil_meter?.score != null) {
    slides.push({
      key: 'sinefil',
      body: (
        <>
          <Label>How deep the rabbit hole goes</Label>
          <Big>{stats.sinefil_meter.score} / 100</Big>
          {stats.sinefil_meter.type && <Sub>Your cinema scale says you're a <strong>{stats.sinefil_meter.type}</strong>. You&apos;ve wandered past the mainstream into something more specific.</Sub>}
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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={resultPath(username)}
            className="inline-block bg-amber-300 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-950 hover:bg-amber-200"
          >
            Open the dossier
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="inline-block border border-stone-600 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-300 hover:border-amber-300 hover:text-amber-200"
          >
            Copy link
          </button>
        </div>
      </>
    ),
  });

  return slides;
}

export default function StoryExperience() {
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

export { buildSlides };
