'use client';

import React, { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import type { StatsData } from './types';
import SectionsTab from './sections/SectionsTab';

interface Props {
  stats: StatsData;
}

export default function ExperimentalScreen({ stats }: Props) {
  useEffect(() => {
    trackEvent('results_test_opened');
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Director's Note banner ── */}
      <div className="relative bg-[#1a1a1a]/60 border border-white/[0.06] rounded-2xl px-6 py-4 overflow-hidden">
        {/* Subtle film-frame accent */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#00c030]/60 via-[#00c030]/20 to-transparent" />
        <div className="flex items-start gap-3 pl-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-slate-500">
            <path d="M7 4v16l10-8L7 4z" fill="currentColor" opacity="0.6" />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-400" style={{ fontStyle: 'italic' }}>
              Director&apos;s Note
            </p>
            <p className="text-xs text-slate-500 mt-0.5" style={{ fontStyle: 'italic' }}>
              Behind-the-scenes look at upcoming stats and visualizations.
              Things here are still in the cutting room.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sections content ── */}
      <SectionsTab stats={stats} />
    </div>
  );
}
