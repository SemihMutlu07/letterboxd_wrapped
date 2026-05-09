'use client';

/**
 * SECTION 1 — DIRECTORS GRID
 * Two-tab toggle: Most Watched / Highest Rated
 * Letterboxd dark UI vibe — circular portrait cards, pagination, time filter.
 *
 * Data requirements:
 *   Most watched  → stats.top_directors (always present if directors exist)
 *   Highest rated → stats.directors_with_ratings (emitted by backend when ratings data available)
 *
 * Gating: if top_directors is empty, hide the entire section.
 * Highest-rated tab is gated independently to directors_with_ratings presence.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getProfileUrl } from '@/lib/analytics';
import type { StatsData } from '../types';
import type { GateResult, SectionToggle } from './section-utils';
import {
  gateOk,
  gateFail,
  trackSectionViewed,
  trackToggleChanged,
  trackShowMore,
  trackItemClicked,
  toggleClass,
} from './section-utils';

// ─── Gating ──────────────────────────────────────────────────────────────────

export function requiresDirectorsGrid(stats: StatsData): GateResult {
  if (!stats.top_directors || stats.top_directors.length === 0) {
    return gateFail('No director data in this export.', ['top_directors']);
  }
  return gateOk();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DirectorCard {
  name: string;
  count: number;
  avg_rating?: number;
  rated_count?: number;
  profile_path?: string;
}

const PAGE_SIZE = 10;

// ─── Component ───────────────────────────────────────────────────────────────

export default function DirectorsGrid({ stats }: { stats: StatsData }) {
  const gate = requiresDirectorsGrid(stats);
  if (!gate.ok) return null;

  return <DirectorsGridInner stats={stats} />;
}

function DirectorsGridInner({ stats }: { stats: StatsData }) {
  const [mode, setMode] = useState<SectionToggle>('most_watched');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const hasRatings = (stats.directors_with_ratings?.length ?? 0) > 0;

  // Track section viewed once on mount
  useEffect(() => {
    trackSectionViewed('directors_grid');
  }, []);

  const handleToggle = useCallback(
    (next: SectionToggle) => {
      setMode(next);
      setVisible(PAGE_SIZE);
      trackToggleChanged('directors_grid', next);
    },
    [],
  );

  const directors: DirectorCard[] = useMemo(() => {
    if (mode === 'highest_rated' && hasRatings) {
      return (stats.directors_with_ratings ?? [])
        .slice()
        .sort((a, b) => b.avg_rating - a.avg_rating);
    }
    // Most watched — merge profile_path from directors_with_ratings if present
    const profileMap = new Map(
      (stats.directors_with_ratings ?? []).map((d) => [d.name, d.profile_path]),
    );
    return (stats.top_directors ?? []).map((d) => ({
      ...d,
      profile_path: d.profile_path ?? profileMap.get(d.name),
    }));
  }, [mode, stats.top_directors, stats.directors_with_ratings, hasRatings]);

  const shown = directors.slice(0, visible);
  const hasMore = visible < directors.length;

  return (
    <SectionShell
      title="Directors"
      mode={mode}
      onToggle={handleToggle}
      ratedTabDisabled={!hasRatings}
      ratedTabHint={!hasRatings ? 'Ratings data not available in this export' : undefined}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {shown.map((d) => (
          <PersonCard
            key={d.name}
            name={d.name}
            profilePath={d.profile_path}
            primaryStat={
              mode === 'highest_rated' && d.avg_rating != null
                ? `★ ${d.avg_rating.toFixed(1)} avg`
                : `${d.count} film${d.count !== 1 ? 's' : ''}`
            }
            onClick={() => trackItemClicked('directors_grid', 'director')}
          />
        ))}
      </div>

      {hasMore && (
        <ShowMoreButton
          onClick={() => {
            setVisible((v) => v + PAGE_SIZE);
            trackShowMore('directors_grid');
          }}
          remaining={directors.length - visible}
        />
      )}
    </SectionShell>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

/** Outer chrome for every section: heading + toggle + children. */
export function SectionShell({
  title,
  mode,
  onToggle,
  ratedTabDisabled,
  ratedTabHint,
  children,
}: {
  title: string;
  mode: SectionToggle;
  onToggle: (m: SectionToggle) => void;
  ratedTabDisabled?: boolean;
  ratedTabHint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <div className="flex items-center gap-1 p-0.5 bg-slate-800/60 border border-slate-700/30 rounded-full">
          <button
            className={toggleClass(mode === 'most_watched')}
            onClick={() => onToggle('most_watched')}
          >
            Most Watched
          </button>
          <button
            className={toggleClass(mode === 'highest_rated')}
            onClick={() => !ratedTabDisabled && onToggle('highest_rated')}
            disabled={ratedTabDisabled}
            title={ratedTabHint}
            style={ratedTabDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
          >
            Highest Rated
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Circular portrait card shared by Directors and Cast sections. */
export function PersonCard({
  name,
  profilePath,
  primaryStat,
  onClick,
}: {
  name: string;
  profilePath?: string;
  primaryStat: string;
  onClick?: () => void;
}) {
  const imageUrl = profilePath ? getProfileUrl(profilePath, 'share') : null;
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Deterministic gradient from name
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const gradient = `hsl(${hue},40%,25%)`;

  const showImage = imageUrl && !imageError;
  const showFallback = !imageUrl || imageError || !imageLoaded;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group cursor-default text-center"
    >
      {/* Avatar */}
      <div
        className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden ring-2 ring-white/5 group-hover:ring-white/20 transition-all duration-200"
        style={{ background: gradient }}
      >
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt={name}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={(e) => {
              console.error(`[PersonCard] Image failed for ${name}:`, imageUrl);
              setImageError(true);
              setImageLoaded(true);
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {showFallback && (
          <span className="flex items-center justify-center w-full h-full text-xl font-bold text-white/70">
            {initials}
          </span>
        )}
      </div>
      {/* Name + stat */}
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white leading-tight line-clamp-2">{name}</p>
        <p className="text-xs text-slate-300">{primaryStat}</p>
      </div>
    </button>
  );
}

/** "Show X more" button. */
export function ShowMoreButton({
  onClick,
  remaining,
}: {
  onClick: () => void;
  remaining: number;
}) {
  return (
    <div className="flex justify-center pt-2">
      <button
        onClick={onClick}
        className="text-xs font-semibold px-4 py-2 rounded-full border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
      >
        Show {Math.min(remaining, PAGE_SIZE)} more
      </button>
    </div>
  );
}
