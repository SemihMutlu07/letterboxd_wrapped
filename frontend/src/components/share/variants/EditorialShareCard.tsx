import React, { useMemo } from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';
import { StatGrid, VerticalStatStack, Wordmark } from './shared/SchemaBlocks';

type EditorialShareCardProps = {
  data: ShareCardData;
  className?: string;
  orientation?: ShareOrientation;
};

const EditorialShareCard = React.forwardRef<HTMLDivElement, EditorialShareCardProps>(
  function EditorialShareCard({ data, className = '', orientation = 'horizontal' }, ref) {
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
          className={`w-[675px] h-[1200px] relative overflow-hidden flex flex-col justify-between p-10 bg-black text-white ${className}`}
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Glitch lines */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF0066]" />
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00ffe5]" />

          {/* Header */}
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#00ffe5] font-bold">
                [EDITORIAL_WRAPPED]
              </p>
              <h1 className="text-3xl font-black mt-1 uppercase text-white">
                you watched {data.watchedFilms} films so far
              </h1>
            </div>
            {data.username && <span className="text-xs text-[#FF0066] font-bold">@{data.username}</span>}
          </div>

          {/* Vertical Stat Stack */}
          <div className="my-auto z-10">
            <VerticalStatStack
              data={data}
              cardClassName="flex items-center gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800"
              personLabelClassName="text-xs font-bold uppercase tracking-wider text-[#FF0066]"
              personNameClassName="text-xl font-bold text-white font-mono"
              personSubClassName="text-xs text-neutral-400 font-mono"
              statBoxClassName="flex flex-col p-4 rounded-lg bg-neutral-950 border border-neutral-800"
              statLabelClassName="text-xs font-bold uppercase tracking-wider text-[#00ffe5] mb-1"
              statValueClassName="text-xl font-bold text-white tabular-nums font-mono"
            />
          </div>

          <Wordmark orientation="vertical" className="text-[#00ffe5]" />
        </div>
      );
    }

    /* ═══════ HORIZONTAL (1200×675 - Schema A) ═══════ */
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={`w-[1200px] h-[675px] relative overflow-hidden flex flex-col justify-between p-10 bg-black text-white ${className}`}
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#FF0066]" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#00ffe5]" />

        {/* Header */}
        <div className="flex items-center justify-between z-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#00ffe5] font-bold">
              [EDITORIAL_ISSUE_2026]
            </p>
            <h1 className="text-4xl font-black mt-1 uppercase text-white">
              you watched {data.watchedFilms} films
            </h1>
          </div>
          {data.username && <span className="text-sm text-[#FF0066] font-bold">@{data.username}</span>}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-12 gap-8 my-auto z-10">
          {/* Stat Grid (7 cols) */}
          <div className="col-span-7 flex flex-col justify-center">
            <StatGrid
              data={data}
              containerClassName="grid grid-cols-2 gap-4 w-full"
              boxClassName="flex flex-col justify-between p-4 rounded-lg bg-neutral-950 border border-neutral-800"
              labelClassName="text-xs font-bold uppercase tracking-wider text-[#00ffe5]"
              valueClassName="text-2xl font-bold text-white tabular-nums mt-2 font-mono"
              subValueClassName="text-xs text-neutral-400 mt-1 font-mono"
            />
          </div>

          {/* Two Person Cards (5 cols) */}
          <div className="col-span-5 flex flex-col gap-4 justify-center">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-neutral-900 border border-neutral-700">
                {crushUrl ? (
                  <Image src={crushUrl} alt={data.onScreenCrush.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.onScreenCrush.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase text-[#FF0066]">On-Screen Crush</span>
                <span className="text-lg font-bold text-white font-mono">{data.onScreenCrush.name}</span>
                <span className="text-xs text-neutral-400 font-mono">{data.onScreenCrush.count} films together</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-neutral-900 border border-neutral-700">
                {directorUrl ? (
                  <Image src={directorUrl} alt={data.favoriteDirector.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.favoriteDirector.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase text-[#00ffe5]">Favorite Director</span>
                <span className="text-lg font-bold text-white font-mono">{data.favoriteDirector.name}</span>
                <span className="text-xs text-neutral-400 font-mono">{data.favoriteDirector.count} films directed</span>
              </div>
            </div>
          </div>
        </div>

        <Wordmark orientation="horizontal" className="text-[#00ffe5]" />
      </div>
    );
  }
);

export default EditorialShareCard;
