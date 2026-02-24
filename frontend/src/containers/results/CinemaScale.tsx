'use client';

import React from 'react';
import Section from '@/components/results/Section';

interface Breakdown {
  geography: number;
  temporal: number;
  languages: number;
  volume: number;
  genres: number;
  directors: number;
}

export default function CinemaScale({
  description,
  score,
  breakdown,
}: {
  type?: string;
  description?: string;
  score: number;
  breakdown?: Breakdown;
}) {
  // Score interpretation
  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Top 5% of film enthusiasts";
    if (score >= 80) return "Top 10% of cinema lovers";
    if (score >= 70) return "Top 20% of movie watchers";
    if (score >= 60) return "Above average film taste";
    if (score >= 50) return "Balanced film preferences";
    if (score >= 40) return "Popular taste with variety";
    if (score >= 30) return "Mainstream preferences";
    return "Blockbuster focused";
  };

  const axes: { key: keyof Breakdown; label: string; max: number; color: string }[] = [
    { key: 'geography',  label: 'Geographic',  max: 25, color: 'bg-emerald-500' },
    { key: 'temporal',   label: 'Historical',   max: 20, color: 'bg-purple-500' },
    { key: 'languages',  label: 'Languages',    max: 15, color: 'bg-cyan-500' },
    { key: 'volume',     label: 'Volume',       max: 15, color: 'bg-orange-500' },
    { key: 'genres',     label: 'Genres',       max: 15, color: 'bg-pink-500' },
    { key: 'directors',  label: 'Directors',    max: 10, color: 'bg-yellow-500' },
  ];

  return (
    <Section title="Your Cinema Scale" subtitle="How adventurous is your film taste?">
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 md:p-8 space-y-6">
        {/* Main Score Display */}
        <div className="text-center mb-6">
          <div className="text-5xl md:text-7xl font-black tabular-nums">
            {score}<span className="text-2xl text-slate-400">/100</span>
          </div>
          <div className="text-slate-300 mt-2">{getScoreMessage(score)}</div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
              style={{ width: `${score}%` }}
            />
          </div>
          {/* Score markers */}
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Mainstream</span>
            <span>Balanced</span>
            <span>Arthouse</span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="text-center">
            <p className="text-slate-300 text-base leading-relaxed">
              {description}
            </p>
          </div>
        )}

        {/* Real Score Breakdown */}
        {breakdown ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {axes.map(({ key, label, max, color }) => {
              const val = breakdown[key] ?? 0;
              const pct = max > 0 ? Math.round((val / max) * 100) : 0;
              return (
                <div key={key} className="bg-slate-800/40 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold tabular-nums">{val}/{max}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center text-sm">
            {axes.map(({ key, label, max }) => (
              <div key={key} className="bg-slate-800/40 rounded-lg p-3">
                <div className="text-slate-400">{label}</div>
                <div className="font-semibold">/{max}</div>
              </div>
            ))}
          </div>
        )}

        {/* Competitive Element */}
        <div className="text-center text-sm text-slate-400 border-t border-slate-700 pt-4">
          Challenge your friends to beat your Cinema Scale score!
        </div>
      </div>
    </Section>
  );
}
