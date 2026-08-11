'use client';

import type { Slide } from './types';

type StoryProgressBarProps = {
  slides: Slide[];
  index: number;
  progress: number;
};

export function StoryProgressBar({ slides, index, progress }: StoryProgressBarProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-40 flex gap-1 p-3">
      {slides.map((slide, i) => (
        <div key={slide.key} className="h-0.5 flex-1 overflow-hidden bg-stone-700/70">
          {i < index && <div className="h-full w-full bg-amber-300" />}
          {i === index && (
            <div
              className="h-full bg-amber-300"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
