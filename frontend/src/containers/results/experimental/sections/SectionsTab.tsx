'use client';

/**
 * SectionsTab — rendered inside ExperimentalScreen when activeTab === 'sections'.
 * Stacks all experimental Letterboxd-style sections with gating + dev debug panel.
 */

import React from 'react';
import type { StatsData } from '../types';
import DirectorsGrid from './DirectorsGrid';
import CastGrid from './CastGrid';
import RatingDeviation from './RatingDeviation';
import CountriesSection from './CountriesSection';
import WorldMapSection from './world-map/WorldMapSection';
import DevDebugPanel from './DevDebugPanel';

export default function SectionsTab({ stats }: { stats: StatsData }) {
  return (
    <div className="space-y-4">
      <DevDebugPanel stats={stats} />
      <DirectorsGrid stats={stats} />
      <CastGrid stats={stats} />
      <RatingDeviation stats={stats} />
      <CountriesSection stats={stats} />
      <WorldMapSection stats={stats} />
    </div>
  );
}
