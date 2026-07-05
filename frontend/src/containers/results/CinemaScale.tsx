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
    { key: 'geography',  label: 'Geographic',  max: 25, color: 'bg-[#7bbf86]' },
    { key: 'temporal',   label: 'Historical',   max: 20, color: 'bg-[#d8b56d]' },
    { key: 'languages',  label: 'Languages',    max: 15, color: 'bg-[#64b4bf]' },
    { key: 'volume',     label: 'Volume',       max: 15, color: 'bg-[#ff8a3d]' },
    { key: 'genres',     label: 'Genres',       max: 15, color: 'bg-[#d95f4f]' },
    { key: 'directors',  label: 'Directors',    max: 10, color: 'bg-[#f4cf75]' },
  ];

  return (
    <Section title="Your Cinema Scale" subtitle="How adventurous is your film taste?">
      <div className="rounded-[22px] border border-[#f5d7a8]/[0.12] bg-black/20 p-5 md:p-7 space-y-6">
        {/* Main Score Display */}
        <div className="text-center mb-6">
          <div className="text-5xl md:text-7xl font-black tabular-nums text-[#fff7ed]">
            {score}<span className="text-2xl text-[#b6a99a]">/100</span>
          </div>
          <div className="text-[#d8b56d] mt-2 font-bold uppercase tracking-[0.12em] text-xs md:text-sm">{getScoreMessage(score)}</div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full h-4 bg-black/35 rounded-full overflow-hidden border border-[#f5d7a8]/[0.08]">
            <div
              className="h-full bg-[linear-gradient(90deg,#ff8a3d,#d8b56d,#64b4bf)] transition-all duration-1000 ease-out"
              style={{ width: `${score}%` }}
            />
          </div>
          {/* Score markers */}
          <div className="flex justify-between text-xs text-[#8d7f70] mt-2">
            <span>Mainstream</span>
            <span>Balanced</span>
            <span>Arthouse</span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="text-center">
            <p className="text-[#d6c6b4] text-base leading-relaxed">
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
                <div key={key} className="rounded-xl border border-[#f5d7a8]/[0.08] bg-[#211711]/60 p-3 space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[#b6a99a]">{label}</span>
                    <span className="font-semibold tabular-nums text-[#fff7ed]">{val}/{max}</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/35 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center text-sm">
            {axes.map(({ key, label, max }) => (
              <div key={key} className="rounded-xl border border-[#f5d7a8]/[0.08] bg-[#211711]/60 p-3">
                <div className="text-[#b6a99a]">{label}</div>
                <div className="font-semibold text-[#fff7ed]">/{max}</div>
              </div>
            ))}
          </div>
        )}

        {/* Competitive Element */}
        <div className="text-center text-sm text-[#b6a99a] border-t border-[#f5d7a8]/[0.08] pt-4">
          Challenge your friends to beat your Cinema Scale score!
        </div>
      </div>
    </Section>
  );
}
