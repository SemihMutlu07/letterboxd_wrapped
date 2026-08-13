'use client';

import type { StoryMedia } from '../../types';
import { VerticalPosterFlow } from './VerticalPosterFlow';

type PosterStreamProps = {
  posters: StoryMedia[];
  accent: string;
  /** When false, ambient loops pause (inactive slide / reduced work). */
  active: boolean;
  /** 0..1 how far into the reveal — drives entrance → ambient. */
  settle: number;
  className?: string;
};

/**
 * Compact vertical poster flow for person slides — sits beside the portrait.
 */
export function PosterStream({ posters, accent, active, settle, className = '' }: PosterStreamProps) {
  if (posters.length === 0) return null;

  return (
    <div
      className={`pointer-events-none h-full w-full ${className}`}
      style={{
        opacity: settle > 0 ? 1 : 0,
        transition: 'opacity 0.45s ease',
      }}
      aria-hidden={settle <= 0}
    >
      <VerticalPosterFlow
        posters={posters}
        accent={accent}
        columns={2}
        size="s"
        paused={!active}
        maxUnique={10}
      />
    </div>
  );
}
