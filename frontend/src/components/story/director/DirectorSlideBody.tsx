'use client';

import { motion } from 'framer-motion';

import { useI18n } from '@/i18n/I18nProvider';

import { Label, Big, Sub } from '../SlideTypography';
import { showDirectorRewatch } from './directorPhases';
import { useDirectorSlidePhase } from './DirectorSlidePhaseContext';

export function DirectorSlideBody() {
  const { t, formatNumber } = useI18n();
  const { phase, reduce, sequence } = useDirectorSlidePhase();
  if (!sequence) return null;

  const instant = reduce;
  const showRewatch = showDirectorRewatch(phase, reduce) && sequence.rewatch;

  return (
    <>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, ease: 'easeOut' }}
      >
        <Label>{t('story.slide.director.label')}</Label>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, delay: instant ? 0 : 0.12, ease: 'easeOut' }}
      >
        <Big>{sequence.directorName}</Big>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.5, delay: instant ? 0 : 0.28, ease: 'easeOut' }}
      >
        <Sub>
          {t('story.slide.director.sub', { count: formatNumber(sequence.filmCount) })}
        </Sub>
      </motion.div>
      {showRewatch && sequence.rewatch && (
        <motion.div
          initial={instant ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: instant ? 0 : 0.45 }}
        >
          <Sub className="text-stone-400">
            {sequence.rewatch.watchCount > 2
              ? t('story.slide.director.rewatch.detail', {
                title: sequence.rewatch.title,
                count: formatNumber(sequence.rewatch.watchCount),
              })
              : t('story.slide.director.rewatch.tease')}
          </Sub>
        </motion.div>
      )}
    </>
  );
}
