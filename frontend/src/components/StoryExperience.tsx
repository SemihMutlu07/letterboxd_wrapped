'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import type { StatsData } from '@/containers/results/experimental/types';
import { resultPath } from '@/lib/routes';
import { reviewCharLength } from '@/lib/reviews';

/**
 * Spotify-Wrapped-style story mode over an existing result.
 * Reads sessionStorage['letterboxdStats'] (same source as /results) — seed it
 * via a real analysis, /dev/load-run, or the experiment picker. Tap right/left
 * or use arrow keys; slides auto-advance.
 */

const SLIDE_MS = 6000;
const PRELOAD_AHEAD = 2;

type StoryMedia = {
  type: 'poster' | 'profile';
  url: string;
  alt: string;
  objectPosition?: string;
};

type Slide = {
  key: string;
  body: ReactNode;
  media?: StoryMedia[];
  accent?: string;
  visual?: 'mosaic' | 'hero' | 'portrait' | 'strip' | 'cascade';
};

function tmdbCdn(path: string | null | undefined, size = 'w780'): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\/+/, '').replace(/^t\/p\/[^/]+\//, '');
  return `https://image.tmdb.org/t/p/${size}/${clean}`;
}

function posterMedia(film: { title?: string; poster_path?: string | null } | null | undefined, size = 'w780'): StoryMedia | null {
  const url = tmdbCdn(film?.poster_path, size);
  if (!url) return null;
  return { type: 'poster', url, alt: `${film?.title ?? 'Film'} poster`, objectPosition: 'center center' };
}

function profileMedia(person: { name?: string; profile_path?: string | null } | null | undefined): StoryMedia | null {
  const url = tmdbCdn(person?.profile_path, 'h632');
  if (!url) return null;
  return { type: 'profile', url, alt: `${person?.name ?? 'Person'} portrait`, objectPosition: '50% 28%' };
}

