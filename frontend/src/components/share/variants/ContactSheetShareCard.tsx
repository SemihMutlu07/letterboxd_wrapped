'use client';
import React from 'react';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, PersonFrame, PosterSlots, Username, utilityFont } from './BoldCardParts';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

function Sprockets() {
  return <div className="flex justify-between px-4">{Array.from({ length: 14 }, (_, i) => <i key={i} className="h-3 w-7 rounded-sm bg-[#f6d51f]" />)}</div>;
}

const ContactSheetShareCard = React.forwardRef<HTMLDivElement, Props>(function ContactSheetShareCard(
  { data, orientation = 'horizontal', className = '' },
  ref,
) {
  const note = data.ratingOutlierFilm;
  if (orientation === 'vertical') {
    return (
      <div ref={ref} data-export-root="true" className={`h-[1200px] w-[675px] overflow-hidden bg-black py-5 text-white ${className}`}>
        <Sprockets />
        <header className="flex h-[125px] items-end justify-between px-8 pb-5">
          <div><div className="text-[54px] font-black uppercase leading-none" style={displayFont}>35mm / 2026</div><Username username={data.username} /></div>
          <div className="text-right text-xs text-[#f6d51f]" style={utilityFont}>ROLL {data.watchedFilms}<br />FRAME 01—07</div>
        </header>
        <div className="mx-5 border-4 border-[#f6d51f] p-3">
          <div className="grid h-[475px] grid-cols-2 gap-3">
            <PersonFrame person={data.onScreenCrush} label="Frame 01 · Actor" className="border border-[#f6d51f]" />
            <PersonFrame person={data.favoriteDirector} label="Frame 02 · Director" className="border border-[#f6d51f]" />
          </div>
          <PosterSlots films={data.topFilms} className="mt-3 gap-2" slotClassName="h-[270px]" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-5 px-8 py-6">
          <div className="text-[64px] font-black uppercase leading-[0.9]" style={displayFont}>{data.spentHours} hours<br />on film</div>
          <div className="text-right text-sm uppercase leading-6 text-[#f6d51f]" style={utilityFont}>Scale {data.cinemaScale}<br />Avg {data.minutesAverage}m<br />{data.peakDecade}</div>
        </div>
        {note && <div className="-rotate-2 px-8 text-2xl font-bold text-[#e44232]" style={{ ...utilityFont, fontFamily: 'ui-monospace, monospace' }}>↗ {note.title}: you {note.userRating} / crowd {note.avgRating}</div>}
        <Sprockets />
      </div>
    );
  }
  return (
    <div ref={ref} data-export-root="true" className={`h-[675px] w-[1200px] overflow-hidden bg-black py-4 text-white ${className}`}>
      <Sprockets />
      <header className="flex h-[105px] items-end justify-between px-10 pb-4">
        <div className="flex items-end gap-5"><div className="text-[62px] font-black uppercase leading-none" style={displayFont}>35mm contact sheet</div><Username username={data.username} /></div>
        <div className="text-right text-xs text-[#f6d51f]" style={utilityFont}>ROLL {data.watchedFilms} · {data.spentHours}H<br />SCALE {data.cinemaScale}</div>
      </header>
      <div className="mx-6 grid h-[450px] grid-cols-[210px_210px_1fr] gap-3 border-4 border-[#f6d51f] p-3">
        <PersonFrame person={data.onScreenCrush} label="Actor · 01" className="border border-[#f6d51f]" />
        <PersonFrame person={data.favoriteDirector} label="Director · 02" className="border border-[#f6d51f]" />
        <PosterSlots films={data.topFilms} className="gap-2" slotClassName="h-full" />
      </div>
      <div className="flex h-[65px] items-center justify-between px-10">
        <div className="text-sm uppercase text-[#f6d51f]" style={utilityFont}>{data.peakDecade} · Avg {data.minutesAverage}m · Rating {data.mostCommonRating}</div>
        {note && <div className="-rotate-2 text-xl font-bold text-[#e44232]" style={utilityFont}>↗ {note.title}: {note.userRating} vs {note.avgRating}</div>}
      </div>
      <Sprockets />
    </div>
  );
});

export default ContactSheetShareCard;
