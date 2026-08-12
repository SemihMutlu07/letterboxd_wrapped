'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { ShareVariantRenderer } from '@/components/share/registry';
import type { ShareOrientation } from '@/components/share/types';
import type { StatsData } from '@/containers/results/sections/types';
import { buildStoryShareCard, FINALE_CARD_DOM, FINALE_VARIANT, pickFinaleOrientation } from './viewModel';

/**
 * Story finale dossier preview — larger, with subtle depth, overlapping the
 * card boundary. Respects prefers-reduced-motion.
 */
export default function StoryFinaleCard({ stats }: { stats: StatsData }) {
  const reduce = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [orientation, setOrientation] = useState<ShareOrientation>('vertical');

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
    <div
      ref={frameRef}
      className="relative -mx-2 mb-5 w-[calc(100%+1rem)] sm:-mx-3 sm:mb-6 sm:w-[calc(100%+1.5rem)]"
      style={{ height: 'min(48vh, 380px)', perspective: 1400 }}
      data-finale-orientation={orientation}
    >
      {scale > 0 && (
        <div
          className="absolute left-1/2 top-[46%]"
          style={{
            width: dom.w,
            height: dom.h,
            transform: `translate(-50%, -50%) scale(${scale}) rotateX(${reduce ? 0 : 6}deg) rotateZ(${reduce ? 0 : -1.5}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, rotateY: -18, y: 24, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, rotateY: 0, y: 0, scale: 1 }}
            transition={{ duration: reduce ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[18px] shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/15"
            style={{ width: dom.w, height: dom.h, transformStyle: 'preserve-3d' }}
          >
            <ShareVariantRenderer variant={FINALE_VARIANT[orientation]} data={data} orientation={orientation} />
          </motion.div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
}
