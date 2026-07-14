'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, Variants } from 'framer-motion';
import {
  Heart,
  User,
  Zap,
  Compass,
  Sparkles,
  Laugh,
  Fingerprint,
  Film,
  Drama,
  Users,
  Wand2,
  Landmark,
  Skull,
  Music,
  Search,
  Rocket,
  Swords,
  Mountain,
  Tv,
  type LucideIcon,
} from 'lucide-react';
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
const MAX_CONCURRENT = 8;
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
  onClick?: () => void;
}> = React.memo(function StatCard({ value, label, color = 'text-white', size = 'normal', onClick }) {
  return (
  <motion.div
    variants={itemVariants}
    onClick={onClick}
    className={`bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-4 md:p-6 transition-all duration-200 shadow-lg h-full min-h-[120px] md:min-h-[140px] grid place-content-center text-center ${
      onClick ? 'cursor-pointer hover:scale-[1.04] hover:bg-slate-800/90 hover:border-slate-500/60 active:scale-[0.97]' : 'hover:scale-[1.02] hover:bg-slate-800/80 hover:border-slate-600/60'
    }`}
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
});

const GENRE_STYLES: Record<string, { bg: string; border: string; text: string; hoverBg: string; ring: string; soft: string; icon: LucideIcon }> = {
  action: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500', hoverBg: 'hover:bg-red-500/20', ring: 'hover:ring-red-400/30', soft: 'text-red-300/70', icon: Zap },
  adventure: { bg: 'bg-lime-500/10', border: 'border-lime-500/20', text: 'text-lime-500', hoverBg: 'hover:bg-lime-500/20', ring: 'hover:ring-lime-400/30', soft: 'text-lime-300/70', icon: Compass },
  animation: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-500', hoverBg: 'hover:bg-sky-500/20', ring: 'hover:ring-sky-400/30', soft: 'text-sky-300/70', icon: Sparkles },
  comedy: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-500', hoverBg: 'hover:bg-yellow-500/20', ring: 'hover:ring-yellow-400/30', soft: 'text-yellow-300/70', icon: Laugh },
  crime: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300', hoverBg: 'hover:bg-slate-500/20', ring: 'hover:ring-slate-400/30', soft: 'text-slate-400/70', icon: Fingerprint },
  documentary: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-500', hoverBg: 'hover:bg-teal-500/20', ring: 'hover:ring-teal-400/30', soft: 'text-teal-300/70', icon: Film },
  drama: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500', hoverBg: 'hover:bg-purple-500/20', ring: 'hover:ring-purple-400/30', soft: 'text-purple-300/70', icon: Drama },
  family: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-500', hoverBg: 'hover:bg-green-500/20', ring: 'hover:ring-green-400/30', soft: 'text-green-300/70', icon: Users },
  fantasy: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-500', hoverBg: 'hover:bg-violet-500/20', ring: 'hover:ring-violet-400/30', soft: 'text-violet-300/70', icon: Wand2 },
  history: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500', hoverBg: 'hover:bg-amber-500/20', ring: 'hover:ring-amber-400/30', soft: 'text-amber-300/70', icon: Landmark },
  horror: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500', hoverBg: 'hover:bg-rose-500/20', ring: 'hover:ring-rose-400/30', soft: 'text-rose-300/70', icon: Skull },
  music: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', text: 'text-fuchsia-500', hoverBg: 'hover:bg-fuchsia-500/20', ring: 'hover:ring-fuchsia-400/30', soft: 'text-fuchsia-300/70', icon: Music },
  musical: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20', text: 'text-fuchsia-500', hoverBg: 'hover:bg-fuchsia-500/20', ring: 'hover:ring-fuchsia-400/30', soft: 'text-fuchsia-300/70', icon: Music },
  mystery: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-500', hoverBg: 'hover:bg-indigo-500/20', ring: 'hover:ring-indigo-400/30', soft: 'text-indigo-300/70', icon: Search },
  romance: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500', hoverBg: 'hover:bg-pink-500/20', ring: 'hover:ring-pink-400/30', soft: 'text-pink-300/70', icon: Heart },
  'science fiction': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-500', hoverBg: 'hover:bg-cyan-500/20', ring: 'hover:ring-cyan-400/30', soft: 'text-cyan-300/70', icon: Rocket },
  'sci-fi': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-500', hoverBg: 'hover:bg-cyan-500/20', ring: 'hover:ring-cyan-400/30', soft: 'text-cyan-300/70', icon: Rocket },
  thriller: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500', hoverBg: 'hover:bg-orange-500/20', ring: 'hover:ring-orange-400/30', soft: 'text-orange-300/70', icon: Fingerprint },
  war: { bg: 'bg-stone-500/10', border: 'border-stone-500/20', text: 'text-stone-300', hoverBg: 'hover:bg-stone-500/20', ring: 'hover:ring-stone-400/30', soft: 'text-stone-300/70', icon: Swords },
  western: { bg: 'bg-orange-700/10', border: 'border-orange-700/20', text: 'text-orange-400', hoverBg: 'hover:bg-orange-700/20', ring: 'hover:ring-orange-500/30', soft: 'text-orange-300/70', icon: Mountain },
  'tv movie': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500', hoverBg: 'hover:bg-blue-500/20', ring: 'hover:ring-blue-400/30', soft: 'text-blue-300/70', icon: Tv },
};

const DEFAULT_GENRE_STYLE = { bg: 'bg-slate-800/60', border: 'border-slate-700/60', text: 'text-purple-500', hoverBg: 'hover:bg-slate-800/90', ring: 'hover:ring-purple-400/30', soft: 'text-purple-300/70', icon: Drama };

export const getGenreStyle = (genre: string) => GENRE_STYLES[(genre || '').trim().toLowerCase()] ?? DEFAULT_GENRE_STYLE;

export const GenreStatCard: React.FC<{
  value: string;
  label: string;
  onClick?: () => void;
}> = React.memo(function GenreStatCard({ value, label, onClick }) {
  const style = getGenreStyle(value);
  const Icon = style.icon;
  return (
    <motion.div
      variants={itemVariants}
      onClick={onClick}
      title={value}
      aria-label={`${label}: ${value}`}
      className={`${style.bg} backdrop-blur-sm border ${style.border} rounded-2xl p-4 md:p-6 transition-all duration-200 shadow-lg h-full min-h-[120px] md:min-h-[140px] grid place-content-center text-center ${
        onClick ? `cursor-pointer hover:scale-[1.04] ${style.hoverBg} active:scale-[0.97]` : `hover:scale-[1.02] ${style.hoverBg}`
      }`}
    >
      <div className="flex flex-col items-center">
        <Icon className={`w-9 h-9 md:w-12 md:h-12 ${style.text} mb-2`} strokeWidth={1.75} />
        <div className="uppercase tracking-wider opacity-80 font-medium text-[11px] md:text-sm">
          {label}
        </div>
      </div>
    </motion.div>
  );
});

export type CountItem = { name: string; count: number; profile_path?: string };

const splitName = (full: string) => {
  const s = (full || '').trim();
  const parts = s.split(/\s+/);
  if (s.length <= 16 || parts.length < 2) return { first: s, last: '' };
  const last = parts.pop()!;
  return { first: parts.join(' '), last };
};

export const DirectorCard: React.FC<{ director: CountItem; rank: number }> = React.memo(function DirectorCard({ director, rank }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
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
      if (!director?.name || !isVisible) {
        if (director?.name) console.warn(`[DirectorCard] Not visible, skipping fetch for ${director.name}`);
        return;
      }

      const cacheKey = `director-${director.name}`;
      const profileUrl = getTmdbImageUrl(director.profile_path);
      if (profileUrl) {
        imgCache.set(cacheKey, profileUrl);
        setImageError(false);
        setImageUrl(profileUrl);
        return;
      }

      if (!director.profile_path) {
        console.debug(`[DirectorCard] No profile_path for ${director.name}`);
      }

      if (imgCache.has(cacheKey)) {
        const cached = imgCache.get(cacheKey);
        if (cached) {
          setImageError(false);
          setImageUrl(cached);
        } else {
          console.debug(`[DirectorCard] Cached null for ${director.name}, skipping searchPerson`);
          setImageError(false);
          setImageUrl(null);
        }
        return;
      }

      if (released) return;
      setImageLoading(true);
      try {
        releaseFn = await acquire();
        const data = await searchPerson(director.name, 'director');
        if (data.found && data.url) {
          const proxyUrl = getTmdbImageUrl(data.url);
          imgCache.set(cacheKey, proxyUrl);
          setImageError(false);
          setImageUrl(proxyUrl);
        } else {
          console.debug(`[DirectorCard] searchPerson no result for ${director.name}:`, data);
          imgCache.set(cacheKey, null);
          setImageUrl(null);
        }
      } catch (err: any) {
        console.error(`[DirectorCard] searchPerson error for ${director.name}:`, err?.message || err);
        imgCache.set(`director-${director.name}`, null);
        setImageUrl(null);
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
  }, [director?.name, director?.profile_path, rank, isVisible]);

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
        ) : imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={director?.name ?? 'director'}
            width={72}
            height={72}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error(`[DirectorCard] Image failed for ${director?.name}:`, imageUrl, e);
              imgCache.set(`director-${director.name}`, null);
              setImageUrl(null);
              setImageError(true);
            }}
            onLoad={() => setImageError(false)}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-slate-100/50"
            style={{ background: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)` }}
          >
            <User size={32} strokeWidth={1.5} />
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
});

export const ActorCard: React.FC<{
  actor: CountItem;
  rank: number;
  variant?: 'main' | 'small';
  topCount?: number;
}> = React.memo(function ActorCard({ actor, rank, variant = 'small', topCount }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
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
      if (!actor?.name || !visible) {
        if (actor?.name) console.warn(`[ActorCard] Not visible, skipping fetch for ${actor.name}`);
        return;
      }

      const cacheKey = `actor-${actor.name}`;
      const profileUrl = getTmdbImageUrl(actor.profile_path);
      if (profileUrl) {
        imgCache.set(cacheKey, profileUrl);
        setImageError(false);
        setImageUrl(profileUrl);
        return;
      }

      if (!actor.profile_path) {
        console.debug(`[ActorCard] No profile_path for ${actor.name}`);
      }

      if (imgCache.has(cacheKey)) {
        const cached = imgCache.get(cacheKey);
        if (cached) {
          setImageError(false);
          setImageUrl(cached);
        } else {
          console.debug(`[ActorCard] Cached null for ${actor.name}, skipping searchPerson`);
          setImageError(false);
          setImageUrl(null);
        }
        return;
      }

      if (released) return;
      setImageLoading(true);
      try {
        releaseFn = await acquire();

        const data = await searchPerson(actor.name, 'actor');
        if (data.found && data.url) {
          const proxyUrl = getTmdbImageUrl(data.url);
          imgCache.set(cacheKey, proxyUrl);
          setImageError(false);
          setImageUrl(proxyUrl);
        } else {
          console.debug(`[ActorCard] searchPerson no result for ${actor.name}:`, data);
          imgCache.set(cacheKey, null);
          setImageUrl(null);
        }
      } catch (err: any) {
        console.error(`[ActorCard] searchPerson error for ${actor.name}:`, err?.message || err);
        imgCache.set(`actor-${actor.name}`, null);
        setImageUrl(null);
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
  }, [actor?.name, actor?.profile_path, rank, visible]);

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
          ) : imageUrl && !imageError ? (
            <Image
              src={imageUrl}
              alt={actor.name}
              width={128}
              height={128}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error(`[ActorCard] Image failed for ${actor.name}:`, imageUrl, e);
                imgCache.set(`actor-${actor.name}`, null);
                setImageUrl(null);
                setImageError(true);
              }}
              onLoad={() => setImageError(false)}
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center text-pink-200/40"
              style={{ background: `linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)` }}
              aria-label={actor.name}
            >
              <Heart size={48} strokeWidth={1.5} fill="currentColor" className="opacity-20" />
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
});
