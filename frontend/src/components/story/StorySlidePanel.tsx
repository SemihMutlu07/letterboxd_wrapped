'use client';

import { motion, AnimatePresence } from 'framer-motion';

import StoryFinaleCard from '@/components/story/StoryFinaleCard';
import type { StatsData } from '@/containers/results/sections/types';
import { useI18n } from '@/i18n/I18nProvider';

import type { Slide } from './types';
import { MobileMediaRail } from './visuals/MobileMediaRail';

type StorySlidePanelProps = {
  slide: Slide;
  isLast: boolean;
  stats: StatsData;
  showTapHint: boolean;
};

export function StorySlidePanel({ slide, isLast, stats, showTapHint }: StorySlidePanelProps) {
  const { t } = useI18n();

  return (
    <div className="relative z-20 grid min-h-screen place-items-center px-4 pb-24 pt-16 text-center md:place-items-center md:px-10 md:py-14 md:text-left">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.key}
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -22, scale: 1.01 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-xl justify-self-center rounded-[24px] border border-white/10 bg-black/55 px-4 py-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:px-5 sm:py-6 md:ml-[8vw] md:justify-self-start md:rounded-[28px] md:bg-black/42 md:px-8 md:py-8"
        >
          {isLast ? (
            <StoryFinaleCard stats={stats} />
          ) : (
            <MobileMediaRail media={slide.media ?? []} accent={slide.accent ?? '#f59e0b'} />
          )}
          {slide.body}
          {!isLast && showTapHint && (
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
              {t('story.tapToContinue')}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
