'use client';

import { motion } from 'framer-motion';

import { useI18n } from '@/i18n/I18nProvider';

import { Label, Big } from '../SlideTypography';
import { useFinaleSlidePhase } from './FinaleSlidePhaseContext';

export function FinaleSlideBody() {
  const { t } = useI18n();
  const { reduce } = useFinaleSlidePhase();
  const instant = reduce;

  return (
    <>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.5, ease: 'easeOut' }}
      >
        <Label>{t('story.slide.finale.label')}</Label>
      </motion.div>
      <motion.div
        initial={instant ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: instant ? 0 : 0.5, delay: instant ? 0 : 0.1, ease: 'easeOut' }}
      >
        <Big>{t('story.slide.finale.headline')}</Big>
      </motion.div>
    </>
  );
}
