import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { User, Star } from 'lucide-react';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';

type Props = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

/* Palette 2 — coolors.co/palette/ffbe0b-fb5607-ff006e-8338ec-3a86ff */
const AMBER = '#FFBE0B';
const ORANGE = '#FB5607';
const PINK = '#FF006E';
const PURPLE = '#8338EC';
const BLUE = '#3A86FF';
const BG = '#0D0D12';
const SURFACE = '#18181F';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const normalizeTmdb = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return getTmdbImageUrl(url) ?? undefined;
  return url;
};

function StatRow({ label, value, unit, color }: { label: string; value: React.ReactNode; unit?: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <span className="uppercase tracking-[0.16em] text-[11px] font-bold" style={{ color: TEXT_SECONDARY }}>
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-[22px] font-black" style={{ color }}>
          {value}
        </span>
        {unit && (
          <span className="text-[11px] font-semibold" style={{ color: TEXT_SECONDARY }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function PosterStrip({ films }: { films?: ShareCardData['topFilms'] }) {
  const list = (films || []).slice(0, 5);
  if (list.length === 0) return null;
  return (
    <div className="flex gap-2">
      {list.map((f, i) => {
        const posterUrl = f.posterPath ? getTmdbImageUrl(f.posterPath, 'w185') : null;
        return (
          <div
            key={`${f.title}-${i}`}
            className="relative shrink-0 overflow-hidden"
            style={{ width: 56, aspectRatio: '2 / 3', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}` }}
          >
            {posterUrl ? (
              <Image src={posterUrl} alt={f.title} fill sizes="56px" className="object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[9px] font-bold text-center px-1" style={{ color: TEXT_SECONDARY }}>
                {f.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DossierShareCard = React.forwardRef<HTMLDivElement, Props>(
  function DossierShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';
    const [directorBroken, setDirectorBroken] = useState(false);
    const directorUrl = useMemo(() => normalizeTmdb(data.favoriteDirector.headshotUrl), [data.favoriteDirector.headshotUrl]);

    const directorPortrait = (
      <div className="relative overflow-hidden shrink-0" style={{ width: '100%', height: '100%', borderRadius: 18, background: SURFACE }}>
        {directorUrl && !directorBroken ? (
          <Image
            src={directorUrl}
            alt={data.favoriteDirector.name}
            fill
            className="object-cover object-center"
            priority
            crossOrigin="anonymous"
            onError={() => setDirectorBroken(true)}
            sizes="260px"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center" style={{ color: TEXT_SECONDARY }}>
            <User size={32} />
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}
        >
          <div className="uppercase tracking-[0.16em] text-[10px] font-bold" style={{ color: AMBER }}>
            Favorite Director
          </div>
          <div className="text-[22px] font-black text-white leading-tight mt-1">{data.favoriteDirector.name || 'Unknown'}</div>
          <div className="text-[11px]" style={{ color: TEXT_SECONDARY }}>
            {data.favoriteDirector.count} films directed
          </div>
        </div>
      </div>
    );

    const stats = (
      <div className="flex flex-col">
        <StatRow label="Films Watched" value={data.watchedFilms.toLocaleString()} color={ORANGE} />
        <StatRow label="Days Spent" value={data.spentDays} unit="days" color={PINK} />
        <StatRow label="Cinema Scale" value={data.cinemaScale.toFixed(0)} unit="/ 100" color={PURPLE} />
        <StatRow
          label="Top Rating"
          value={<span className="inline-flex items-center gap-1">{data.mostCommonRating}<Star size={14} fill={AMBER} stroke={AMBER} /></span>}
          color={AMBER}
        />
        <StatRow label="Peak Decade" value={data.peakDecade} unit={`${data.peakDecadeCount} films`} color={BLUE} />
      </div>
    );

    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={cx('w-[675px] h-[1200px] flex flex-col', className)}
          style={{ background: BG, color: '#fff', fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif' }}
        >
          <div className="px-9 pt-9 pb-2 flex items-center justify-between">
            <div className="uppercase tracking-[0.22em] text-[12px] font-bold" style={{ color: PINK }}>
              Letterboxd Wrapped
            </div>
            {data.username && (
              <div className="text-[12px] font-semibold" style={{ color: TEXT_SECONDARY }}>
                @{data.username}
              </div>
            )}
          </div>

          <div className="px-9 mt-3" style={{ height: 340, overflow: 'hidden' }}>
            {directorPortrait}
          </div>

          <div className="px-9 mt-6">{stats}</div>

          <div className="px-9 mt-6">
            <div className="uppercase tracking-[0.16em] text-[10px] font-bold mb-2" style={{ color: TEXT_SECONDARY }}>
              Top Films
            </div>
            <PosterStrip films={data.topFilms} />
          </div>

          <div className="flex-1" />
          <div className="text-center text-[10px] font-semibold tracking-[0.14em] uppercase pb-8" style={{ color: TEXT_SECONDARY }}>
            movieswrapped.com
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        data-export-root="true"
        className={cx('w-[1200px] h-[675px] grid grid-cols-12', className)}
        style={{ background: BG, color: '#fff', fontFamily: 'Avenir Next, Manrope, Segoe UI, system-ui, sans-serif' }}
      >
        <div className="col-span-4 p-8" style={{ height: '100%', overflow: 'hidden' }}>
          {directorPortrait}
        </div>
        <div className="col-span-8 flex flex-col justify-between py-9 pr-10">
          <div>
            <div className="uppercase tracking-[0.22em] text-[12px] font-bold" style={{ color: PINK }}>
              Letterboxd Wrapped
              {data.username && <span className="ml-3 font-medium normal-case tracking-normal" style={{ color: TEXT_SECONDARY }}>@{data.username}</span>}
            </div>
            {stats}
          </div>
          <div>
            <div className="uppercase tracking-[0.16em] text-[10px] font-bold mb-2" style={{ color: TEXT_SECONDARY }}>
              Top Films
            </div>
            <PosterStrip films={data.topFilms} />
            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mt-4" style={{ color: TEXT_SECONDARY }}>
              movieswrapped.com
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default DossierShareCard;
