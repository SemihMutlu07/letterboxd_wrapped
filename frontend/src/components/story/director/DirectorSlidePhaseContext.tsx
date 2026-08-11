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

import type { DirectorSequenceData } from '../types';
import { directorPhaseAt, type DirectorPhase } from './directorPhases';

type DirectorSlidePhaseValue = {
  phase: DirectorPhase;
  reduce: boolean;
  sequence: DirectorSequenceData | null;
  paused: boolean;
};

const DirectorSlidePhaseContext = createContext<DirectorSlidePhaseValue>({
  phase: 'textReveal',
  reduce: false,
  sequence: null,
  paused: false,
});

export function DirectorSlidePhaseProvider({
  sequence,
  slideKey,
  paused,
  children,
}: {
  sequence: DirectorSequenceData | null;
  slideKey: string;
  paused: boolean;
  children: ReactNode;
}) {
  const reduce = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<DirectorPhase>(reduce ? 'final' : 'textReveal');
  const elapsedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  const syncPhase = useCallback((elapsedMs: number) => {
    const next = reduce ? 'final' : directorPhaseAt(elapsedMs);
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
    <DirectorSlidePhaseContext.Provider value={value}>
      {children}
    </DirectorSlidePhaseContext.Provider>
  );
}

export function useDirectorSlidePhase(): DirectorSlidePhaseValue {
  return useContext(DirectorSlidePhaseContext);
}
