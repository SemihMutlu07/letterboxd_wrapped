'use client';

import React from 'react';
import Section from '@/components/results/Section';

export default function Genres({ genres }: { genres: { name: string; count: number }[] }) {
  const genreColors = [
    'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
    'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
    'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 text-emerald-400',
    'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
    'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400',
  ];

  return (
    <Section title="Genre Preferences" subtitle="Your most-watched categories" icon="🎭">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {(genres ?? []).slice(0, 5).map((genre, i) => (
          <div
            key={genre.name}
            className={`bg-gradient-to-br ${genreColors[i]} border rounded-xl p-3 md:p-4 text-center hover:scale-[1.02] hover:shadow-lg transition-all duration-200 min-h-[92px] flex flex-col items-center justify-center`}
          >
            <div className="text-lg md:text-xl font-semibold mb-1">{genre.name}</div>
            <div className="text-xs md:text-sm opacity-80 font-medium tabular-nums">
              {genre.count.toLocaleString()} films
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}


