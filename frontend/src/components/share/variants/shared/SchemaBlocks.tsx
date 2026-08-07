import React from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../../types';

export function formatOrdinal(n: number): string {
  if (n === 100) return '100th';
  if (n === 300) return '300th';
  if (n === 500) return '500th';
  if (n === 750) return '750th';
  return `${n}th`;
}

export type WordmarkProps = {
  orientation?: ShareOrientation;
  className?: string;
  style?: React.CSSProperties;
};

export const Wordmark: React.FC<WordmarkProps> = ({
  orientation = 'horizontal',
  className = '',
  style,
}) => {
  const isVertical = orientation === 'vertical';
  const baseClass = isVertical
    ? 'absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold tracking-wider text-neutral-400/80 pointer-events-none'
    : 'absolute left-6 bottom-5 text-xs font-semibold tracking-wider text-neutral-400/80 pointer-events-none';

  return (
    <span className={`${baseClass} ${className}`} style={style}>
      movieswrapped.com
    </span>
  );
};

export type StatGridProps = {
  data: ShareCardData;
  containerClassName?: string;
  boxClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  subValueClassName?: string;
};

export const StatGrid: React.FC<StatGridProps> = ({
  data,
  containerClassName = 'grid grid-cols-4 gap-3 w-full',
  boxClassName = 'flex flex-col justify-between p-3 rounded-xl bg-white/5 border border-white/10',
  labelClassName = 'text-[11px] font-bold uppercase tracking-wider text-neutral-400',
  valueClassName = 'text-xl font-bold tabular-nums text-white',
  subValueClassName = 'text-xs text-neutral-400 font-normal',
}) => {
  const nicheScore = `%${Math.round(data.cinemaScale)}`;
  const topWord = data.topReviewWords?.[0];
  const reviewStat = topWord ? `"${topWord.word}" x${topWord.count}` : '—';
  const cinemaScaleStr = `${Math.round(data.cinemaScale)}/100`;
  const peakDecadeStr = data.peakDecade
    ? `${data.peakDecade}, ${data.peakDecadeCount} films`
    : '—';

  return (
    <div className={containerClassName}>
      <div className={boxClassName}>
        <span className={labelClassName}>Niche Score</span>
        <span className={valueClassName}>{nicheScore}</span>
      </div>

      <div className={boxClassName}>
        <span className={`${labelClassName} font-bold`}>Top Review Word</span>
        <span className={valueClassName}>{reviewStat}</span>
      </div>

      <div className={boxClassName}>
        <span className={labelClassName}>Cinema Scale</span>
        <span className={valueClassName}>{cinemaScaleStr}</span>
      </div>

      <div className={boxClassName}>
        <span className={labelClassName}>Peak Decade</span>
        <div className="flex flex-col">
          <span className={valueClassName}>{data.peakDecade || '—'}</span>
          {data.peakDecadeCount > 0 && (
            <span className={subValueClassName}>{data.peakDecadeCount} films</span>
          )}
        </div>
      </div>
    </div>
  );
};

export type MilestonesRowProps = {
  data: ShareCardData;
  containerClassName?: string;
  cardClassName?: string;
  labelClassName?: string;
  titleClassName?: string;
  yearClassName?: string;
};

export const MilestonesRow: React.FC<MilestonesRowProps> = ({
  data,
  containerClassName = 'grid grid-cols-4 gap-3 w-full',
  cardClassName = 'flex flex-col items-center p-2 rounded-xl bg-white/5 border border-white/10 text-center relative overflow-hidden',
  labelClassName = 'text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-1',
  titleClassName = 'text-xs font-semibold text-white line-clamp-1',
  yearClassName = 'text-[10px] text-neutral-400',
}) => {
  const milestones = data.milestones;
  if (!milestones || milestones.length === 0) return null;

  return (
    <div className={containerClassName}>
      {milestones.slice(0, 4).map((m) => {
        const posterUrl = m.posterPath ? getTmdbImageUrl(m.posterPath, 'w185') : null;
        return (
          <div key={`${m.ordinal}-${m.title}`} className={cardClassName}>
            <span className={labelClassName}>{formatOrdinal(m.ordinal)}</span>
            <div className="relative w-14 h-20 rounded-md overflow-hidden bg-white/10 mb-1 shrink-0">
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={m.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-neutral-500 p-1">
                  {m.title.slice(0, 3)}
                </div>
              )}
            </div>
            <span className={titleClassName}>{m.title}</span>
            {m.year && <span className={yearClassName}>{m.year}</span>}
          </div>
        );
      })}
    </div>
  );
};

export type VerticalStatStackProps = {
  data: ShareCardData;
  cardClassName?: string;
  personLabelClassName?: string;
  personNameClassName?: string;
  personSubClassName?: string;
  statBoxClassName?: string;
  statLabelClassName?: string;
  statValueClassName?: string;
};

export const VerticalStatStack: React.FC<VerticalStatStackProps> = ({
  data,
  cardClassName = 'flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10',
  personLabelClassName = 'text-xs font-bold uppercase tracking-wider text-violet-400',
  personNameClassName = 'text-xl font-bold text-white',
  personSubClassName = 'text-xs text-neutral-400',
  statBoxClassName = 'flex flex-col p-4 rounded-2xl bg-white/5 border border-white/10',
  statLabelClassName = 'text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1',
  statValueClassName = 'text-2xl font-bold text-white',
}) => {
  const crushHeadshot = getTmdbImageUrl(data.onScreenCrush.headshotUrl, 'w185');
  const directorHeadshot = getTmdbImageUrl(data.favoriteDirector.headshotUrl, 'w185');

  const topWord = data.topReviewWords?.[0];
  const reviewWordStat = topWord
    ? `you used "${topWord.word}" x${topWord.count}`
    : 'no review word stats available';
  const cinemaScaleStr = `${Math.round(data.cinemaScale)}/100`;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* On Screen Crush */}
      <div className={cardClassName}>
        <div className="relative w-20 h-28 rounded-xl overflow-hidden shrink-0 bg-white/10">
          {crushHeadshot ? (
            <Image
              src={crushHeadshot}
              alt={data.onScreenCrush.name}
              fill
              sizes="80px"
              className="object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">
              {data.onScreenCrush.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className={personLabelClassName}>on Screen Crush</span>
          <span className={personNameClassName}>{data.onScreenCrush.name}</span>
          <span className={personSubClassName}>{data.onScreenCrush.count} movies together</span>
        </div>
      </div>

      {/* Favorite Director */}
      <div className={cardClassName}>
        <div className="relative w-20 h-28 rounded-xl overflow-hidden shrink-0 bg-white/10">
          {directorHeadshot ? (
            <Image
              src={directorHeadshot}
              alt={data.favoriteDirector.name}
              fill
              sizes="80px"
              className="object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">
              {data.favoriteDirector.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className={personLabelClassName}>favorite Director</span>
          <span className={personNameClassName}>{data.favoriteDirector.name}</span>
          <span className={personSubClassName}>{data.favoriteDirector.count} movies directed</span>
        </div>
      </div>

      {/* Bottom two stat boxes side by side */}
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className={statBoxClassName}>
          <span className={statLabelClassName}>Review Stat</span>
          <span className={statValueClassName}>{reviewWordStat}</span>
        </div>
        <div className={statBoxClassName}>
          <span className={`${statLabelClassName} font-bold`}>Cinema Scale</span>
          <span className={statValueClassName}>{cinemaScaleStr}</span>
        </div>
      </div>
    </div>
  );
};