function compactMedia(items: Array<StoryMedia | null | undefined>, limit = 8): StoryMedia[] {
  const seen = new Set<string>();
  const output: StoryMedia[] = [];
  for (const item of items) {
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

function allPosterMedia(stats: StatsData): StoryMedia[] {
  return compactMedia((stats.all_films ?? []).map((film) => posterMedia(film, 'w342')), Number.POSITIVE_INFINITY);
}

function filmByTitle(stats: StatsData, title?: string | null) {
  if (!title) return null;
  const clean = title.toLowerCase();
  return (stats.all_films ?? []).find((film) => film.title?.toLowerCase() === clean) ?? null;
}

function topRatedPosters(stats: StatsData, limit = 8) {
  return compactMedia(
    [...(stats.all_films ?? [])]
      .filter((film) => film.poster_path)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .map((film) => posterMedia(film)),
    limit,
  );
}

function genrePosters(stats: StatsData, genre?: string, limit = 8) {
  return compactMedia(
    (stats.all_films ?? [])
      .filter((film) => !genre || film.genres?.includes(genre))
      .map((film) => posterMedia(film)),
    limit,
  );
}

function personFilmPosters(stats: StatsData, name?: string, role: 'director' | 'actor' = 'director', limit = 6) {
  const clean = name?.toLowerCase();
  if (!clean) return [];
  return compactMedia(
    (stats.all_films ?? [])
      .filter((film) => role === 'director'
        ? film.director?.toLowerCase() === clean
        : film.cast?.some((actor) => actor.toLowerCase() === clean))
      .map((film) => posterMedia(film, 'w500')),
    limit,
  );
}

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
  const broadPosters = topRatedPosters(stats, 10);
  const directorName = stats.most_watched_director?.name ?? stats.top_directors?.[0]?.name;
  const topActor = stats.top_actors?.[0];

  slides.push({
    key: 'intro',
    media: broadPosters,
    accent: '#f59e0b',
    visual: 'mosaic',
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
    const fastForwardPosters = allPosterMedia(stats);
    slides.push({
      key: 'volume',
      media: compactMedia([
        posterMedia(stats.longest_film ? filmByTitle(stats, stats.longest_film.title) : null),
        ...fastForwardPosters,
        ...broadPosters,
      ], Math.max(24, fastForwardPosters.length)),
      accent: '#f97316',
      visual: 'cascade',
      body: (
        <>
          <Label>Fast forward</Label>
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
      media: broadPosters.slice(1, 9),
      accent: '#22c55e',
      visual: 'mosaic',
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
      media: genrePosters(stats, stats.favorite_genre.name, 8),
      accent: '#38bdf8',
      visual: 'mosaic',
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
    const directorProfile = stats.top_directors?.find((d) => d.name === stats.most_watched_director?.name);
    slides.push({
      key: 'director',
      media: compactMedia([
        profileMedia(directorProfile),
        ...personFilmPosters(stats, stats.most_watched_director.name, 'director', 5),
        profileMedia(topActor),
      ], 7),
      accent: '#ef4444',
      visual: 'portrait',
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
      media: compactMedia([
        posterMedia(stats.rating_outlier_film),
        ...broadPosters,
      ], 7),
      accent: '#eab308',
      visual: 'hero',
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
      media: compactMedia([
        posterMedia(stats.rating_outlier_film),
        ...topRatedPosters(stats, 8),
      ], 7),
      accent: '#a3e635',
      visual: 'strip',
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
      reviewCharLength(b) > reviewCharLength(a) ? b : a,
    );
    const longestLikes = longest.likes ?? 0;
    slides.push({
      key: 'review-personality',
      media: compactMedia([
        posterMedia(filmByTitle(stats, longest.title)),
        ...broadPosters,
      ], 6),
      accent: '#fb7185',
      visual: 'hero',
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
      media: compactMedia([
        ...genrePosters(stats, undefined, 10),
      ], 10),
      accent: '#67e8f9',
      visual: 'mosaic',
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
      media: compactMedia([
        profileMedia(topActor),
        profileMedia(stats.top_directors?.[0]),
        ...broadPosters,
      ], 8),
      accent: '#c084fc',
      visual: 'portrait',
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
    media: compactMedia([
      profileMedia(topActor),
      profileMedia(stats.top_directors?.find((d) => d.name === directorName) ?? stats.top_directors?.[0]),
      ...broadPosters,
    ], 9),
    accent: '#fbbf24',
    visual: 'mosaic',
    body: (
      <>
        <Label>That&apos;s the short version</Label>
        <Big>The full picture waits.</Big>
      </>
    ),
  });

  return slides;
}

function StoryVisual({ slide }: { slide: Slide }) {
  const media = slide.media ?? [];
  const accent = slide.accent ?? '#f59e0b';
  const hero = media[0];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 18% 18%, ${accent}42, transparent 30%), radial-gradient(circle at 80% 12%, rgba(103,232,249,0.20), transparent 26%), linear-gradient(145deg,#090806 0%,#17120f 48%,#050505 100%)`,
        }}
      />

      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl"
        />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.78),rgba(0,0,0,0.18)_52%,rgba(0,0,0,0.76))]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(245,215,168,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(245,215,168,.12)_1px,transparent_1px)] [background-size:42px_42px]" />

      {media.length > 0 && (
        <motion.div
          key={`visual-${slide.key}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="absolute inset-y-[9vh] right-[-8vw] hidden w-[58vw] max-w-[760px] md:block"
        >
          {slide.visual === 'portrait' ? (
            <PortraitStack media={media} accent={accent} />
          ) : slide.visual === 'cascade' ? (
            <PosterCascade media={media} accent={accent} />
          ) : slide.visual === 'strip' ? (
            <PosterStrip media={media} accent={accent} />
          ) : slide.visual === 'hero' ? (
            <HeroPoster media={media} accent={accent} />
          ) : (
            <PosterMosaic media={media} accent={accent} />
          )}
        </motion.div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/50 to-transparent" />
    </div>
  );
}

function StoryImage({ item, className = '', priority = false }: { item: StoryMedia; className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.alt}
      className={`h-full w-full object-cover ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      style={{ objectPosition: item.objectPosition ?? (item.type === 'profile' ? '50% 28%' : 'center center') }}
    />
  );
}

function PosterMosaic({ media, accent }: { media: StoryMedia[]; accent: string }) {
  return (
    <div className="grid h-full rotate-[-4deg] grid-cols-3 gap-3">
      {media.slice(0, 9).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 40 : -30 }}
          animate={{ y: index % 2 ? -18 : 18 }}
          transition={{ duration: 7 + index, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="relative overflow-hidden rounded-[18px] border border-white/10 bg-stone-950 shadow-2xl"
          style={{ boxShadow: index === 4 ? `0 0 70px ${accent}55` : undefined }}
        >
          <StoryImage item={item} priority={index < 3} />
        </motion.div>
      ))}
    </div>
  );
}

function PosterCascade({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const visible = media.slice(0, 42);
  if (visible.length === 0) return null;
  return (
    <div className="relative h-full rotate-[7deg]">
      <div className="absolute inset-y-[-8%] right-[4%] grid w-[82%] grid-cols-6 gap-3">
        {visible.map((item, index) => (
          <motion.div
            key={`${item.url}-${index}`}
            initial={{ y: index % 2 ? 36 : -44, x: index % 3 === 0 ? -20 : 16 }}
            animate={{ y: index % 2 ? -34 : 38, x: index % 3 === 0 ? 18 : -14 }}
            transition={{ duration: 7 + (index % 8), repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="aspect-[2/3] overflow-hidden rounded-[14px] border border-white/10 bg-black shadow-xl"
            style={{ boxShadow: index === 0 ? `0 0 90px ${accent}66` : undefined }}
          >
            <StoryImage item={item} priority={index < 10} />
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/45 to-transparent" />
    </div>
  );
}

function PosterStrip({ media, accent }: { media: StoryMedia[]; accent: string }) {
  return (
    <div className="flex h-full rotate-[5deg] items-center gap-4">
      {media.slice(0, 7).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 46 : -28 }}
          animate={{ y: index % 2 ? -20 : 26 }}
          transition={{ duration: 6 + index * 0.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="relative aspect-[2/3] h-[70%] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl"
          style={{ boxShadow: index === 0 ? `0 0 80px ${accent}66` : undefined }}
        >
          <StoryImage item={item} priority={index < 2} />
        </motion.div>
      ))}
    </div>
  );
}

function HeroPoster({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const [first, ...rest] = media;
  if (!first) return null;
  return (
    <div className="relative h-full">
      <div className="absolute right-[20%] top-1/2 aspect-[2/3] h-[82%] -translate-y-1/2 rotate-[3deg] overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl" style={{ boxShadow: `0 0 100px ${accent}55` }}>
        <StoryImage item={first} priority />
      </div>
      <div className="absolute bottom-0 right-0 flex gap-3">
        {rest.slice(0, 4).map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] h-40 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PortraitStack({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const [first, ...rest] = media;
  if (!first) return null;
  return (
    <div className="relative h-full">
      <div className="absolute right-[24%] top-1/2 aspect-[2/3] h-[82%] -translate-y-1/2 overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-2xl" style={{ boxShadow: `0 0 90px ${accent}55` }}>
        <StoryImage item={first} priority />
      </div>
      <div className="absolute bottom-8 right-4 grid grid-cols-3 gap-3">
        {rest.slice(0, 6).map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] h-28 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index < 2} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StoryExperience() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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
  const username = stats?.scraped_username;

  const goToSlide = useCallback((nextIndex: number) => {
    setIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
    setProgress(0);
    setIsPaused(false);
  }, [slides.length]);

  const goNext = useCallback(() => goToSlide(index + 1), [goToSlide, index]);
  const goPrevious = useCallback(() => goToSlide(index - 1), [goToSlide, index]);

  useEffect(() => {
    setProgress(isLast ? 100 : 0);
  }, [index, isLast]);

  useEffect(() => {
    if (slides.length === 0 || isLast || isPaused) return;
    let frame = 0;
    const start = performance.now();
    const startProgress = progress;
    const remaining = SLIDE_MS * (1 - startProgress / 100);

    const tick = (now: number) => {
      const elapsed = now - start;
      const nextProgress = Math.min(100, startProgress + (elapsed / SLIDE_MS) * 100);
      setProgress(nextProgress);
      if (elapsed >= remaining) {
        setIndex((i) => Math.min(i + 1, slides.length - 1));
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides.length, isLast, isPaused]);

  useEffect(() => {
    if (slides.length === 0) return;
    const urls = new Set<string>();
    for (let i = index; i <= Math.min(index + PRELOAD_AHEAD, slides.length - 1); i += 1) {
      for (const item of slides[i]?.media?.slice(0, 12) ?? []) urls.add(item.url);
    }
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }, [index, slides]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === ' ') {
        event.preventDefault();
        if (!isLast) setIsPaused((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrevious, isLast]);

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
      <AnimatePresence mode="wait">
        <StoryVisual key={`bg-${slides[index].key}`} slide={slides[index]} />
      </AnimatePresence>

      {/* Story progress bars */}
      <div className="absolute inset-x-0 top-0 z-40 flex gap-1 p-3">
        {slides.map((slide, i) => (
          <div key={slide.key} className="h-0.5 flex-1 overflow-hidden bg-stone-700/70">
            {i < index && <div className="h-full w-full bg-amber-300" />}
            {i === index && (
              <div
                className="h-full bg-amber-300"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label={isPaused ? 'Resume story' : 'Pause story'}
        onClick={() => !isLast && setIsPaused((v) => !v)}
        className="absolute right-4 top-8 z-50 rounded-full border border-white/15 bg-black/55 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-stone-200 shadow-xl backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>

      {/* Slide */}
      <div className="relative z-20 grid min-h-screen place-items-center px-5 py-14 text-center md:place-items-center md:px-10 md:text-left">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[index].key}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 1.01 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full max-w-xl justify-self-center rounded-[28px] border border-white/10 bg-black/42 px-5 py-6 shadow-2xl shadow-black/40 backdrop-blur-md md:ml-[8vw] md:justify-self-start md:px-8 md:py-8"
          >
            {slides[index].body}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tap zones: left third = back, rest = next */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={goPrevious}
        className="absolute inset-y-0 left-0 z-30 w-1/3 cursor-w-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      />
      <button
        type="button"
        aria-label="Next slide"
        onClick={goNext}
        className="absolute inset-y-0 right-0 z-30 w-2/3 cursor-e-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      />

      {isLast && (
        <div className="absolute inset-x-4 bottom-6 z-50 mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={goPrevious}
            className="rounded-full border border-stone-600 bg-black/65 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-200 backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => goToSlide(0)}
            className="rounded-full border border-stone-600 bg-black/65 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-200 backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Replay
          </button>
          <a
            href={resultPath(username)}
            className="rounded-full bg-amber-300 px-7 py-3 font-mono text-xs font-black uppercase tracking-[0.14em] text-stone-950 shadow-xl shadow-amber-950/20 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
          >
            Open the dossier
          </a>
          <a
            href="/experiment"
            className="rounded-full border border-stone-600 bg-black/65 px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-stone-200 backdrop-blur transition-colors hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            Close
          </a>
        </div>
      )}
    </main>
  );
}

export { buildSlides };
