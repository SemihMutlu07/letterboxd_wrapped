'use client';
import React from 'react';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, PersonFrame, Username, utilityFont } from './BoldCardParts';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

function Marquee({ data }: { data: ShareCardData }) {
  const titles = Array.from({ length: 5 }, (_, index) => data.topFilms?.[index]?.title ?? 'Open slot');
  return <div className="line-clamp-3 text-sm font-black uppercase leading-6" style={{ ...utilityFont, overflowWrap: 'anywhere' }}>{titles.map((title, i) => `${String(i + 1).padStart(2, '0')} ${title}`).join('  ·  ')}</div>;
}

function TicketMeta({ data }: { data: ShareCardData }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs uppercase" style={utilityFont}>
      <span>Films<br /><b className="text-2xl">{data.watchedFilms}</b></span>
      <span>Runtime<br /><b className="text-2xl">{data.spentHours}h</b></span>
      <span>Scale<br /><b className="text-2xl">{data.cinemaScale}</b></span>
      <span>Peak<br /><b className="text-2xl">{data.peakDecade}</b></span>
    </div>
  );
}

const AdmitOneShareCard = React.forwardRef<HTMLDivElement, Props>(function AdmitOneShareCard(
  { data, orientation = 'horizontal', className = '' },
  ref,
) {
  const outlier = data.ratingOutlierFilm;
  if (orientation === 'vertical') {
    return (
      <div ref={ref} data-export-root="true" className={`h-[1200px] w-[675px] overflow-hidden p-7 text-black ${className}`} style={{ backgroundColor: '#c9963d' }}>
        <div className="relative h-full border-[5px] border-[#153ea8] p-7">
          <div className="flex justify-between gap-6 border-b-2 border-black pb-4 text-xs uppercase" style={utilityFont}><span className="shrink-0">Movies Wrapped · 2026</span><div className="min-w-0 max-w-[290px] text-right"><Username username={data.username} /></div></div>
          <div className="mt-7 text-[108px] font-black uppercase leading-[0.78] text-[#153ea8]" style={displayFont}>Admit<br />One</div>
          <div className="mt-7 border-y-2 border-black py-4"><Marquee data={data} /></div>
          <div className="mt-7"><TicketMeta data={data} /></div>
          {outlier && <div className="mt-7 border-2 border-[#153ea8] p-4 text-sm uppercase" style={utilityFont}>Row {Math.abs(Math.round(outlier.delta * 10))} · Seat {outlier.userRating}<br /><b className="line-clamp-2 text-xl" style={{ overflowWrap: 'anywhere' }}>{outlier.title}</b></div>}
          <div className="absolute inset-x-0 bottom-[330px] border-t-4 border-dashed border-black" />
          <div className="absolute inset-x-7 bottom-7 grid h-[275px] grid-cols-2 gap-4">
            <PersonFrame person={data.onScreenCrush} label="Validated · Actor" className="border-2 border-black" />
            <PersonFrame person={data.favoriteDirector} label="Validated · Director" className="border-2 border-black" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} data-export-root="true" className={`grid h-[675px] w-[1200px] grid-cols-[1fr_335px] overflow-hidden text-black ${className}`} style={{ backgroundColor: '#c9963d' }}>
      <main className="border-[6px] border-[#153ea8] p-9">
        <div className="flex justify-between gap-6 border-b-2 border-black pb-4 text-xs uppercase" style={utilityFont}><span className="shrink-0">Movies Wrapped · Valid 2026</span><div className="min-w-0 max-w-[430px] text-right"><Username username={data.username} /></div></div>
        <div className="mt-7 text-[112px] font-black uppercase leading-[0.78] text-[#153ea8]" style={displayFont}>Admit one</div>
        <div className="mt-7 border-y-2 border-black py-4"><Marquee data={data} /></div>
        <div className="mt-8 grid grid-cols-[1fr_250px] gap-10">
          <TicketMeta data={data} />
          {outlier && <div className="border-2 border-[#153ea8] p-4 text-sm uppercase" style={utilityFont}>Row {Math.abs(Math.round(outlier.delta * 10))} · Seat {outlier.userRating}<br /><b className="line-clamp-2 text-xl" style={{ overflowWrap: 'anywhere' }}>{outlier.title}</b><br />Crowd {outlier.avgRating}</div>}
        </div>
      </main>
      <aside className="relative border-y-[6px] border-r-[6px] border-[#153ea8] border-l-4 border-dashed p-5">
        <div className="grid h-[510px] grid-rows-2 gap-4">
          <PersonFrame person={data.onScreenCrush} label="Actor ID" className="border-2 border-black" />
          <PersonFrame person={data.favoriteDirector} label="Director ID" className="border-2 border-black" />
        </div>
        <div className="mt-5 rotate-[-4deg] border-4 border-[#153ea8] p-2 text-center text-2xl font-black uppercase text-[#153ea8]" style={displayFont}>Validated</div>
      </aside>
    </div>
  );
});

export default AdmitOneShareCard;
