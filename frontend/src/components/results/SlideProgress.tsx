'use client';

import React from 'react';

interface SlideProgressProps {
  count: number;
  activeIndex: number;
  onJump: (index: number) => void;
}

export default function SlideProgress({ count, activeIndex, onJump }: SlideProgressProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex gap-1 px-3 pt-3 pb-2"
      style={{
        background: 'linear-gradient(to bottom, var(--theme-bg) 0%, transparent 100%)',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to slide ${i + 1} of ${count}`}
          onClick={() => onJump(i)}
          className="h-1 flex-1 min-w-0 rounded-full overflow-hidden"
          style={{ background: 'var(--theme-border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              background: 'var(--theme-accent)',
              width: i < activeIndex ? '100%' : i === activeIndex ? '100%' : '0%',
              opacity: i <= activeIndex ? 1 : 0,
            }}
          />
        </button>
      ))}
    </div>
  );
}
