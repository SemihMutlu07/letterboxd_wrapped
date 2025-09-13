'use client';

import React from 'react';
import Section from '@/components/results/Section';

export default function CinemaScale({
  description,
  score,
}: {
  type?: string; // Unused - tier names removed
  description?: string;
  score: number;
}) {
  // Determine tier and color based on score
  const getTier = (score: number) => {
    if (score >= 90) return { 
      tier: 'Film Connoisseur', 
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      textColor: 'text-yellow-400',
      description: 'Exceptional taste in world cinema with deep historical knowledge.'
    };
    if (score >= 80) return { 
      tier: 'Arthouse Enthusiast', 
      color: 'from-purple-400 to-pink-500',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      textColor: 'text-purple-400',
      description: 'You actively seek challenging and international films.'
    };
    if (score >= 70) return { 
      tier: 'Independent Cinephile', 
      color: 'from-blue-400 to-cyan-500',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      textColor: 'text-blue-400',
      description: 'Strong appreciation for independent and foreign cinema.'
    };
    if (score >= 60) return { 
      tier: 'Eclectic Viewer', 
      color: 'from-green-400 to-teal-500',
      bgColor: 'bg-green-500/10 border-green-500/30',
      textColor: 'text-green-400',
      description: 'You enjoy a diverse range of films across genres and eras.'
    };
    if (score >= 50) return { 
      tier: 'Curious Moviegoer', 
      color: 'from-indigo-400 to-purple-500',
      bgColor: 'bg-indigo-500/10 border-indigo-500/30',
      textColor: 'text-indigo-400',
      description: 'You explore beyond mainstream while enjoying popular films.'
    };
    if (score >= 40) return { 
      tier: 'Casual Viewer', 
      color: 'from-orange-400 to-yellow-500',
      bgColor: 'bg-orange-500/10 border-orange-500/30',
      textColor: 'text-orange-400',
      description: 'You enjoy popular films with occasional variety.'
    };
    if (score >= 30) return { 
      tier: 'Mainstream Fan', 
      color: 'from-red-400 to-orange-500',
      bgColor: 'bg-red-500/10 border-red-500/30',
      textColor: 'text-red-400',
      description: 'You prefer well-known and accessible cinema.'
    };
    return { 
      tier: 'Blockbuster Lover', 
      color: 'from-pink-400 to-red-500',
      bgColor: 'bg-pink-500/10 border-pink-500/30',
      textColor: 'text-pink-400',
      description: 'You love the biggest hits and popular entertainment.'
    };
  };

  // const tierInfo = getTier(score); // Unused - tier display removed

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

        {/* Score Breakdown Hints */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400">Geographic</div>
            <div className="font-semibold">25%</div>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400">Historical</div>
            <div className="font-semibold">20%</div>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400">Languages</div>
            <div className="font-semibold">15%</div>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400">Other</div>
            <div className="font-semibold">40%</div>
          </div>
        </div>

        {/* Competitive Element */}
        <div className="text-center text-sm text-slate-400 border-t border-slate-700 pt-4">
          Challenge your friends to beat your Cinema Scale score!
        </div>
      </div>
    </Section>
  );
}


