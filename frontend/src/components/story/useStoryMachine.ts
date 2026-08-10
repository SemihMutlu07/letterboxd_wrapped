'use client';

import { useCallback, useEffect, useState } from 'react';

import type { StatsData } from '@/containers/results/sections/types';

/**
 * Explicit data-readiness state machine for the story:
 *   idle -> collecting -> ready -> playing
 *                     \-> error (bad payload)
 *
 * `collecting` covers both the first read tick and waiting for a late write to
 * sessionStorage (another tab / an analysis that lands after mount). A `storage`
 * event re-ingests, so late data recovers into `ready` without a reload.
 */

export type StoryPhase = 'idle' | 'collecting' | 'ready' | 'playing' | 'error';

const STORAGE_KEY = 'letterboxdStats';

export function useStoryMachine() {
  const [phase, setPhase] = useState<StoryPhase>('idle');
  const [stats, setStats] = useState<StatsData | null>(null);

  const ingest = useCallback(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      setPhase('error');
      return;
    }
    if (!saved) {
      setPhase('collecting');
      return;
    }
    try {
      setStats(JSON.parse(saved) as StatsData);
      // Late data must not knock an in-progress playback back to `ready`.
      setPhase((current) => (current === 'playing' ? 'playing' : 'ready'));
    } catch (error) {
      console.error('[story] failed to parse stored stats:', error);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    ingest();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) ingest();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [ingest]);

  const start = useCallback(() => {
    setPhase((current) => (current === 'ready' ? 'playing' : current));
  }, []);

  return { phase, stats, start };
}
