'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { ShareVariantRenderer } from '@/components/share/registry';
import type { ShareOrientation } from '@/components/share/types';
import type { StatsData } from '@/containers/results/sections/types';
import { useI18n } from '@/i18n/I18nProvider';

import { useFinaleSlidePhase } from './finale/FinaleSlidePhaseContext';
import { showFinaleCard, showFinaleCardHint } from './finale/finalePhases';
import { buildStoryShareCard, FINALE_CARD_DOM, FINALE_VARIANT, pickFinaleOrientation } from './viewModel';

/**
 * Story finale: the shareable card, chosen portrait on phones and landscape on
 * wider containers, scaled to fit the slide and revealed after the curtain fade.
 * Respects prefers-reduced-motion by rendering the card statically without 3D flip.
 */
export default function StoryFinaleCard({ stats }: { stats: StatsData }) {
  const reduce = Boolean(useReducedMotion());
  const { t } = useI18n();
  const { phase, sequence } = useFinaleSlidePhase();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [orientation, setOrientation] = useState<ShareOrientation>('vertical');

  const showCard = sequence ? showFinaleCard(phase, reduce) : true;
  const showHint = sequence ? showFinaleCardHint(phase, reduce) : false;

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBox({ w: rect.width, h: rect.height });
      setOrientation(pickFinaleOrientation(rect.width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const data = useMemo(() => buildStoryShareCard(stats), [stats]);
  const dom = FINALE_CARD_DOM[orientation];
  const scale = box.w > 0 && box.h > 0 ? Math.min(box.w / dom.w, box.h / dom.h) : 0;

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        className="relative w-full"
        style={{ height: 'min(56vh, 440px)', perspective: reduce ? undefined : 1200 }}
        data-finale-orientation={orientation}
      >
        {scale > 0 && showCard && (
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: dom.w,
              height: dom.h,
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformStyle: reduce ? undefined : 'preserve-3d',
            }}
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, rotateY: -24, scale: 0.92 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, rotateY: 0, scale: 1 }}
              transition={{ duration: reduce ? 0 : 0.65, ease: 'easeOut' }}
              style={{ width: dom.w, height: dom.h, transformStyle: reduce ? undefined : 'preserve-3d' }}
            >
              <ShareVariantRenderer variant={FINALE_VARIANT[orientation]} data={data} orientation={orientation} />
            </motion.div>
          </div>
        )}
      </div>
      {showHint && (
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400">
          {t('story.slide.finale.cardHint')}
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}
