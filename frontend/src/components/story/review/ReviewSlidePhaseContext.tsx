'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useReducedMotion } from 'framer-motion';

import type { ReviewSequenceData } from '../types';
import { reviewPhaseAt, type ReviewPhase } from './reviewPhases';

type ReviewSlidePhaseValue = {
  phase: ReviewPhase;
  reduce: boolean;
  sequence: ReviewSequenceData | null;
  paused: boolean;
};

const ReviewSlidePhaseContext = createContext<ReviewSlidePhaseValue>({
  phase: 'textReveal',
  reduce: false,
  sequence: null,
  paused: false,
});

export function ReviewSlidePhaseProvider({
  sequence,
  slideKey,
  paused,
  children,
}: {
  sequence: ReviewSequenceData | null;
  slideKey: string;
  paused: boolean;
  children: ReactNode;
}) {
  const reduce = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<ReviewPhase>(reduce ? 'final' : 'textReveal');
  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  const syncPhase = useCallback((elapsedMs: number) => {
    const next = reduce ? 'final' : reviewPhaseAt(elapsedMs);
    setPhase((current) => (current === next ? current : next));
  }, [reduce]);

  useEffect(() => {
    elapsedRef.current = 0;
    lastTickRef.current = null;
    setPhase(reduce ? 'final' : 'textReveal');
  }, [slideKey, reduce, sequence]);

  useEffect(() => {
    if (!sequence || reduce) return undefined;

    let raf = 0;
    const tick = (now: number) => {
      if (lastTickRef.current != null && !paused) {
        elapsedRef.current += now - lastTickRef.current;
        syncPhase(elapsedRef.current);
      }
      lastTickRef.current = now;
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [sequence, reduce, paused, syncPhase]);

  const value = useMemo(
    () => ({ phase, reduce, sequence, paused }),
    [phase, reduce, sequence, paused],
  );

  return (
    <ReviewSlidePhaseContext.Provider value={value}>
      {children}
    </ReviewSlidePhaseContext.Provider>
  );
}

export function useReviewSlidePhase(): ReviewSlidePhaseValue {
  return useContext(ReviewSlidePhaseContext);
}
