'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, Variants } from 'framer-motion';
import { Heart, User } from 'lucide-react';
import { searchPerson } from '@/lib/api';
import { getTmdbImageUrl } from '@/lib/analytics';

export const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { 
      stiffness: 100 
    } 
  },
};

export const imgCache = new Map<string, string | null>();
// Development flag

let activeRequests = 0;
const MAX_CONCURRENT = 5;
const queue: Array<() => void> = [];
function acquire(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeRequests < MAX_CONCURRENT) {
        activeRequests += 1;
        resolve(() => {
          activeRequests = Math.max(0, activeRequests - 1);
          const next = queue.shift();
          if (next) next();
        });
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

export const StatCard: React.FC<{
  value: string | number;
  label: string;
  color?: string;
  size?: 'normal' | 'large';
}> = ({ value, label, color = 'text-white', size = 'normal' }) => (
  <motion.div
    variants={itemVariants}
    className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-4 md:p-6 hover:scale-[1.02] hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg h-full min-h-[120px] md:min-h-[140px] grid place-content-center text-center"
  >
    <div>
      <div
        className={`${
          size === 'large'
            ? 'text-[clamp(20px,4vw,40px)] md:text-[clamp(24px,2.5vw,36px)]'
            : 'text-[clamp(18px,3.5vw,28px)] md:text-[clamp(20px,2vw,32px)]'
        } font-black ${color} leading-tight tabular-nums`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="uppercase tracking-wider opacity-80 font-medium text-[11px] md:text-sm mt-1">
        {label}
      </div>
    </div>
  </motion.div>
);

export type CountItem = { name: string; count: number; profile_path?: string };

const splitName = (full: string) => {
  const s = (full || '').trim();
  const parts = s.split(/\s+/);
  if (s.length <= 16 || parts.length < 2) return { first: s, last: '' };
  const last = parts.pop()!;
  return { first: parts.join(' '), last };
};

export const DirectorCard: React.FC<{ director: CountItem; rank: number }> = ({ director, rank }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { first, last } = useMemo(() => splitName(director?.name || ''), [director?.name]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setIsVisible(true)),
      { rootMargin: '100px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let releaseFn: (() => void) | null = null;
    let released = false;

    const fetchDirectorImage = async () => {
      if (!director?.name || !isVisible) return;

      const cacheKey = `director-${director.name}`;
      if (imgCache.has(cacheKey)) {
        const cached = imgCache.get(cacheKey);
        if (cached) setImageUrl(cached);
        return;
      }

      setImageLoading(true);
      try {
        releaseFn = await acquire();
        const data = await searchPerson(director.name, 'director');
        if (data.found && data.url) {
          imgCache.set(cacheKey, data.url);
          setImageUrl(data.url);
        } else {
          imgCache.set(cacheKey, null);
        }
              } catch {
          // Silent error handling
          imgCache.set(`director-${director.name}`, null);
        } finally {
        setImageLoading(false);
        try {
          if (releaseFn) releaseFn();
          released = true;
        } catch {}
      }
    };

    const t = setTimeout(fetchDirectorImage, rank * 100);
    return () => {
      clearTimeout(t);
      if (!released && releaseFn) try { releaseFn(); } catch {}
    };
  }, [director?.name, rank, isVisible]);

  const getRankColor = (n: number) =>
    n === 1
      ? 'text-yellow-500 bg-yellow-500/10'
      : n === 2
      ? 'text-gray-300 bg-gray-300/10'
      : n === 3
      ? 'text-orange-500 bg-orange-500/10'
      : 'text-slate-400 bg-slate-400/10';

  if (!director) return null;

  return (
    <motion.div
      ref={cardRef}
      variants={itemVariants}
      className="grid grid-cols-[56px_72px_1fr] items-center gap-4 p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl hover:bg-slate-800/80 hover:border-slate-600/60 transition-all duration-200 shadow-lg min-h-[96px]"
    >
      <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${getRankColor(rank)}`}>
        #{rank}
      </div>

      <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-slate-700 border-2 border-slate-600/50">
        {imageLoading ? (
          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 animate-pulse" />
        ) : imageUrl ? (
          <Image src={imageUrl} alt={director?.name ?? 'director'} width={72} height={72} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <User />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="text-lg font-semibold text-white truncate leading-tight">{first || 'Unknown'}</div>
        {last && <div className="text-white/90 font-semibold truncate -mt-0.5">{last}</div>}
        <div className="text-cyan-400 font-medium tabular-nums mt-0.5">
          {typeof director?.count === 'number' ? director.count.toLocaleString() : director?.count} films
        </div>
      </div>
    </motion.div>
  );
};

export const ActorCard: React.FC<{
  actor: CountItem;
  rank: number;
  variant?: 'main' | 'small';
  topCount?: number;
}> = ({ actor, rank, variant = 'small', topCount }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { rootMargin: '120px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let releaseFn: (() => void) | null = null;
    let released = false;

    const fetchActorImage = async () => {
      if (!actor?.name || !visible) return;

      const cacheKey = `actor-${actor.name}`;
      if (imgCache.has(cacheKey)) {
        const cached = imgCache.get(cacheKey);
        if (cached) setImageUrl(cached);
        return;
      }

      setImageLoading(true);
      try {
        releaseFn = await acquire();

          if ((actor as { profile_path?: string })?.profile_path) {
              const fallbackUrl = getTmdbImageUrl((actor as { profile_path?: string }).profile_path);
          imgCache.set(cacheKey, fallbackUrl);
          setImageUrl(fallbackUrl);
          return;
        }

        const data = await searchPerson(actor.name, 'actor');
        if (data.found && data.url) {
          imgCache.set(cacheKey, data.url);
          setImageUrl(data.url);
        } else {
          imgCache.set(cacheKey, null);
        }
              } catch {
          // Silent error handling
          imgCache.set(`actor-${actor.name}`, null);
        } finally {
        setImageLoading(false);
        try {
          if (releaseFn) releaseFn();
          released = true;
        } catch {}
      }
    };

    const t = setTimeout(fetchActorImage, rank * 150);
    return () => {
      clearTimeout(t);
      if (!released && releaseFn) try { releaseFn(); } catch {}
    };
  }, [actor?.name, rank, visible, actor]);

  if (!actor) return null;

  if (variant === 'main') {
    return (
      <div
        ref={ref}
        className="lg:col-span-2 flex items-center gap-4 md:gap-6 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-2xl p-6"
      >
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-2 border-pink-400/40 bg-slate-700 flex-shrink-0">
          {imageLoading ? (
            <div className="w-full h-full bg-gradient-to-br from-pink-600/30 to-rose-600/30 animate-pulse" />
          ) : imageUrl ? (
            <Image src={imageUrl} alt={actor.name} width={128} height={128} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300" aria-label={actor.name}>
              <Heart />
            </div>
          )}
        </div>
        <div>
          <div className="text-2xl md:text-4xl font-black text-pink-400">{actor.name}</div>
          <div className="text-sm md:text-base opacity-80 text-pink-200">{actor.count} films together</div>
          <div className="text-lg font-semibold text-pink-300 mt-1">#1 Favorite</div>
        </div>
      </div>
    );
  }

  const pct = topCount ? Math.round(((actor.count ?? 0) / topCount) * 100) : 0;

  return (
    <div ref={ref} className="flex items-center gap-3 bg-slate-800/60 border border-slate-600/40 rounded-xl p-3 md:p-4 min-h-[64px]">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm md:text-base text-white line-clamp-1">
          #{rank} {actor.name}
        </div>
        <div className="text-xs text-slate-300 line-clamp-1 tabular-nums">
          {typeof actor.count === 'number' ? actor.count.toLocaleString() : actor.count} films
        </div>
        <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-pink-500/60 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
};


