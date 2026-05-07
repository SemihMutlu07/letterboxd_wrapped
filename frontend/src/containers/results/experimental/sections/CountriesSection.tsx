'use client';

/**
 * SECTION 4 — COUNTRIES ("Cinematic Departure Board")
 *
 * Film-strip progress bars, monospace counts, country outlines.
 *
 * Data requirements:
 *   Most watched  → stats.top_countries
 *   Highest rated → stats.countries_with_ratings
 *
 * Gating: if top_countries is empty, hide section.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { StatsData } from '../types';
import type { GateResult, SectionToggle } from './section-utils';
import {
  gateOk,
  gateFail,
  trackSectionViewed,
  trackToggleChanged,
  trackShowMore,
} from './section-utils';
import { ShowMoreButton } from './DirectorsGrid';
import CountryOutline from './CountryOutline';

// ─── Gating ──────────────────────────────────────────────────────────────────

export function requiresCountriesSection(stats: StatsData): GateResult {
  if (!stats.top_countries || stats.top_countries.length === 0) {
    return gateFail('No country data in this export.', ['top_countries']);
  }
  return gateOk();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CountryRow {
  name: string;
  count: number;
  avg_rating?: number;
  rated_count?: number;
  barValue: number; // normalised 0-100 for bar width
  iso2?: string;
}

const PAGE_SIZE = 10;

// ─── Film Strip Bar SVG pattern ─────────────────────────────────────────────

/** Inline SVG pattern for the film-strip perforation look. */
function FilmStripBar({ widthPct }: { widthPct: number }) {
  const patternId = 'film-perf';
  return (
    <div className="relative h-5 rounded bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
      {/* Perforation holes — top row */}
      <div className="absolute top-0 left-0 right-0 h-[5px] flex items-center gap-[6px] px-1 z-10">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={`t${i}`}
            className="w-[3px] h-[3px] rounded-[0.5px] bg-[#1a1a1a] shrink-0"
          />
        ))}
      </div>
      {/* Perforation holes — bottom row */}
      <div className="absolute bottom-0 left-0 right-0 h-[5px] flex items-center gap-[6px] px-1 z-10">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={`b${i}`}
            className="w-[3px] h-[3px] rounded-[0.5px] bg-[#1a1a1a] shrink-0"
          />
        ))}
      </div>
      {/* Fill gradient */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
        style={{
          width: `${widthPct}%`,
          background: 'linear-gradient(90deg, #00c030, #00e676, #00c030)',
          boxShadow: widthPct > 0 ? '0 0 12px rgba(0,192,48,0.3)' : undefined,
        }}
      />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CountriesSection({ stats }: { stats: StatsData }) {
  const gate = requiresCountriesSection(stats);
  if (!gate.ok) return null;

  return <CountriesSectionInner stats={stats} />;
}

function CountriesSectionInner({ stats }: { stats: StatsData }) {
  const [mode, setMode] = useState<SectionToggle>('most_watched');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const hasRatings = (stats.countries_with_ratings?.length ?? 0) > 0;

  useEffect(() => {
    trackSectionViewed('countries_section');
  }, []);

  const handleToggle = useCallback(
    (next: SectionToggle) => {
      setMode(next);
      setVisible(PAGE_SIZE);
      trackToggleChanged('countries_section', next);
    },
    [],
  );

  // Build name → iso2 lookup from countries_iso_data
  const nameToIso2 = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of stats.countries_iso_data ?? []) {
      if (c.iso2 && c.name) map[c.name] = c.iso2;
    }
    return map;
  }, [stats.countries_iso_data]);

  const rows: CountryRow[] = useMemo(() => {
    if (mode === 'highest_rated' && hasRatings) {
      const sorted = (stats.countries_with_ratings ?? [])
        .slice()
        .sort((a, b) => b.avg_rating - a.avg_rating);
      return sorted.map((c) => ({
        ...c,
        barValue: (c.avg_rating / 5) * 100,
        iso2: nameToIso2[c.name],
      }));
    }
    const src = (stats.top_countries ?? []).slice().sort((a, b) => b.count - a.count);
    const maxCount = src[0]?.count ?? 1;
    return src.map((c) => ({
      ...c,
      barValue: (c.count / maxCount) * 100,
      iso2: nameToIso2[c.name],
    }));
  }, [mode, stats.top_countries, stats.countries_with_ratings, hasRatings, nameToIso2]);

  const shown = rows.slice(0, visible);
  const hasMore = visible < rows.length;
  const total = (stats.top_countries ?? []).reduce((s, c) => s + c.count, 0);

  return (
    <div className="bg-[#111111]/90 border border-white/[0.06] rounded-2xl p-5 md:p-6 space-y-5">
      {/* Header — departure board style */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
            Destinations
          </h3>
          <p className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" }}>
            {stats.top_countries?.length ?? 0}{' '}
            <span className="text-slate-500 text-sm font-normal">countries</span>
            {' · '}
            {total}{' '}
            <span className="text-slate-500 text-sm font-normal">films</span>
          </p>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 border border-slate-700/30 rounded-full">
          <button
            className={tabClass(mode === 'most_watched')}
            onClick={() => handleToggle('most_watched')}
          >
            Most Watched
          </button>
          <button
            className={tabClass(mode === 'highest_rated')}
            onClick={() => !hasRatings && undefined || handleToggle('highest_rated')}
            disabled={!hasRatings}
            title={!hasRatings ? 'Ratings data not available in this export' : undefined}
            style={!hasRatings ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
          >
            Highest Rated
          </button>
        </div>
      </div>

      {/* Departure board list */}
      <div className="space-y-3">
        {shown.map((row, i) => (
          <CountryBar
            key={row.name}
            rank={i + 1}
            row={row}
            mode={mode}
            total={total}
          />
        ))}
      </div>

      {hasMore && (
        <ShowMoreButton
          onClick={() => {
            setVisible((v) => v + PAGE_SIZE);
            trackShowMore('countries_section');
          }}
          remaining={rows.length - visible}
        />
      )}
    </div>
  );
}

// ─── Country bar row ──────────────────────────────────────────────────────────

function CountryBar({
  rank,
  row,
  mode,
  total,
}: {
  rank: number;
  row: CountryRow;
  mode: SectionToggle;
  total: number;
}) {
  const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0';
  const monoFont = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

  return (
    <div className="flex items-center gap-3 group">
      {/* Rank */}
      <span
        className="w-6 text-right text-xs shrink-0"
        style={{
          fontFamily: monoFont,
          color: rank <= 3 ? '#00c030' : '#475569',
          fontWeight: rank <= 3 ? 700 : 400,
        }}
      >
        {String(rank).padStart(2, '0')}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-200 truncate flex items-center gap-2">
            {row.iso2 && <CountryOutline iso2={row.iso2} size={28} color={rank <= 3 ? 'rgba(0,192,48,0.5)' : 'rgba(255,255,255,0.3)'} />}
            <span className={rank <= 3 ? 'text-white font-semibold' : ''}>{row.name}</span>
          </span>
          <span
            className="text-xs shrink-0"
            style={{
              fontFamily: monoFont,
              color: mode === 'highest_rated' ? '#00e676' : '#94a3b8',
            }}
          >
            {mode === 'highest_rated' && row.avg_rating != null
              ? `★ ${row.avg_rating.toFixed(2)}`
              : `${row.count} film${row.count !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Film strip bar */}
        <FilmStripBar widthPct={row.barValue} />

        <div className="flex items-center justify-between">
          {mode === 'most_watched' && (
            <p className="text-[10px] text-slate-600" style={{ fontFamily: monoFont }}>
              {pct}% of all watches
            </p>
          )}
          {mode === 'highest_rated' && row.rated_count != null && (
            <p className="text-[10px] text-slate-600" style={{ fontFamily: monoFont }}>
              {row.rated_count} rated films
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tabClass(active: boolean): string {
  return active
    ? 'px-3 py-1 rounded-full text-xs font-semibold bg-[#00c030]/20 text-[#00c030] border border-[#00c030]/30 transition-colors'
    : 'px-3 py-1 rounded-full text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors';
}
