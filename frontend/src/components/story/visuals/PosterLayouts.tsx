'use client';

import { motion } from 'framer-motion';

import type { StoryMedia } from '../types';
import { StoryImage } from './StoryImage';

export function PosterMosaic({ media, accent }: { media: StoryMedia[]; accent: string }) {
  return (
    <div className="grid h-full rotate-[-4deg] auto-rows-max grid-cols-3 content-center gap-3">
      {media.slice(0, 9).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 40 : -30 }}
          animate={{ y: index % 2 ? -18 : 18 }}
          transition={{ duration: 7 + index, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="relative aspect-[2/3] overflow-hidden rounded-[18px] border border-white/10 bg-stone-950 shadow-2xl"
          style={{ boxShadow: index === 4 ? `0 0 70px ${accent}55` : undefined }}
        >
          <StoryImage item={item} priority={index < 3} />
        </motion.div>
      ))}
    </div>
  );
}

export function PosterWall({ media, accent }: { media: StoryMedia[]; accent: string }) {
  return (
    <div className="grid h-full rotate-[2deg] grid-cols-[repeat(auto-fit,minmax(86px,1fr))] content-center gap-3">
      {media.map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: index % 2 ? 12 : -8 }}
          transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.55 }}
          className="aspect-[2/3] min-h-0 overflow-hidden rounded-[16px] border border-white/10 bg-black shadow-2xl"
          style={{ boxShadow: index === 0 ? `0 0 80px ${accent}66` : undefined }}
        >
          <StoryImage item={item} priority={index < 6} />
        </motion.div>
      ))}
    </div>
  );
}

export function DirectorVisual({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const profile = media.find((item) => item.type === 'profile');
  const films = media.filter((item) => item.type === 'poster');
  if (!profile) return <PosterWall media={films} accent={accent} />;
  return (
    <div className="grid h-full grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.8fr)] items-center gap-4 pr-[7vw]">
      <div
        className="aspect-[2/3] max-h-[76vh] overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-2xl"
        style={{ boxShadow: `0 0 90px ${accent}55` }}
      >
        <StoryImage item={profile} priority />
      </div>
      <div className="grid max-h-[76vh] grid-cols-2 gap-3 overflow-hidden">
        {films.map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index < 4} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PosterCascade({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const visible = media.slice(0, 42);
  if (visible.length === 0) return null;
  return (
    <div className="relative h-full rotate-[7deg]">
      <div className="absolute inset-y-[-8%] right-[4%] grid w-[82%] grid-cols-6 gap-3">
        {visible.map((item, index) => (
          <motion.div
            key={`${item.url}-${index}`}
            initial={{ y: index % 2 ? 36 : -44, x: index % 3 === 0 ? -20 : 16 }}
            animate={{ y: index % 2 ? -34 : 38, x: index % 3 === 0 ? 18 : -14 }}
            transition={{ duration: 7 + (index % 8), repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            className="aspect-[2/3] overflow-hidden rounded-[14px] border border-white/10 bg-black shadow-xl"
            style={{ boxShadow: index === 0 ? `0 0 90px ${accent}66` : undefined }}
          >
            <StoryImage item={item} priority={index < 10} />
          </motion.div>
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/45 to-transparent" />
    </div>
  );
}

export function PosterStrip({ media, accent }: { media: StoryMedia[]; accent: string }) {
  return (
    <div className="flex h-full rotate-[5deg] items-center gap-4">
      {media.slice(0, 7).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 46 : -28 }}
          animate={{ y: index % 2 ? -20 : 26 }}
          transition={{ duration: 6 + index * 0.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          className="relative aspect-[2/3] h-[70%] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl"
          style={{ boxShadow: index === 0 ? `0 0 80px ${accent}66` : undefined }}
        >
          <StoryImage item={item} priority={index < 2} />
        </motion.div>
      ))}
    </div>
  );
}

export function HeroPoster({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const [first, ...rest] = media;
  if (!first) return null;
  return (
    <div className="relative h-full">
      <div className="absolute right-[20%] top-1/2 aspect-[2/3] h-[82%] -translate-y-1/2 rotate-[3deg] overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl" style={{ boxShadow: `0 0 100px ${accent}55` }}>
        <StoryImage item={first} priority />
      </div>
      <div className="absolute bottom-0 right-0 flex gap-3">
        {rest.slice(0, 4).map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] h-40 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortraitStack({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const [first, ...rest] = media;
  if (!first) return null;
  return (
    <div className="relative h-full">
      <div className="absolute right-[24%] top-1/2 aspect-[2/3] h-[82%] -translate-y-1/2 overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-2xl" style={{ boxShadow: `0 0 90px ${accent}55` }}>
        <StoryImage item={first} priority />
      </div>
      <div className="absolute bottom-8 right-4 grid grid-cols-3 gap-3">
        {rest.slice(0, 6).map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] h-28 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index < 2} />
          </div>
        ))}
      </div>
    </div>
  );
}
