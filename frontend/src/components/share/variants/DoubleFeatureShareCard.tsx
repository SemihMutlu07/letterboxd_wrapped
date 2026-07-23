'use client';
import React from 'react';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, PersonFrame, PosterSlots, Username, utilityFont } from './BoldCardParts';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

const DoubleFeatureShareCard = React.forwardRef<HTMLDivElement, Props>(function DoubleFeatureShareCard(
  { data, orientation = 'horizontal', className = '' },
  ref,
) {
  const vertical = orientation === 'vertical';
  if (vertical) {
    return (
      <div ref={ref} data-export-root="true" className={`relative h-[1200px] w-[675px] overflow-hidden bg-[#10100f] p-8 text-[#f1e7d0] ${className}`}>
        <header className="flex items-start justify-between border-b-4 border-[#ef4b2f] pb-5">
          <div><div className="text-sm uppercase tracking-[0.3em]" style={utilityFont}>Movies Wrapped · Double Feature</div><Username username={data.username} /></div>
          <div className="text-right text-xs uppercase" style={utilityFont}>{data.peakDecade}<br />Program 01</div>
        </header>
        <div className="relative mt-6 grid h-[610px] grid-cols-2 gap-4">
          <PersonFrame person={data.onScreenCrush} label="Starring" className="h-full text-[#f1e7d0]" />
          <PersonFrame person={data.favoriteDirector} label="Directed by" className="h-full text-[#f1e7d0]" />
          <div className="absolute inset-0 grid place-items-center text-[220px] font-black leading-none text-[#ef4b2f]" style={displayFont}>{data.watchedFilms}</div>
        </div>
        <div className="mt-6 flex items-end justify-between">
          <div className="text-[62px] font-black uppercase leading-[0.82]" style={displayFont}>Your year<br />in pictures</div>
          <div className="text-right text-sm uppercase leading-6" style={utilityFont}>{data.spentHours} hours<br />Cinema scale {data.cinemaScale}<br />Avg {data.minutesAverage} min</div>
        </div>
        <PosterSlots films={data.topFilms} className="mt-6 gap-2" slotClassName="h-[190px]" />
      </div>
    );
  }
  return (
    <div ref={ref} data-export-root="true" className={`grid h-[675px] w-[1200px] grid-cols-[430px_1fr] overflow-hidden bg-[#10100f] text-[#f1e7d0] ${className}`}>
      <div className="grid grid-cols-2 gap-3 p-6">
        <PersonFrame person={data.onScreenCrush} label="Starring" className="h-[627px]" />
        <PersonFrame person={data.favoriteDirector} label="Directed by" className="h-[627px]" />
      </div>
      <div className="flex flex-col p-10 pl-5">
        <div className="flex justify-between border-b-4 border-[#ef4b2f] pb-4 text-xs uppercase tracking-[0.25em]" style={utilityFont}><span>Double Feature</span><Username username={data.username} /></div>
        <div className="mt-7 text-[78px] font-black uppercase leading-[0.85]" style={displayFont}>Your year<br />in pictures</div>
        <div className="-mt-2 text-[190px] font-black leading-none text-[#ef4b2f]" style={displayFont}>{data.watchedFilms}</div>
        <div className="grid grid-cols-3 border-y border-[#f1e7d0]/40 py-3 text-sm uppercase" style={utilityFont}><span>Films watched</span><span>{data.spentHours} hours</span><span>Scale {data.cinemaScale}</span></div>
        <PosterSlots films={data.topFilms} className="mt-5 gap-2" slotClassName="h-[150px]" />
      </div>
    </div>
  );
});

export default DoubleFeatureShareCard;
