'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import SlideProgress from './SlideProgress';

export interface Slide {
  id: string;
  render: () => React.ReactNode;
}

interface SlideDeckProps {
  slides: Slide[];
}

const SWIPE_OFFSET_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

export default function SlideDeck({ slides }: SlideDeckProps) {
  const [[activeIndex, direction], setState] = useState<[number, number]>([0, 0]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      if (clamped === activeIndex) return;
      setState([clamped, clamped > activeIndex ? 1 : -1]);
    },
    [activeIndex, slides.length],
  );

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(slides.length - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, goTo, slides.length]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_OFFSET_THRESHOLD || velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      goNext();
    } else if (offset.x > SWIPE_OFFSET_THRESHOLD || velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      goPrev();
    }
  };

  const handleEdgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that originated on interactive content inside the slide
    // (buttons, links, poster cards, etc.) — only bare gutter clicks navigate.
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"], input, textarea, select')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.25) goPrev();
    else if (clickX > rect.width * 0.75) goNext();
  };

  const activeSlide = slides[activeIndex];

  return (
    <div className="relative">
      <SlideProgress count={slides.length} activeIndex={activeIndex} onJump={goTo} />
      <div className="relative overflow-hidden min-h-[calc(100dvh-2rem)]" onClick={handleEdgeClick}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'tween', duration: 0.28, ease: 'easeInOut' }, opacity: { duration: 0.2 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            className="px-3 md:px-8 pt-14 pb-6 max-w-7xl mx-auto"
          >
            {activeSlide.render()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
