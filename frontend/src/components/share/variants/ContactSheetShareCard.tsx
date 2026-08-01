'use client';
import React from 'react';
import type { ShareCardData, ShareOrientation } from '../types';
import { displayFont, PersonFrame, Username, utilityFont } from './BoldCardParts';
import { MilestonesRow, Wordmark } from './shared/SchemaBlocks';

type Props = { data: ShareCardData; orientation?: ShareOrientation; className?: string };

function Sprockets() {
  return (
    <div className="flex justify-between px-4">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} className="h-3 w-7 rounded-sm bg-[#f6d51f]" />
      ))}
    </div>
  );
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
        <header className="flex h-[125px] items-end justify-between gap-6 px-8 pb-5">
          <div className="min-w-0 max-w-[470px]"><div className="text-[54px] font-black uppercase leading-none" style={displayFont}>35mm / 2026</div><Username username={data.username} /></div>
          <div className="shrink-0 text-right text-xs text-[#f6d51f]" style={utilityFont}>ROLL {data.watchedFilms}<br />FRAME 01—07</div>
        </header>
        <div className="mx-5 border-4 border-[#f6d51f] p-3">
          <div className="grid h-[450px] grid-cols-2 gap-3">
            <PersonFrame person={data.onScreenCrush} label="Frame 01 · Actor" className="border border-[#f6d51f]" />
            <PersonFrame person={data.favoriteDirector} label="Frame 02 · Director" className="border border-[#f6d51f]" />
          </div>
          <MilestonesRow data={data} containerClassName="mt-3 grid grid-cols-4 gap-2 h-[260px]" cardClassName="flex flex-col items-center justify-center p-2 rounded bg-black border border-[#f6d51f] text-center" labelClassName="text-[10px] font-bold text-[#f6d51f] mb-1" titleClassName="text-xs font-semibold text-white line-clamp-1" yearClassName="text-[10px] text-neutral-400" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-5 px-8 py-6">
          <div className="text-[64px] font-black uppercase leading-[0.9]" style={displayFont}>{data.spentHours} hours<br />on film</div>
          <div className="text-right text-sm uppercase leading-6 text-[#f6d51f]" style={utilityFont}>Scale {data.cinemaScale}<br />Avg {data.minutesAverage}m<br />{data.peakDecade}</div>
        </div>
        {note && <div className="line-clamp-2 px-8 text-2xl font-bold text-[#f6d51f]" style={{ ...utilityFont, overflowWrap: 'anywhere' }}>↗ {note.title}: you {note.userRating} / crowd {note.avgRating}</div>}
        <Sprockets />
      </div>
    );
  }

  // Schema B — Yatay (1200x675)
  return (
    <div ref={ref} data-export-root="true" className={`h-[675px] w-[1200px] relative overflow-hidden bg-black py-4 text-white ${className}`}>
      <Sprockets />
      {/* Header line */}
      <header className="flex h-[80px] items-center justify-between px-10">
        <div className="flex items-center gap-4">
          <span className="text-[36px] font-black uppercase leading-none text-white" style={displayFont}>
            35mm Contact Sheet
          </span>
          <Username username={data.username} />
        </div>
        <span className="text-xs text-[#f6d51f]" style={utilityFont}>
          LETTERBOXD WRAPPED
        </span>
      </header>

      {/* Main content grid */}
      <div className="px-10 flex flex-col gap-4">
        {/* Headline + Niche Score box */}
        <div className="flex items-center justify-between bg-white/5 border border-[#f6d51f]/40 rounded-xl p-4">
          <div>
            <span className="text-sm font-semibold uppercase text-neutral-400">Headline</span>
            <h2 className="text-3xl font-black uppercase text-white" style={displayFont}>
              you watched {data.watchedFilms} films
            </h2>
          </div>
          <div className="flex flex-col items-end border-l border-[#f6d51f]/40 pl-6">
            <span className="text-xs font-bold uppercase text-[#f6d51f]">Niche Score</span>
            <span className="text-3xl font-black text-[#f6d51f]" style={utilityFont}>
              %{Math.round(data.cinemaScale)}
            </span>
          </div>
        </div>

        {/* Milestones row */}
        {data.milestones && data.milestones.length > 0 && (
          <MilestonesRow
            data={data}
            containerClassName="grid grid-cols-4 gap-3 w-full"
            cardClassName="flex flex-col items-center p-2 rounded-xl bg-white/5 border border-[#f6d51f]/30 text-center relative overflow-hidden"
            labelClassName="text-[11px] font-extrabold uppercase tracking-wider text-[#f6d51f] mb-1"
            titleClassName="text-xs font-semibold text-white line-clamp-1"
            yearClassName="text-[10px] text-neutral-400"
          />
        )}

        {/* Person Cards (crush & director) */}
        <div className="grid grid-cols-2 gap-4">
          <PersonFrame person={data.onScreenCrush} label="Actor · 01" className="border border-[#f6d51f] h-[180px]" />
          <PersonFrame person={data.favoriteDirector} label="Director · 02" className="border border-[#f6d51f] h-[180px]" />
        </div>
      </div>

      <Wordmark orientation="horizontal" className="text-[#f6d51f]" />
      <Sprockets />
    </div>
  );
});

export default ContactSheetShareCard;
