'use client';

import { useEffect, useState } from 'react';

import { COMPACT_LAYOUT_MAX_PX } from '@/containers/results/section-layout';

function readCompact(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${COMPACT_LAYOUT_MAX_PX}px)`).matches;
}

/**
 * True when the viewport is in the 2-column Results composition
 * (below Tailwind `sm` / 640px). Read synchronously on the client so the
 * first paint already uses the compact item-count contract.
 */
export function useCompactLayout(): boolean {
  const [compact, setCompact] = useState(readCompact);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${COMPACT_LAYOUT_MAX_PX}px)`);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return compact;
}
