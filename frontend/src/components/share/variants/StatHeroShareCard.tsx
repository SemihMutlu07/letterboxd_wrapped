import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, User } from 'lucide-react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';

/**
 * Stat Hero — same layout as Default, but stat numbers are significantly
 * larger and person tiles are visually reduced so the numbers dominate.
 */

type Props = { data: ShareCardData; className?: string; orientation?: ShareOrientation };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const Kicker: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={cx('uppercase tracking-[.16em] opacity-80 font-semibold text-[11px]', className)}>{children}</div>
);

const tileBase =
  'rounded-2xl shadow-lg backdrop-blur-sm relative overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-white/10';

const TONES = {
  indigo: 'bg-gradient-to-br from-blue-500/30 to-blue-700/25 border border-blue-500/35',
  pink: 'bg-gradient-to-r from-pink-500/28 via-rose-500/24 to-rose-600/24 border border-pink-500/40',
  orange: 'bg-orange-500/14 border border-orange-500/25',
  cyan: 'bg-cyan-500/14 border border-cyan-500/25',
  purple: 'bg-purple-500/14 border border-purple-500/25',
  yellow: 'bg-yellow-500/14 border border-yellow-500/25',
};

const StatHeroShareCard = React.forwardRef<HTMLDivElement, Props>(function StatHeroShareCard(
  { data, className = '', orientation = 'horizontal' },
  ref,
) {
  const isVertical = orientation === 'vertical';
  const [crushBroken, setCrushBroken] = useState(false);
  const [directorBroken, setDirectorBroken] = useState(false);

  const normalizeTmdb = (u?: string) => {
    if (!u) return undefined;
    if (u.startsWith('http')) return u;
    if (u.startsWith('/')) return getTmdbImageUrl(u) ?? undefined;
    return u;
  };

  const crushUrl = useMemo(() => normalizeTmdb(data.onScreenCrush.headshotUrl), [data.onScreenCrush.headshotUrl]);
  const directorUrl = useMemo(() => normalizeTmdb(data.favoriteDirector.headshotUrl), [data.favoriteDirector.headshotUrl]);

  /* ── person tile (compact) ── */
  const personTile = (
    url: string | undefined,
    broken: boolean,
    onError: () => void,
    alt: string,
    fallback: React.ReactNode,
    tone: string,
    kickerText: string,
    kickerClass: string,
    name: string,
    countText: string,
    imgW: number,
  ) => (
    <div className={cx(tileBase, tone, `grid grid-cols-[${imgW}px_1fr] items-stretch min-h-[0]`)}>
      <div className="p-3">
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '2/3', minHeight: 0 }}>
          {url && !broken ? (
            <Image src={url} alt={alt} fill className="object-cover object-[50%_10%]" priority crossOrigin="anonymous" onError={onError} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-white/70">{fallback}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/20 to-transparent" />
        </div>
      </div>
      <div className="p-4 pr-5 flex flex-col justify-center">
        <Kicker className={kickerClass}>{kickerText}</Kicker>
        <div className="mt-1 text-[28px] font-extrabold leading-tight line-clamp-1">{name || 'Unknown'}</div>
        <div className="mt-1 text-[17px] leading-snug opacity-85">{countText}</div>
      </div>
    </div>
  );

  if (isVertical) {
    return (
      <div
        ref={ref}
        className={cx('w-[630px] h-[1200px] bg-slate-900 text-white rounded-3xl p-12 grid grid-rows-[auto_1fr_auto] gap-6 font-sans', className)}
        style={{ fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif' }}
      >
        <div className="grid place-content-center -mb-2">
          <div className="text-[20px] font-bold opacity-90">Your Letterboxd Wrapped</div>
        </div>

        <div className="grid gap-5">
          {/* Person tiles — reduced */}
          <div className={cx(tileBase, TONES.pink, 'grid grid-cols-[120px_1fr] items-center p-5')}>
            <div className="relative w-[120px] h-[170px] rounded-2xl overflow-hidden isolate shrink-0">
              {crushUrl && !crushBroken ? (
                <Image src={crushUrl} alt={data.onScreenCrush.name || 'Crush'} fill className="object-cover object-[50%_15%]" priority crossOrigin="anonymous" onError={() => setCrushBroken(true)} sizes="120px" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70"><Heart className="w-8 h-8" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/15 to-transparent" />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/15 rounded-2xl" />
            </div>
            <div className="pl-5 pr-2 flex flex-col justify-center">
              <div className="uppercase tracking-[.18em] opacity-80 font-semibold text-[13px]">On-Screen Crush</div>
              <div className="mt-1 text-[28px] font-extrabold leading-tight line-clamp-1">{data.onScreenCrush.name || 'Unknown'}</div>
              <div className="mt-1 text-[18px] leading-snug opacity-85">{data.onScreenCrush.count} movies together</div>
            </div>
          </div>

          <div className={cx(tileBase, TONES.cyan, 'grid grid-cols-[120px_1fr] items-center p-5')}>
            <div className="relative w-[120px] h-[170px] rounded-2xl overflow-hidden isolate shrink-0">
              {directorUrl && !directorBroken ? (
                <Image src={directorUrl} alt={data.favoriteDirector.name || 'Director'} fill className="object-cover object-[50%_15%]" priority crossOrigin="anonymous" onError={() => setDirectorBroken(true)} sizes="120px" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/70"><User className="w-8 h-8" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-black/15 to-transparent" />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/15 rounded-2xl" />
            </div>
            <div className="pl-5 pr-2 flex flex-col justify-center">
              <div className="uppercase tracking-[.18em] opacity-80 font-semibold text-[13px]">Favorite Director</div>
              <div className="mt-1 text-[28px] font-extrabold leading-tight line-clamp-1">{data.favoriteDirector.name || 'Unknown'}</div>
              <div className="mt-1 text-[18px] leading-snug opacity-85">{data.favoriteDirector.count} movies</div>
            </div>
          </div>

          {/* Hero stats — HUGE */}
          <div className="grid grid-cols-2 gap-5">
            <div className={cx(tileBase, TONES.indigo, 'grid place-content-center text-center p-5 min-h-[170px]')}>
              <Kicker>YOU WATCHED</Kicker>
              <div className="mt-1 text-[78px] font-black tabular-nums leading-none">{data.watchedFilms.toLocaleString()}</div>
              <div className="mt-0.5 text-[18px] opacity-90 uppercase tracking-wider">Films</div>
            </div>
            <div className={cx(tileBase, TONES.pink, 'grid place-content-center text-center p-5 min-h-[170px]')}>
              <Kicker>YOU SPENT</Kicker>
              <div className="mt-1 text-[78px] font-black tabular-nums leading-none">{data.spentDays.toLocaleString()}</div>
              <div className="mt-0.5 text-[18px] opacity-90 uppercase tracking-wider">Days</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className={cx(tileBase, TONES.yellow, 'flex flex-col items-center justify-center text-center p-4 gap-1')}>
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px]">Rating</div>
              <div className="text-[38px] font-black tabular-nums text-yellow-400 leading-none">{data.mostCommonRating}★</div>
            </div>
            <div className={cx(tileBase, TONES.cyan, 'flex flex-col items-center justify-center text-center p-4 gap-1')}>
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px]">Cinema Scale</div>
              <div className="text-[36px] font-black tabular-nums text-cyan-400 leading-none">{data.cinemaScale.toFixed(1)}<span className="text-[12px] opacity-80">/100</span></div>
            </div>
            <div className={cx(tileBase, TONES.indigo, 'flex flex-col items-center justify-center text-center p-4 gap-1')}>
              <div className="uppercase tracking-[.10em] opacity-80 font-semibold text-[12px]">Avg Runtime</div>
              <div className="text-[38px] font-black tabular-nums text-blue-300 leading-none">{data.minutesAverage}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className={cx(tileBase, TONES.orange, 'flex flex-col items-center justify-center text-center p-5')}>
              <div className="text-[54px] font-black tabular-nums text-orange-500 leading-none">{data.timePercent}%</div>
              <div className="mt-1 text-[12px] opacity-80 tracking-wider">OF YOUR TIME WATCHING</div>
            </div>
            <div className={cx(tileBase, TONES.purple, 'flex flex-col items-center justify-center text-center p-5')}>
              <div className="text-[50px] font-black leading-none text-purple-300">{data.peakDecade}</div>
              <div className="mt-1 text-[12px] opacity-90">{data.peakDecadeCount.toLocaleString()} FILMS</div>
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    );
  }

  /* ── HORIZONTAL ── */
  return (
    <div
      ref={ref}
      className={cx('w-[1200px] h-[630px] bg-slate-900 text-white rounded-3xl p-8 grid grid-cols-12 gap-6 font-sans', className)}
      style={{ fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif' }}
    >
      {/* Left: person tiles (visually reduced) */}
      <div className="col-span-6 grid grid-rows-2 gap-4 auto-rows-fr">
        {personTile(crushUrl, crushBroken, () => setCrushBroken(true), data.onScreenCrush.name || 'Crush', <Heart className="w-14 h-14" />, TONES.pink, 'On-Screen Crush', 'text-pink-100/90', data.onScreenCrush.name, `${data.onScreenCrush.count} movies together`, 150)}
        {personTile(directorUrl, directorBroken, () => setDirectorBroken(true), data.favoriteDirector.name || 'Director', <User className="w-14 h-14" />, TONES.cyan, 'Favorite Director', 'text-cyan-100/90', data.favoriteDirector.name, `${data.favoriteDirector.count} movies`, 150)}
      </div>

      {/* Right: stats (DOMINANT) */}
      <div className="col-span-6 grid grid-rows-3 gap-4 auto-rows-fr">
        <div className="grid grid-cols-2 gap-4 auto-rows-fr">
          <div className={cx(tileBase, TONES.indigo, 'grid place-content-center text-center p-4')}>
            <Kicker>YOU WATCHED</Kicker>
            <div className="mt-1 text-[76px] font-black tabular-nums leading-none">{data.watchedFilms.toLocaleString()}</div>
            <div className="mt-1 text-sm opacity-85 uppercase tracking-[.12em]">Films</div>
          </div>
          <div className={cx(tileBase, TONES.pink, 'grid place-content-center text-center p-4')}>
            <Kicker>YOU SPENT</Kicker>
            <div className="mt-1 text-[76px] font-black tabular-nums leading-none">{data.spentDays.toLocaleString()}</div>
            <div className="mt-1 text-sm opacity-90 uppercase tracking-[.12em]">Days</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 auto-rows-fr">
          <div className={cx(tileBase, TONES.yellow, 'grid place-content-center text-center p-3')}>
            <Kicker>RATING</Kicker>
            <div className="mt-1 text-[36px] font-black tabular-nums text-yellow-400 leading-none">{data.mostCommonRating}★</div>
          </div>
          <div className={cx(tileBase, TONES.cyan, 'grid place-content-center text-center p-3')}>
            <Kicker>CINEMA SCALE</Kicker>
            <div className="mt-1 text-[34px] font-black tabular-nums text-cyan-400 whitespace-nowrap leading-none">{data.cinemaScale.toFixed(1)}/100</div>
          </div>
          <div className={cx(tileBase, TONES.indigo, 'grid place-content-center text-center p-3')}>
            <Kicker>AVG RUNTIME</Kicker>
            <div className="mt-1 text-[40px] font-black tabular-nums text-blue-300 leading-none">{data.minutesAverage}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 auto-rows-fr">
          <div className={cx(tileBase, TONES.orange, 'grid place-content-center text-center p-4')}>
            <div className="text-[56px] font-black tabular-nums text-orange-500 leading-none">{data.timePercent}%</div>
            <div className="mt-1 text-[11px] opacity-80 tracking-[.15em]">TIME WATCHING FILMS</div>
          </div>
          <div className={cx(tileBase, TONES.purple, 'grid place-content-center text-center p-4')}>
            <div className="text-[58px] font-black leading-none text-purple-300">{data.peakDecade}</div>
            <div className="mt-1 text-[11px] opacity-90 tracking-[.12em]">{data.peakDecadeCount.toLocaleString()} FILMS</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StatHeroShareCard;
