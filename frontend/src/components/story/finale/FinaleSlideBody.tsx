'use client';

import { useI18n } from '@/i18n/I18nProvider';

import { Label, Big } from '../SlideTypography';
import { RevealLine, TEXT_REVEAL } from '../motion/motionPrimitives';
import { useFinaleSlidePhase } from './FinaleSlidePhaseContext';

export function FinaleSlideBody() {
  const { t } = useI18n();
  const { reduce } = useFinaleSlidePhase();
  const instant = reduce;

  return (
    <>
      <RevealLine instant={instant} delay={TEXT_REVEAL.textLabel} y={14}>
        <Label>{t('story.slide.finale.label')}</Label>
      </RevealLine>
      <RevealLine instant={instant} delay={TEXT_REVEAL.textHeadline} y={16}>
        <Big>{t('story.slide.finale.headline')}</Big>
      </RevealLine>
    </>
  );
}
