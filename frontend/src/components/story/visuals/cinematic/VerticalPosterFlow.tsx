'use client';

import { useReducedMotion } from 'framer-motion';

import type { StoryMedia } from '../../types';
import { usePosterField } from '../PosterFieldContext';
import { StoryImage } from '../StoryImage';

type VerticalPosterFlowProps = {
  posters: StoryMedia[];
  accent: string;
  columns?: 2 | 3;
  size?: 's' | 'm';
  paused?: boolean;
  className?: string;
  maxUnique?: number;
};

function splitColumns(items: StoryMedia[], count: number): StoryMedia[][] {
  const columns: StoryMedia[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => {
    columns[index % count]!.push(item);
  });
  return columns.filter((col) => col.length > 0);
}

/** Pad a short column, then duplicate once so a -50% translate loops cleanly. */
function loopColumn(items: StoryMedia[]): StoryMedia[] {
  if (items.length === 0) return [];
  const filled = [...items];
  while (filled.length < 4) filled.push(...items);
  return [...filled, ...filled];
}

export function VerticalPosterFlow({
  posters,
  accent,
  columns = 3,
  size = 'm',
  paused: pausedProp,
  className = '',
  maxUnique = 18,
}: VerticalPosterFlowProps) {
  const reduce = useReducedMotion();
  const field = usePosterField();
  const paused = pausedProp ?? field.paused ?? false;
  const unique = posters.slice(0, maxUnique);
  if (unique.length === 0) return null;

  const colCount = Math.min(columns, unique.length);
  const cols = splitColumns(unique, colCount);
  const posterWidth = size === 's' ? 'w-[min(100%,7.25rem)]' : 'w-[min(100%,9.25rem)]';
  const gap = size === 's' ? 'gap-2.5' : 'gap-3.5';

  if (reduce) {
    return (
      <div className={`flex h-full items-center justify-center ${gap} ${className}`}>
        {cols.map((col, colIndex) => (
          <div key={`static-${colIndex}`} className={`flex flex-col ${gap}`}>
            {col.slice(0, 4).map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className={`aspect-[2/3] ${posterWidth} overflow-hidden rounded-[12px] border border-white/10 bg-black shadow-lg`}
              >
                <StoryImage item={item} priority={colIndex === 0 && index < 2} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex h-full justify-center overflow-hidden ${gap} [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] ${className}`}
    >
      {cols.map((col, colIndex) => {
        const looped = loopColumn(col);
        return (
          <div key={`col-${colIndex}`} className="relative h-full overflow-hidden">
            <div
              className={`story-poster-flow flex flex-col ${gap} py-2`}
              style={{
                animationDuration: `${16 + colIndex * 5}s`,
                animationPlayState: paused ? 'paused' : 'running',
              }}
            >
              {looped.map((item, index) => (
                <div
                  key={`${item.url}-${index}`}
                  className={`aspect-[2/3] ${posterWidth} overflow-hidden rounded-[12px] border border-white/10 bg-black shadow-lg`}
                  style={{
                    boxShadow: colIndex === 0 && index === 0 ? `0 0 48px ${accent}40` : undefined,
                  }}
                >
                  <StoryImage item={item} priority={colIndex === 0 && index < 2} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
