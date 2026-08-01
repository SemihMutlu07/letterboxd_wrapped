import React, { useMemo } from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';
import { StatGrid, VerticalStatStack, Wordmark } from './shared/SchemaBlocks';

type Variant3ShareCardProps = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

const CREAM = '#F5F0EB';
const CHARCOAL = '#1A1A1A';
const SECONDARY = '#666666';
const LB_GREEN = '#00c030';
const NAVY = '#1B2838';
const TILE_BG = '#FFFFFF';
const TILE_BORDER = '#E5E0DB';

const Variant3ShareCard = React.forwardRef<HTMLDivElement, Variant3ShareCardProps>(
  function Variant3ShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
    const isVertical = orientation === 'vertical';

    const crushUrl = useMemo(
      () => (data.onScreenCrush.headshotUrl ? getTmdbImageUrl(data.onScreenCrush.headshotUrl) ?? undefined : undefined),
      [data.onScreenCrush.headshotUrl]
    );
    const directorUrl = useMemo(
      () => (data.favoriteDirector.headshotUrl ? getTmdbImageUrl(data.favoriteDirector.headshotUrl) ?? undefined : undefined),
      [data.favoriteDirector.headshotUrl]
    );

    /* ═══════ VERTICAL (675×1200 - Schema A) ═══════ */
    if (isVertical) {
      return (
        <div
          ref={ref}
          data-export-root="true"
          className={`w-[675px] h-[1200px] relative overflow-hidden flex flex-col justify-between p-10 text-[${CHARCOAL}] ${className}`}
          style={{ backgroundColor: CREAM, fontFamily: 'Georgia, serif' }}
        >
          {/* Top Header */}
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-xs uppercase tracking-widest font-sans text-[${SECONDARY}]" style={{ color: SECONDARY }}>
                Your Letterboxd Wrapped
              </p>
              <h1 className="text-3xl font-bold mt-1 text-[${CHARCOAL}]" style={{ color: CHARCOAL }}>
                you watched {data.watchedFilms} films so far
              </h1>
            </div>
            {data.username && <span className="text-sm font-sans font-semibold text-[${SECONDARY}]" style={{ color: SECONDARY }}>@{data.username}</span>}
          </div>

          {/* Vertical Stat Stack */}
          <div className="my-auto z-10">
            <VerticalStatStack
              data={data}
              cardClassName="flex items-center gap-4 p-4 rounded-xl border bg-white border-[#E5E0DB]"
              personLabelClassName="text-xs font-bold uppercase tracking-wider font-sans text-[#00c030]"
              personNameClassName="text-xl font-bold text-[#1A1A1A]"
              personSubClassName="text-xs text-[#666666] font-sans"
              statBoxClassName="flex flex-col p-4 rounded-xl border bg-white border-[#E5E0DB]"
              statLabelClassName="text-xs font-bold uppercase tracking-wider font-sans text-[#666666] mb-1"
              statValueClassName="text-2xl font-bold text-[#1B2838] tabular-nums font-sans"
            />
          </div>

          <Wordmark orientation="vertical" className="text-[#666666]" />
        </div>
      );
    }

    /* ═══════ HORIZONTAL (1200×675 - Schema A) ═══════ */
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={`w-[1200px] h-[675px] relative overflow-hidden flex flex-col justify-between p-10 ${className}`}
        style={{ backgroundColor: CREAM, fontFamily: 'Georgia, serif' }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between z-10">
          <div>
            <p className="text-xs uppercase tracking-widest font-sans" style={{ color: SECONDARY }}>
              Variant 3 Wrapped
            </p>
            <h1 className="text-4xl font-bold mt-1" style={{ color: CHARCOAL }}>
              you watched {data.watchedFilms} films
            </h1>
          </div>
          {data.username && <span className="text-sm font-sans font-semibold" style={{ color: SECONDARY }}>@{data.username}</span>}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-8 my-auto z-10">
          {/* Stat Grid (7 cols) */}
          <div className="col-span-7 flex flex-col justify-center">
            <StatGrid
              data={data}
              containerClassName="grid grid-cols-2 gap-4 w-full"
              boxClassName="flex flex-col justify-between p-4 rounded-xl border bg-white border-[#E5E0DB]"
              labelClassName="text-xs font-bold uppercase tracking-wider font-sans text-[#666666]"
              valueClassName="text-2xl font-bold text-[#1B2838] tabular-nums mt-2 font-sans"
              subValueClassName="text-xs text-[#666666] mt-1 font-sans"
            />
          </div>

          {/* Two Person Cards (5 cols) */}
          <div className="col-span-5 flex flex-col gap-4 justify-center">
            <div className="flex items-center gap-4 p-4 rounded-xl border bg-white border-[#E5E0DB]">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-neutral-200">
                {crushUrl ? (
                  <Image src={crushUrl} alt={data.onScreenCrush.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.onScreenCrush.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase font-sans text-[#00c030]">On-Screen Crush</span>
                <span className="text-lg font-bold text-[#1A1A1A]">{data.onScreenCrush.name}</span>
                <span className="text-xs text-[#666666] font-sans">{data.onScreenCrush.count} films together</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border bg-white border-[#E5E0DB]">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-neutral-200">
                {directorUrl ? (
                  <Image src={directorUrl} alt={data.favoriteDirector.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.favoriteDirector.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase font-sans text-[#1B2838]">Favorite Director</span>
                <span className="text-lg font-bold text-[#1A1A1A]">{data.favoriteDirector.name}</span>
                <span className="text-xs text-[#666666] font-sans">{data.favoriteDirector.count} films directed</span>
              </div>
            </div>
          </div>
        </div>

        <Wordmark orientation="horizontal" className="text-[#666666]" />
      </div>
    );
  }
);

export default Variant3ShareCard;
