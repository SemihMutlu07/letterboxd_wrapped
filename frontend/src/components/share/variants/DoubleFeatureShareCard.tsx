'use client';
import React, { useMemo } from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, Username, utilityFont } from './BoldCardParts';
import { StatGrid, VerticalStatStack, Wordmark } from './shared/SchemaBlocks';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

const DoubleFeatureShareCard = React.forwardRef<HTMLDivElement, Props>(function DoubleFeatureShareCard(
  { data, orientation = 'horizontal', className = '' },
  ref,
) {
  const vertical = orientation === 'vertical';

  const crushUrl = useMemo(
    () => (data.onScreenCrush.headshotUrl ? getTmdbImageUrl(data.onScreenCrush.headshotUrl) ?? undefined : undefined),
    [data.onScreenCrush.headshotUrl]
  );
  const directorUrl = useMemo(
    () => (data.favoriteDirector.headshotUrl ? getTmdbImageUrl(data.favoriteDirector.headshotUrl) ?? undefined : undefined),
    [data.favoriteDirector.headshotUrl]
  );

  /* ═══════ VERTICAL (675×1200 - Schema A) ═══════ */
  if (vertical) {
    return (
      <div
        ref={ref}
        data-export-root="true"
        className={`relative h-[1200px] w-[675px] overflow-hidden bg-[#10100f] p-10 text-[#f1e7d0] flex flex-col justify-between ${className}`}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-6 border-b-4 border-[#ef4b2f] pb-5 z-10">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.3em] text-[#ef4b2f]" style={utilityFont}>
              Movies Wrapped · Double Feature
            </div>
            <h1 className="text-2xl font-black uppercase text-white mt-1" style={displayFont}>
              you watched {data.watchedFilms} films so far
            </h1>
          </div>
          <Username username={data.username} />
        </header>

        {/* Vertical Stat Stack */}
        <div className="my-auto z-10">
          <VerticalStatStack
            data={data}
            cardClassName="flex items-center gap-4 p-4 rounded-xl border border-[#ef4b2f]/40 bg-[#181816]"
            personLabelClassName="text-xs font-bold uppercase tracking-wider text-[#ef4b2f]"
            personNameClassName="text-xl font-bold text-[#f1e7d0]"
            personSubClassName="text-xs text-neutral-400"
            statBoxClassName="flex flex-col p-4 rounded-xl border border-[#ef4b2f]/40 bg-[#181816]"
            statLabelClassName="text-xs font-bold uppercase tracking-wider text-[#ef4b2f] mb-1"
            statValueClassName="text-2xl font-bold text-[#f1e7d0] tabular-nums"
          />
        </div>

        <Wordmark orientation="vertical" className="text-[#ef4b2f]" />
      </div>
    );
  }

  /* ═══════ HORIZONTAL (1200×675 - Schema A) ═══════ */
  return (
    <div
      ref={ref}
      data-export-root="true"
      className={`h-[675px] w-[1200px] relative overflow-hidden bg-[#10100f] p-10 text-[#f1e7d0] flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b-4 border-[#ef4b2f] pb-4 z-10">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#ef4b2f]" style={utilityFont}>
            Double Feature
          </div>
          <h1 className="text-3xl font-black uppercase text-white mt-1" style={displayFont}>
            you watched {data.watchedFilms} films
          </h1>
        </div>
        <Username username={data.username} />
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-8 my-auto z-10">
        {/* Stat Grid (7 cols) */}
        <div className="col-span-7 flex flex-col justify-center">
          <StatGrid
            data={data}
            containerClassName="grid grid-cols-2 gap-4 w-full"
            boxClassName="flex flex-col justify-between p-4 rounded-xl border border-[#ef4b2f]/40 bg-[#181816]"
            labelClassName="text-xs font-bold uppercase tracking-wider text-[#ef4b2f]"
            valueClassName="text-2xl font-bold text-[#f1e7d0] tabular-nums mt-2"
            subValueClassName="text-xs text-neutral-400 mt-1"
          />
        </div>

        {/* Two Person Cards (5 cols) */}
        <div className="col-span-5 flex flex-col gap-4 justify-center">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-[#ef4b2f]/40 bg-[#181816]">
            <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-white/10">
              {crushUrl ? (
                <Image src={crushUrl} alt={data.onScreenCrush.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.onScreenCrush.name.slice(0, 2)}</div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase text-[#ef4b2f]">Starring (Crush)</span>
              <span className="text-lg font-bold text-[#f1e7d0]">{data.onScreenCrush.name}</span>
              <span className="text-xs text-neutral-400">{data.onScreenCrush.count} films together</span>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl border border-[#ef4b2f]/40 bg-[#181816]">
            <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-white/10">
              {directorUrl ? (
                <Image src={directorUrl} alt={data.favoriteDirector.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-xs font-bold text-neutral-500">{data.favoriteDirector.name.slice(0, 2)}</div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase text-[#ef4b2f]">Directed by</span>
              <span className="text-lg font-bold text-[#f1e7d0]">{data.favoriteDirector.name}</span>
              <span className="text-xs text-neutral-400">{data.favoriteDirector.count} films directed</span>
            </div>
          </div>
        </div>
      </div>

      <Wordmark orientation="horizontal" className="text-[#ef4b2f]" />
    </div>
  );
});

export default DoubleFeatureShareCard;
