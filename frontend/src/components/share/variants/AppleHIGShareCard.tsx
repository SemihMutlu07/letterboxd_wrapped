import React, { useMemo } from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';
import { StatGrid, VerticalStatStack, Wordmark } from './shared/SchemaBlocks';

type Props = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

const BG = '#000000';
const SURFACE = '#1C1C1E';
const BORDER = '#38383A';
const ACCENT = '#0A84FF';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#8E8E93';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const AppleHIGShareCard = React.forwardRef<HTMLDivElement, Props>(
  function AppleHIGShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';

    const crushUrl = useMemo(() => {
      if (!data.onScreenCrush.headshotUrl) return undefined;
      const url = getTmdbImageUrl(data.onScreenCrush.headshotUrl);
      return url === null ? undefined : url;
    }, [data.onScreenCrush.headshotUrl]);

    const directorUrl = useMemo(() => {
      if (!data.favoriteDirector.headshotUrl) return undefined;
      const url = getTmdbImageUrl(data.favoriteDirector.headshotUrl);
      return url === null ? undefined : url;
    }, [data.favoriteDirector.headshotUrl]);

    /* ═══════ VERTICAL (675×1200 - Schema A) ═══════ */
    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={cx('w-[675px] h-[1200px] relative overflow-hidden flex flex-col justify-between p-10 text-white', className)}
          style={{
            background: BG,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

          {/* Header line */}
          <div className="flex items-start justify-between z-10 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#8E8E93]">
                Your Letterboxd Wrapped
              </p>
              <h1 className="text-3xl font-black mt-1 text-white">
                you watched {data.watchedFilms} films so far
              </h1>
            </div>
            {data.username && (
              <span className="text-sm font-bold text-[#8E8E93]">@{data.username}</span>
            )}
          </div>

          {/* Vertical Stat Stack */}
          <div className="my-auto z-10">
            <VerticalStatStack
              data={data}
              cardClassName="flex items-center gap-5 p-4 rounded-2xl bg-[#1C1C1E] border border-[#38383A]"
              personLabelClassName="text-xs font-semibold uppercase tracking-wider text-[#0A84FF]"
              personNameClassName="text-2xl font-bold text-white"
              personSubClassName="text-xs text-[#8E8E93]"
              statBoxClassName="flex flex-col p-5 rounded-2xl bg-[#1C1C1E] border border-[#38383A]"
              statLabelClassName="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] mb-1"
              statValueClassName="text-2xl font-bold text-white tabular-nums"
            />
          </div>

          <Wordmark orientation="vertical" />
        </div>
      );
    }

    /* ═══════ HORIZONTAL (1200×675 - Schema A) ═══════ */
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={cx('w-[1200px] h-[675px] relative overflow-hidden flex flex-col justify-between p-10 text-white', className)}
        style={{
          background: BG,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />

        {/* Header line */}
        <div className="flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8E8E93]">
              Apple HIG Wrapped
            </p>
            <h1 className="text-4xl font-black mt-1 text-white">
              you watched {data.watchedFilms} films
            </h1>
          </div>
          {data.username && (
            <span className="text-sm font-bold text-[#8E8E93]">@{data.username}</span>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-8 my-auto z-10">
          {/* Stat Grid (7 cols) */}
          <div className="col-span-7 flex flex-col justify-center">
            <StatGrid
              data={data}
              containerClassName="grid grid-cols-2 gap-4 w-full"
              boxClassName="flex flex-col justify-between p-4 rounded-2xl bg-[#1C1C1E] border border-[#38383A]"
              labelClassName="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]"
              valueClassName="text-2xl font-bold text-white tabular-nums mt-2"
              subValueClassName="text-xs text-[#8E8E93] mt-1"
            />
          </div>

          {/* Two Person Cards (5 cols) */}
          <div className="col-span-5 flex flex-col gap-4 justify-center">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1C1C1E] border border-[#38383A]">
              <div className="relative w-16 h-24 rounded-xl overflow-hidden shrink-0 bg-white/10">
                {crushUrl ? (
                  <Image src={crushUrl} alt={data.onScreenCrush.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-[#8E8E93]">{data.onScreenCrush.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase text-[#0A84FF]">On-Screen Crush</span>
                <span className="text-lg font-bold text-white">{data.onScreenCrush.name}</span>
                <span className="text-xs text-[#8E8E93]">{data.onScreenCrush.count} films together</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1C1C1E] border border-[#38383A]">
              <div className="relative w-16 h-24 rounded-xl overflow-hidden shrink-0 bg-white/10">
                {directorUrl ? (
                  <Image src={directorUrl} alt={data.favoriteDirector.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-[#8E8E93]">{data.favoriteDirector.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase text-[#0A84FF]">Favorite Director</span>
                <span className="text-lg font-bold text-white">{data.favoriteDirector.name}</span>
                <span className="text-xs text-[#8E8E93]">{data.favoriteDirector.count} films directed</span>
              </div>
            </div>
          </div>
        </div>

        <Wordmark orientation="horizontal" />
      </div>
    );
  }
);

export default AppleHIGShareCard;
