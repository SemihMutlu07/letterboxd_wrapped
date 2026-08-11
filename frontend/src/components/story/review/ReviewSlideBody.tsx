'use client';

import { motion } from 'framer-motion';

import { useI18n } from '@/i18n/I18nProvider';

import { Label, Big, Sub } from '../SlideTypography';
import { showReviewInsight } from './reviewPhases';
import { useReviewSlidePhase } from './ReviewSlidePhaseContext';

export function ReviewSlideBody() {
  const { t, formatNumber } = useI18n();
  const { phase, reduce, sequence } = useReviewSlidePhase();
  if (!sequence) return null;

  const instant = reduce;
  const showInsight = showReviewInsight(phase, reduce);
  const likes = sequence.likes;

  return (
    <>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, ease: 'easeOut' }}
      >
        <Label>{t('story.slide.review.label')}</Label>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.55, delay: instant ? 0 : 0.12, ease: 'easeOut' }}
      >
        <Big>{sequence.filmTitle}</Big>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.5, delay: instant ? 0 : 0.28, ease: 'easeOut' }}
      >
        <Sub>
          {sequence.totalWordsWritten != null
            ? t('story.slide.review.wordsTotal', { count: formatNumber(sequence.totalWordsWritten) })
            : null}
        </Sub>
      </motion.div>
      {showInsight && (
        <motion.div
          initial={instant ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: instant ? 0 : 0.45 }}
        >
          <Sub className="text-stone-400">
            {likes === 0
              ? t('story.slide.review.zeroLikes')
              : likes === 1
                ? t('story.slide.review.likes_one', { count: formatNumber(likes) })
                : t('story.slide.review.likes_other', { count: formatNumber(likes) })}
          </Sub>
          <Sub className="text-stone-400">
            {t('story.slide.review.thisLength', { count: formatNumber(sequence.wordCount) })}
          </Sub>
        </motion.div>
      )}
    </>
  );
}
