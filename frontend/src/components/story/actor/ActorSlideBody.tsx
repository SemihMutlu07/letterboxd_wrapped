'use client';

import { motion } from 'framer-motion';

import { useI18n } from '@/i18n/I18nProvider';

import { Label, Big, Sub } from '../SlideTypography';
import { showPersonRewatch } from '../person/personPhases';
import { usePersonSlidePhase } from '../person/PersonSlidePhaseContext';

export function ActorSlideBody() {
  const { t, formatNumber } = useI18n();
  const { phase, reduce, sequence } = usePersonSlidePhase();
  if (!sequence) return null;

  const instant = reduce;
  const showRewatch = showPersonRewatch(phase, reduce) && sequence.rewatch;

  return (
    <>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Label>{t('story.slide.actor.label')}</Label>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, delay: instant ? 0 : 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Big>{sequence.personName}</Big>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.5, delay: instant ? 0 : 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Sub>
          {t('story.slide.actor.sub', { count: formatNumber(sequence.filmCount) })}
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
              ? t('story.slide.actor.rewatch.detail', {
                title: sequence.rewatch.title,
                count: formatNumber(sequence.rewatch.watchCount),
              })
              : t('story.slide.actor.rewatch.tease')}
          </Sub>
        </motion.div>
      )}
    </>
  );
}
