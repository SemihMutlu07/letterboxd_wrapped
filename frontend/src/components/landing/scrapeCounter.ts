import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveScrapeReveal, type ScrapeReveal, type ScrapeWaitBeat } from './scrapeReveal';
import type { ScrapeTraceEvent } from '@/lib/api';

/** Audit decision 2: worker events land as ONE reveal update per 600–900ms window. */
export const COUNTER_FLUSH_MS = 750;

const EMPHASIS_MS = 450;

export type CountMilestone = 'first' | 'fifty' | 'hundred' | 'done';

/**
 * Sparse emphasis (audit decision 2): only the audited thresholds pop — first film,
 * 50, 100, completed. Everything else updates silently. Batches that jump several
 * thresholds announce only the highest one crossed.
 */
export function resolveCountMilestone(previous: number | null, next: number): CountMilestone | null {
  if ((previous ?? 0) < 100 && next >= 100) return 'hundred';
  if ((previous ?? 0) < 50 && next >= 50) return 'fifty';
  if ((previous ?? 0) < 1 && next >= 1) return 'first';
  return null;
}

/**
 * Buffers incoming trace events and commits them to the reveal at most once per
 * flush window, so a burst of worker events causes one batch render instead of one
 * render per event. A shrinking stream (replay/reset) flushes immediately.
 */
export function useBatchedScrapeReveal(
  events: ScrapeTraceEvent[] | undefined,
  queued: boolean,
  flushMs: number = COUNTER_FLUSH_MS,
): ScrapeReveal {
  const [committed, setCommitted] = useState<ScrapeTraceEvent[] | undefined>(() => events);

  useEffect(() => {
    const total = events?.length ?? 0;
    // Growing streams stay buffered; the interval below flushes them.
    // A shrinking stream means replay/reset — catch up immediately.
    if (total >= (committed?.length ?? 0)) return;
    setCommitted(events);
  }, [events, committed]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCommitted((current) => {
        const total = events?.length ?? 0;
        if (total <= (current?.length ?? 0)) return current;
        return total > 0 ? [...(events as ScrapeTraceEvent[])] : events;
      });
    }, flushMs);
    return () => window.clearInterval(id);
  }, [events, flushMs]);

  return useMemo(() => resolveScrapeReveal(committed, queued), [committed, queued]);
}

/**
 * Emphasis latch for the film counter: turns threshold crossings into a short-lived
 * milestone the view can hang an animation on. Cleans up its own timer so a fast
 * replay never leaves a stale emphasis behind.
 */
export function useCountEmphasis(filmsFound: number | null, beat: ScrapeWaitBeat): CountMilestone | null {
  const [milestone, setMilestone] = useState<CountMilestone | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const prevBeatRef = useRef<ScrapeWaitBeat>(beat);
  const observedRef = useRef(false);

  useEffect(() => {
    let next: CountMilestone | null = null;
    if (filmsFound != null) {
      // A count already present at mount is context, not an event — stay quiet.
      next = observedRef.current ? resolveCountMilestone(prevCountRef.current, filmsFound) : null;
      prevCountRef.current = filmsFound;
      observedRef.current = true;
    }
    if (!next && observedRef.current && filmsFound != null
      && prevBeatRef.current === 'films' && beat !== 'films' && beat !== 'queued') {
      next = 'done';
    }
    prevBeatRef.current = beat;
    if (!next) return;
    setMilestone(next);
    const id = window.setTimeout(() => setMilestone(null), EMPHASIS_MS);
    return () => window.clearTimeout(id);
  }, [filmsFound, beat]);

  return milestone;
}
