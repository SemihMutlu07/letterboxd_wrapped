'use client';

import React from 'react';
import Section from '@/components/results/Section';
import { StatCard } from '@/components/results/Cards';

export default function HeroStats({
  totalFilms,
  avgRating,
  days,
  topGenre,
  timePct,
  favoriteDirector,
  favoriteDecade,
}: {
  totalFilms: number;
  avgRating: number;
  days: number;
  topGenre: string;
  timePct: string;
  favoriteDirector: { name: string; count: number };
  favoriteDecade: { name: string; count: number };
}) {
  return (
    <section className="flex items-center justify-center py-4 md:py-6">
      <div className="text-center space-y-4 md:space-y-6 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 items-stretch" style={{ gridAutoRows: '1fr' }}>
          <StatCard value={totalFilms} label="Films" size="large" color="text-white" />
          <StatCard value={`${avgRating.toFixed(1)}★`} label="Avg Rating" size="large" color="text-yellow-500" />
          <StatCard value={Math.round(days)} label="Days" size="large" color="text-blue-500" />
          <StatCard value={topGenre} label="Top Genre" color="text-purple-500" />
        </div>

        <Section variant="default" className="bg-slate-800/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
            <div className="text-center bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
              <div className="text-3xl md:text-4xl lg:text-5xl font-black text-orange-500 mb-2">{timePct}</div>
              <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-orange-200">
                of your time spent watching films
              </div>
            </div>
            <div className="text-center bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-cyan-500 mb-2 truncate">{favoriteDirector.name}</div>
              <div className="text-sm md:text-base uppercase tracking-wider opacity-80 font-medium text-cyan-200">
                {favoriteDirector.count.toLocaleString()} films • Your director
              </div>
            </div>
            <div className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col items-center justify-center min-h-[100px] md:min-h-[120px]">
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


