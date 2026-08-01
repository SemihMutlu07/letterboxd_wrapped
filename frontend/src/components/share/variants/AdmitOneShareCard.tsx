'use client';
import React, { useMemo } from 'react';
import Image from 'next/image';
import { getTmdbImageUrl } from '@/lib/analytics';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, Username, utilityFont } from './BoldCardParts';
import { StatGrid, VerticalStatStack, Wordmark } from './shared/SchemaBlocks';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

const AdmitOneShareCard = React.forwardRef<HTMLDivElement, Props>(function AdmitOneShareCard(
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
        className={`h-[1200px] w-[675px] overflow-hidden p-8 text-black relative flex flex-col justify-between ${className}`}
        style={{ backgroundColor: '#c9963d' }}
      >
        <div className="relative h-full border-[5px] border-[#153ea8] p-7 flex flex-col justify-between">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4 text-xs uppercase z-10" style={utilityFont}>
            <div>
              <span className="font-bold text-[#153ea8]">Admit One · 2026</span>
              <h1 className="text-xl font-black uppercase text-black mt-1" style={displayFont}>
                you watched {data.watchedFilms} films so far
              </h1>
            </div>
            <Username username={data.username} />
          </div>

          {/* Vertical Stat Stack */}
          <div className="my-auto z-10">
            <VerticalStatStack
              data={data}
              cardClassName="flex items-center gap-4 p-4 rounded-xl border-2 border-[#153ea8] bg-[#dca84c]"
              personLabelClassName="text-xs font-bold uppercase tracking-wider text-[#153ea8]"
              personNameClassName="text-xl font-bold text-black"
              personSubClassName="text-xs text-black/70"
              statBoxClassName="flex flex-col p-4 rounded-xl border-2 border-[#153ea8] bg-[#dca84c]"
              statLabelClassName="text-xs font-bold uppercase tracking-wider text-[#153ea8] mb-1"
              statValueClassName="text-2xl font-bold text-black tabular-nums"
            />
          </div>

          <Wordmark orientation="vertical" className="text-[#153ea8]" />
        </div>
      </div>
    );
  }

  /* ═══════ HORIZONTAL (1200×675 - Schema A) ═══════ */
  return (
    <div
      ref={ref}
      data-export-root="true"
      className={`h-[675px] w-[1200px] overflow-hidden p-8 text-black relative flex flex-col justify-between ${className}`}
      style={{ backgroundColor: '#c9963d' }}
    >
      <div className="relative h-full border-[6px] border-[#153ea8] p-8 flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-4 text-xs uppercase z-10" style={utilityFont}>
          <div>
            <span className="font-bold text-[#153ea8]">Admit One Ticket</span>
            <h1 className="text-3xl font-black uppercase text-black mt-1" style={displayFont}>
              you watched {data.watchedFilms} films
            </h1>
          </div>
          <Username username={data.username} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-8 my-auto z-10">
          {/* Stat Grid (7 cols) */}
          <div className="col-span-7 flex flex-col justify-center">
            <StatGrid
              data={data}
              containerClassName="grid grid-cols-2 gap-4 w-full"
              boxClassName="flex flex-col justify-between p-4 rounded-xl border-2 border-[#153ea8] bg-[#dca84c]"
              labelClassName="text-xs font-bold uppercase tracking-wider text-[#153ea8]"
              valueClassName="text-2xl font-bold text-black tabular-nums mt-2"
              subValueClassName="text-xs text-black/70 mt-1"
            />
          </div>

          {/* Two Person Cards (5 cols) */}
          <div className="col-span-5 flex flex-col gap-4 justify-center">
            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-[#153ea8] bg-[#dca84c]">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-black/10">
                {crushUrl ? (
                  <Image src={crushUrl} alt={data.onScreenCrush.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-black/50">{data.onScreenCrush.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase text-[#153ea8]">Validated · Actor</span>
                <span className="text-lg font-bold text-black">{data.onScreenCrush.name}</span>
                <span className="text-xs text-black/70">{data.onScreenCrush.count} films together</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-[#153ea8] bg-[#dca84c]">
              <div className="relative w-16 h-24 rounded overflow-hidden shrink-0 bg-black/10">
                {directorUrl ? (
                  <Image src={directorUrl} alt={data.favoriteDirector.name} fill sizes="64px" className="object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-black/50">{data.favoriteDirector.name.slice(0, 2)}</div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase text-[#153ea8]">Validated · Director</span>
                <span className="text-lg font-bold text-black">{data.favoriteDirector.name}</span>
                <span className="text-xs text-black/70">{data.favoriteDirector.count} films directed</span>
              </div>
            </div>
          </div>
        </div>

        <Wordmark orientation="horizontal" className="text-[#153ea8]" />
      </div>
    </div>
  );
});

export default AdmitOneShareCard;
