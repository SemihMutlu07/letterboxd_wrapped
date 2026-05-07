'use client';

/**
 * DevDebugPanel — shown only in development.
 * Lists which sections are gated (hidden) and why.
 * Never rendered in production builds.
 */

import React, { useState } from 'react';
import type { StatsData } from '../types';
import { requiresDirectorsGrid } from './DirectorsGrid';
import { requiresCastGrid } from './CastGrid';
import { requiresRatingDeviation } from './RatingDeviation';
import { requiresCountriesSection } from './CountriesSection';
import { requiresWorldMap } from './world-map/WorldMapSection';
import type { GateResult } from './section-utils';

interface SectionStatus {
  label: string;
  gate: GateResult;
  /** Extra notes (e.g. which tabs are gated within a section). */
  notes?: string[];
}

function buildStatus(stats: StatsData): SectionStatus[] {
  const dirGate = requiresDirectorsGrid(stats);
  const castGate = requiresCastGrid(stats);
  const devGate = requiresRatingDeviation(stats);
  const ctryGate = requiresCountriesSection(stats);
  const mapGate = requiresWorldMap(stats);

  const dirNotes: string[] = [];
  if (dirGate.ok && !(stats.directors_with_ratings?.length)) {
    dirNotes.push('Highest-Rated tab disabled — directors_with_ratings absent');
  }
  const castNotes: string[] = [];
  if (castGate.ok && !(stats.actors_with_ratings?.length)) {
    castNotes.push('Highest-Rated tab disabled — actors_with_ratings absent');
  }
  const ctryNotes: string[] = [];
  if (ctryGate.ok && !(stats.countries_with_ratings?.length)) {
    ctryNotes.push('Highest-Rated tab disabled — countries_with_ratings absent');
  }
  const mapNotes: string[] = [];
  if (mapGate.ok) {
    const hasIso = (stats.countries_iso_data?.length ?? 0) > 0;
    if (!hasIso) mapNotes.push('Map coloring disabled: countries_iso_data absent');
    const hasRatedMode = stats.countries_iso_data?.some((c) => c.avg_rating != null) ?? false;
    if (!hasRatedMode) mapNotes.push('Highest-Rated toggle disabled: no country avg_rating data');
    mapNotes.push('Time filter disabled in v1: needs per-film diary date plus country data');
  }

  return [
    { label: 'Directors Grid', gate: dirGate, notes: dirNotes },
    { label: 'Cast Grid', gate: castGate, notes: castNotes },
    { label: 'Rating Deviation', gate: devGate },
    { label: 'Countries', gate: ctryGate, notes: ctryNotes },
    { label: 'World Map', gate: mapGate, notes: mapNotes },
  ];
}

export default function DevDebugPanel({ stats }: { stats: StatsData }) {
  const [open, setOpen] = useState(false);

  // Only render in dev
  if (process.env.NODE_ENV !== 'development') return null;

  const sections = buildStatus(stats);
  const hiddenCount = sections.filter((s) => !s.gate.ok).length;

  return (
    <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl overflow-hidden text-xs">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-yellow-400 font-mono font-semibold hover:bg-yellow-500/10 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span>[DEV] Section Gate Status — {hiddenCount} hidden</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          {sections.map((s) => (
            <div key={s.label}>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${s.gate.ok ? 'bg-green-400' : 'bg-red-400'}`}
                />
                <span className="font-semibold text-slate-300">{s.label}</span>
                {s.gate.ok ? (
                  <span className="text-green-400/70">visible</span>
                ) : (
                  <span className="text-red-400/70">hidden</span>
                )}
              </div>
              {!s.gate.ok && (
                <div className="ml-4 mt-1 space-y-0.5">
                  <p className="text-slate-500">Reason: {s.gate.reason}</p>
                  {s.gate.missingFields.length > 0 && (
                    <p className="text-slate-600 font-mono">
                      Missing: {s.gate.missingFields.join(', ')}
                    </p>
                  )}
                </div>
              )}
              {s.notes?.map((note) => (
                <p key={note} className="ml-4 mt-0.5 text-yellow-400/60">
                  ⚠ {note}
                </p>
              ))}
            </div>
          ))}

          <hr className="border-yellow-500/20 my-2" />
          <p className="text-slate-600 font-mono">
            countries_iso_data: {stats.countries_iso_data?.length ?? 'absent'} ·
            rated_films: {stats.rated_films?.length ?? 'absent'} ·
            directors_with_ratings: {stats.directors_with_ratings?.length ?? 'absent'} ·
            actors_with_ratings: {stats.actors_with_ratings?.length ?? 'absent'} ·
            countries_with_ratings: {stats.countries_with_ratings?.length ?? 'absent'}
          </p>
        </div>
      )}
    </div>
  );
}
