'use client';

import type { StoryMedia } from '../types';
import { StoryImage } from './StoryImage';

export function MobileMediaRail({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const visible = media.slice(0, 6);
  if (visible.length === 0) return null;
  return (
    <div className="mb-5 md:hidden">
      <div className="flex min-h-[118px] items-end justify-center gap-2 overflow-hidden px-1">
        {visible.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="relative aspect-[2/3] h-[112px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl"
            style={{
              transform: `translateY(${index % 2 === 0 ? 0 : 12}px) rotate(${(index - 2) * 2}deg)`,
              boxShadow: index === 0 ? `0 0 42px ${accent}55` : undefined,
            }}
          >
            <StoryImage item={item} priority={index < 2} />
          </div>
        ))}
      </div>
    </div>
  );
}
