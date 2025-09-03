'use client';

import React from 'react';
import Section from '@/components/results/Section';

export default function CinemaScale({
  type,
  description,
  score,
}: {
  type: string;
  description?: string;
  score: number;
}) {
  return (
    <Section title="Your Cinema Scale" subtitle="Popular vs Niche film preferences">
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8">
        <div className="text-center mb-4 md:mb-6 lg:flex lg:items-center lg:justify-between lg:text-left">
          <div className="lg:flex-1">
            <div className="text-2xl md:text-3xl font-bold">{type || 'Independent Cinephile'}</div>
            {description && <div className="text-sm text-slate-300 mt-2">{description}</div>}
          </div>
          <div className="text-5xl md:text-7xl font-black mt-1 lg:mt-0 lg:ml-8 tabular-nums">
            {score} <span className="text-2xl">/ 100</span>
          </div>
        </div>
        <div className="w-full h-3 md:h-4 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${score}%` }} />
        </div>
        <div className="text-sm md:text-base opacity-80 mt-2 text-center">Higher = more obscure/indie taste</div>
      </div>
    </Section>
  );
}


