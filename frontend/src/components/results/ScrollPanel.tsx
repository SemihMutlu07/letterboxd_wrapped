'use client';

import React from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

/** Wraps children in the transitions-dev panel-reveal pattern, triggered on scroll-into-view. */
export default function ScrollPanel({
  children,
  className = '',
  delayMs = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  style?: React.CSSProperties;
}) {
  const { ref, isVisible } = useIntersectionObserver({ rootMargin: '-10% 0px', threshold: 0.15, triggerOnce: true });

  return (
    <div
      ref={ref}
      data-open={isVisible}
      className={`t-panel-slide ${className}`}
      style={{ ...style, transitionDelay: delayMs ? (isVisible ? `${delayMs}ms` : '0ms') : undefined }}
    >
      {children}
    </div>
  );
}
