'use client';

import React from 'react';
import Section from '@/components/results/Section';

export default function QuickFacts({
  avgMinutes,
  totalCountries,
  mostCommonRating,
  filmsPerWeek,
  languageCount,
  decadeSpan,
}: {
  avgMinutes: number;
  totalCountries: number;
  mostCommonRating: number;
  filmsPerWeek: number;
  languageCount: number;
  decadeSpan: number;
}) {
  const statNumber = 'text-3xl md:text-4xl font-black';
  const statLabel = 'text-xs md:text-sm uppercase tracking-wider opacity-80 font-medium';
  return (
    <Section title="Quick Facts" subtitle="Notable highlights from your viewing + new discovery metrics">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <div className="text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-emerald-200 mb-2`}>minutes average</div>
          <div className={`${statNumber} text-emerald-500`}>{Math.round(avgMinutes)}</div>
        </div>
        <div className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-purple-200 mb-2`}>countries explored</div>
          <div className={`${statNumber} text-purple-500`}>{totalCountries.toLocaleString()}</div>
        </div>
        <div className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-yellow-200 mb-2`}>most common rating</div>
          <div className={`${statNumber} text-yellow-500`}>{mostCommonRating}★</div>
        </div>
        <div className="text-center bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-cyan-200 mb-2`}>films per week</div>
          <div className={`${statNumber} text-cyan-400`}>{filmsPerWeek.toFixed(1)}</div>
        </div>
        <div className="text-center bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-orange-200 mb-2`}>different languages</div>
          <div className={`${statNumber} text-orange-400`}>{languageCount}</div>
        </div>
        <div className="text-center bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statLabel} text-fuchsia-200 mb-2`}>active decades</div>
          <div className={`${statNumber} text-fuchsia-400`}>{decadeSpan}</div>
        </div>
      </div>
    </Section>
  );
}
