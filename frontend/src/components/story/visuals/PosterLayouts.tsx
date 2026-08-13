'use client';

import { motion, useReducedMotion } from 'framer-motion';

import type { StoryMedia } from '../types';
import { usePosterField } from './PosterFieldContext';
import { StoryImage } from './StoryImage';
import { PersonCinematicVisual } from './cinematic/PersonCinematicVisual';
import { VerticalPosterFlow } from './cinematic/VerticalPosterFlow';

function motionDuration(base: number, motionScale = 1): number {
  return base * motionScale;
}

export function PosterMosaic({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const { motionScale = 1 } = usePosterField();

  return (
    <div className="grid h-full auto-rows-max grid-cols-3 content-center gap-3">
      {media.slice(0, 9).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 40 : -30 }}
          animate={{ y: index % 2 ? -18 : 18 }}
          transition={{
            duration: motionDuration(7 + index, motionScale),
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
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
    <VerticalPosterFlow posters={media} accent={accent} columns={2} size="s" maxUnique={12} />
  );
}

/** @deprecated Prefer PersonCinematicVisual via visual="person" — kept for fallback. */
export function DirectorVisual({ media, accent, sequenceKey = 'director' }: { media: StoryMedia[]; accent: string; sequenceKey?: string }) {
  return <PersonCinematicVisual media={media} accent={accent} sequenceKey={sequenceKey} />;
}

export function PosterCascade({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const { density = 1 } = usePosterField();
  return (
    <VerticalPosterFlow
      posters={media}
      accent={accent}
      columns={density >= 0.9 ? 3 : 2}
      size="m"
      maxUnique={18}
    />
  );
}

export function PosterStrip({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const { motionScale = 1 } = usePosterField();

  return (
    <div className="flex h-full items-center gap-3 pl-[2%]">
      {media.slice(0, 7).map((item, index) => (
        <motion.div
          key={`${item.url}-${index}`}
          initial={{ y: index % 2 ? 46 : -28 }}
          animate={{ y: index % 2 ? -20 : 26 }}
          transition={{
            duration: motionDuration(6 + index * 0.4, motionScale),
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="relative aspect-[2/3] h-[70%] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-2xl"
          style={{ boxShadow: index === 0 ? `0 0 80px ${accent}66` : undefined }}
        >
          <StoryImage item={item} priority={index < 2} />
        </motion.div>
      ))}
    </div>
  );
}

/** Longest-review / hero focus — primary poster moderately left of far-right edge. */
export function HeroPoster({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const reduce = useReducedMotion();
  const { motionScale = 1 } = usePosterField();
  const [first, ...rest] = media;
  if (!first) return null;
  return (
    <div className="relative h-full">
      <div className="absolute left-[8%] top-1/2 aspect-[2/3] h-[78%] max-h-[82vh] -translate-y-1/2 md:left-[6%]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, rotate: 4 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: reduce ? 0 : 0.55, ease: 'easeOut' }}
          className="h-full w-full overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl"
          style={{ boxShadow: `0 0 100px ${accent}55` }}
        >
          <motion.div
            className="h-full w-full"
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: motionDuration(14, motionScale), repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <StoryImage item={first} priority />
          </motion.div>
        </motion.div>
      </div>
      <div className="absolute bottom-[6%] left-[36%] flex gap-3 md:left-[40%]">
        {rest.slice(0, 4).map((item, index) => (
          <motion.div
            key={`${item.url}-${index}`}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 0.85, y: reduce ? 0 : index % 2 ? -8 : 6 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    opacity: { delay: 0.35 + index * 0.08, duration: 0.4 },
                    y: {
                      duration: motionDuration(9 + index, motionScale),
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                    },
                  }
            }
            className="aspect-[2/3] h-28 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl md:h-36"
          >
            <StoryImage item={item} priority={index === 0} />
          </motion.div>
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
      <div
        className="absolute left-[8%] top-1/2 aspect-[2/3] h-[82%] -translate-y-1/2 overflow-hidden rounded-[30px] border border-white/15 bg-black shadow-2xl md:left-[6%]"
        style={{ boxShadow: `0 0 90px ${accent}55` }}
      >
        <StoryImage item={first} priority />
      </div>
      <div className="absolute bottom-8 left-[36%] grid grid-cols-3 gap-2.5 md:left-[40%]">
        {rest.slice(0, 6).map((item, index) => (
          <div key={`${item.url}-${index}`} className="aspect-[2/3] h-28 overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
            <StoryImage item={item} priority={index < 2} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Finale recap field — one portrait plus a calm poster stream. */
export function RecapVisual({ media, accent }: { media: StoryMedia[]; accent: string }) {
  const reduce = useReducedMotion();
  const { motionScale = 1 } = usePosterField();
  const profiles = media.filter((item) => item.type === 'profile').slice(0, 1);
  const posters = media.filter((item) => item.type === 'poster').slice(0, 8);
  const lead = profiles[0] ?? posters[0];
  const stream = posters.filter((item) => item.url !== lead?.url).slice(0, 8);
  if (!lead) return null;

  return (
    <div className="relative h-full">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={reduce ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -8, 0] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                y: { duration: motionDuration(16, motionScale), repeat: Infinity, ease: 'easeInOut' },
                opacity: { duration: 0.5 },
              }
        }
        className="absolute left-[6%] top-1/2 z-20 aspect-[2/3] h-[52%] -translate-y-1/2 overflow-hidden rounded-[24px] border border-white/15 bg-black shadow-2xl"
        style={{ boxShadow: `0 0 80px ${accent}55` }}
      >
        <StoryImage item={lead} priority />
      </motion.div>
      <div className="absolute inset-y-[4%] left-[38%] right-0">
        <VerticalPosterFlow posters={stream} accent={accent} columns={2} size="s" maxUnique={8} />
      </div>
    </div>
  );
}
