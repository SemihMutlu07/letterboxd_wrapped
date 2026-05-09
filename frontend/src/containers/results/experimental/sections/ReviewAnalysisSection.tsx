'use client';

import React from 'react';
import Section from '@/components/results/Section';
import type { StatsData } from '../types';

type Props = { stats: StatsData };

export default function ReviewAnalysisSection({ stats }: Props) {
  const ra = stats.review_analysis;
  if (!ra || ra.reviews_with_text === 0) return null;

  const topWords = (ra.word_frequency ?? []).slice(0, 5);
  const avgWords = Math.round(ra.avg_review_length_words ?? 0);

  return (
    <Section title="Your Reviews" subtitle={`${ra.reviews_with_text} reviews with text`}>
      <div className="flex flex-wrap gap-3 items-start">
        {/* Review count stat */}
        <div className="flex-1 min-w-[120px] bg-slate-800/50 rounded-xl p-4">
          <p className="text-3xl font-bold text-orange-400">{ra.reviews_with_text}</p>
          <p className="text-sm text-slate-400 mt-1">reviews written</p>
        </div>

        {/* Avg length stat */}
        <div className="flex-1 min-w-[120px] bg-slate-800/50 rounded-xl p-4">
          <p className="text-3xl font-bold text-orange-400">{avgWords}</p>
          <p className="text-sm text-slate-400 mt-1">avg words / review</p>
        </div>

        {/* Top words */}
        {topWords.length > 0 && (
          <div className="w-full">
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Most used words</p>
            <div className="flex flex-wrap gap-2">
              {topWords.map(({ word, count }) => (
                <span
                  key={word}
                  className="px-3 py-1 rounded-full bg-slate-700/60 text-slate-200 text-sm font-medium"
                >
                  {word}
                  <span className="ml-1.5 text-xs text-slate-400">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
