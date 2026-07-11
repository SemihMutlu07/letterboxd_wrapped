'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import Section from '@/components/results/Section';
import { StatCard } from '@/components/results/Cards';

export default function HeroStats({
  totalFilms,
  avgRating,
  hoursWatched,
  topGenre,
  timePct,
  favoriteDirector,
  favoriteDecade,
  onClickFilms,
  onClickAvgRating,
  onClickGenre,
  onClickDirector,
  onClickDecade,
}: {
  totalFilms: number;
  avgRating?: number | null;
  hoursWatched: number;
  topGenre: string;
  timePct: string;
  favoriteDirector: { name: string; count: number };
  favoriteDecade: { name: string; count: number };
  onClickFilms?: () => void;
  onClickAvgRating?: () => void;
  onClickGenre?: () => void;
  onClickDirector?: () => void;
  onClickDecade?: () => void;
}) {
  const hoursLabel = `${Math.round(Math.max(0, hoursWatched)).toLocaleString()}h`;
  const avgRatingLabel = typeof avgRating === 'number' && Number.isFinite(avgRating)
    ? `${avgRating.toFixed(1)}★`
    : 'N/A';
  const [timeInfoOpen, setTimeInfoOpen] = useState(false);

  return (
    <section className="flex items-center justify-center py-4 md:py-6">
      <div className="text-center space-y-4 md:space-y-6 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 items-stretch" style={{ gridAutoRows: '1fr' }}>
          <StatCard value={totalFilms} label="Films" size="large" color="text-white" onClick={onClickFilms} />
          <StatCard value={avgRatingLabel} label="Avg Rating" size="large" color="text-yellow-500" onClick={onClickAvgRating} />
          <StatCard value={hoursLabel} label="Hours watched" size="large" color="text-blue-500" />
          <StatCard value={topGenre} label="Top Genre" color="text-purple-500" onClick={onClickGenre} />
        </div>

        <Section variant="default" className="bg-slate-800/30" animateMode="mount">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
            <button
              type="button"
              onClick={() => setTimeInfoOpen((v) => !v)}
              aria-expanded={timeInfoOpen}
              className="relative text-center bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px] transition-all duration-200 hover:scale-[1.03] hover:bg-orange-500/20 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300"
            >
              <span className="absolute top-2 right-2 text-orange-300/60 transition-colors" aria-hidden>
                <Info className="w-4 h-4" />
              </span>
              <div className="text-3xl md:text-4xl lg:text-5xl font-black text-orange-500 mb-2">{timePct}</div>
              <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-orange-200">
                of your waking time spent on films
              </div>
              {timeInfoOpen && (
                <div
                  className="absolute inset-0 z-10 flex items-center rounded-xl bg-slate-900/95 backdrop-blur-sm border border-orange-500/30 p-3 text-left shadow-2xl cursor-pointer"
                >
                  <p className="text-[11px] leading-snug text-orange-100/90 normal-case tracking-normal font-normal">
                    Your film hours divided by ~16 waking hours per day in your Letterboxd activity window. Capped at 100%.
                  </p>
                </div>
              )}
            </button>
            <div 
              onClick={onClickDirector}
              className={`text-center bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px] transition-all duration-200 ${
                onClickDirector ? 'cursor-pointer hover:scale-[1.03] hover:bg-cyan-500/20 active:scale-[0.98]' : ''
              }`}
            >
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-cyan-500 mb-2 truncate max-w-full">{favoriteDirector.name}</div>
              <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-cyan-200">
                {favoriteDirector.count.toLocaleString()} films • Your director
              </div>
            </div>
            <div 
              onClick={onClickDecade}
              className={`text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px] transition-all duration-200 ${
                onClickDecade ? 'cursor-pointer hover:scale-[1.03] hover:bg-purple-500/20 active:scale-[0.98]' : ''
              }`}
            >
              <div className="text-3xl md:text-4xl lg:text-5xl font-black text-purple-500 mb-2">{favoriteDecade.name}</div>
              <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-purple-200">
                {favoriteDecade.count.toLocaleString()} films • Your peak decade
              </div>
            </div>
          </div>
        </Section>
      </div>
    </section>
  );
}
