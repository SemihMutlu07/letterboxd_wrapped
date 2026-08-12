'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

import type { PosterFieldConfig } from './posterFieldConfig';
import { PosterFieldProvider } from './PosterFieldContext';

type PosterFieldProps = {
  slideKey: string;
  layout: PosterFieldConfig;
  children: ReactNode;
};

/**
 * Shared desktop poster frame — one place for left/right/top/bottom + content bias.
 * Inner visuals stay free to compose; they should not hardcode field anchors.
 */
export function PosterField({ slideKey, layout, children }: PosterFieldProps) {
  const reduce = useReducedMotion();

  const fieldStyle: CSSProperties = {
    top: layout.top,
    bottom: layout.bottom,
    left: layout.left,
    right: layout.right,
    width: layout.width,
    maxWidth: layout.maxWidth,
  };

  const innerStyle: CSSProperties = {
    transform: `translateX(${layout.contentX ?? '0%'}) rotate(${layout.rotation ?? 0}deg)`,
  };

  return (
    <PosterFieldProvider layout={layout}>
      <motion.div
        key={`poster-field-${slideKey}`}
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, scale: 1.02 }}
        transition={{ duration: reduce ? 0 : 0.65, ease: 'easeOut' }}
        className="absolute hidden md:block"
        style={fieldStyle}
        data-testid="story-poster-field"
      >
        <div className="h-full w-full origin-center" style={innerStyle}>
          {children}
        </div>
      </motion.div>
    </PosterFieldProvider>
  );
}
