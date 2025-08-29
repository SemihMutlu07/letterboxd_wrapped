'use client';

import React from 'react';
import Section from '@/components/results/Section';

export default function QuickFacts({
  avgMinutes,
  totalCountries,
  mostCommonRating,
}: {
  avgMinutes: number;
  totalCountries: number;
  mostCommonRating: number;
}) {
  const statNumber = 'text-3xl md:text-4xl font-black';
  const statLabel = 'text-xs md:text-sm uppercase tracking-wider opacity-80 font-medium';
  return (
    <Section title="Quick Facts" subtitle="Notable highlights from your viewing">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <div className="text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statNumber} text-emerald-500 mb-2`}>{Math.round(avgMinutes)}</div>
          <div className={`${statLabel} text-emerald-200`}>minutes average</div>
        </div>
        <div className="text-center bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statNumber} text-purple-500 mb-2`}>{totalCountries.toLocaleString()}</div>
          <div className={`${statLabel} text-purple-200`}>countries explored</div>
        </div>
        <div className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 md:p-4 lg:p-6 flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
          <div className={`${statNumber} text-yellow-500 mb-2`}>{mostCommonRating}★</div>
          <div className={`${statLabel} text-yellow-200`}>most common rating</div>
        </div>
      </div>
    </Section>
  );
}


