'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { slideMeta } from '@/components/story/manifest';
import { useStoryMachine } from '@/components/story/useStoryMachine';
import { AUTO_MIN_MS, SLIDE_MS, PRELOAD_AHEAD } from '@/components/story/constants';
import { buildSlides } from '@/components/story/slides/buildSlides';
import { StoryNavigation } from '@/components/story/StoryNavigation';
import { StoryPauseButton } from '@/components/story/StoryPauseButton';
import { StoryProgressBar } from '@/components/story/StoryProgressBar';
import { StorySlidePanel } from '@/components/story/StorySlidePanel';
import { StoryVisual } from '@/components/story/visuals/StoryVisual';
import { useI18n } from '@/i18n/I18nProvider';

export default function StoryExperience() {
  const i18n = useI18n();
  const { t } = i18n;
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const elapsedRef = useRef(0);
  const { phase, stats, start } = useStoryMachine();

  useEffect(() => {
    if (phase === 'ready') start();
  }, [phase, start]);

  const slides = useMemo(() => (stats ? buildSlides(stats, i18n) : []), [i18n, stats]);
  const isLast = index >= slides.length - 1;
  const username = stats?.scraped_username;
  const currentInteraction = slideMeta(slides[index]?.key ?? '').interaction;

  const goToSlide = useCallback((nextIndex: number) => {
    setIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
    elapsedRef.current = 0;
    setProgress(0);
    setIsPaused(false);
  }, [slides.length]);

  const goNext = useCallback(() => {
    if (currentInteraction === 'auto-min' && elapsedRef.current < AUTO_MIN_MS) return;
    goToSlide(index + 1);
  }, [currentInteraction, goToSlide, index]);
  const goPrevious = useCallback(() => goToSlide(index - 1), [goToSlide, index]);

  useEffect(() => {
    elapsedRef.current = isLast ? SLIDE_MS : 0;
    setProgress(isLast ? 100 : 0);
  }, [index, isLast]);

  useEffect(() => {
    if (slides.length === 0 || isLast || isPaused || phase !== 'playing' || currentInteraction === 'manual') return;
    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const delta = Math.max(0, now - previous);
      previous = now;
      elapsedRef.current = Math.min(SLIDE_MS, elapsedRef.current + delta);
      const nextProgress = (elapsedRef.current / SLIDE_MS) * 100;
      setProgress(nextProgress);
      if (elapsedRef.current >= SLIDE_MS) {
        elapsedRef.current = 0;
        setIndex((i) => Math.min(i + 1, slides.length - 1));
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, slides.length, isLast, isPaused, phase, currentInteraction]);

  useEffect(() => {
    if (slides.length === 0) return;
    const urls = new Set<string>();
    for (let i = index; i <= Math.min(index + PRELOAD_AHEAD, slides.length - 1); i += 1) {
      for (const item of slides[i]?.media?.slice(0, 6) ?? []) urls.add(item.url);
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

  if (phase === 'idle') return null;

  if (!stats || slides.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f0d0b] p-8 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">{t('story.empty.title')}</p>
          <p className="mt-3 text-sm text-stone-400">{t('story.empty.description')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen select-none overflow-hidden bg-[#0f0d0b]">
      <AnimatePresence mode="wait">
        <StoryVisual key={`bg-${slides[index].key}`} slide={slides[index]} paused={isPaused} />
      </AnimatePresence>

      <StoryProgressBar slides={slides} index={index} progress={progress} />

      <StoryPauseButton
        isPaused={isPaused}
        isLast={isLast}
        onToggle={() => !isLast && setIsPaused((v) => !v)}
      />

      <StorySlidePanel
        slide={slides[index]}
        isLast={isLast}
        stats={stats}
        showTapHint={currentInteraction === 'manual'}
      />

      <StoryNavigation
        isLast={isLast}
        username={username}
        locale={i18n.locale}
        onPrevious={goPrevious}
        onNext={goNext}
        onReplay={() => goToSlide(0)}
      />
    </main>
  );
}

export { buildSlides } from '@/components/story/slides/buildSlides';
export { AUTO_MIN_MS } from '@/components/story/constants';
