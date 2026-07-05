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
import type { StatsData, PersonFilm } from '../types';
import type { GateResult, SectionToggle } from './section-utils';
import PersonFilmsModal from './PersonFilmsModal';
import { PersonAvatarPlaceholder } from '@/components/results/Placeholders';
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
  films?: PersonFilm[];
}

const PAGE_SIZE = 4;
const EXPANDED_MAX = 8;

// ─── Component ───────────────────────────────────────────────────────────────

export default function DirectorsGrid({ stats, onDirectorClick }: { stats: StatsData; onDirectorClick?: (name: string) => void }) {
  const gate = requiresDirectorsGrid(stats);
  if (!gate.ok) return null;

  return <DirectorsGridInner stats={stats} onDirectorClick={onDirectorClick} />;
}

function DirectorsGridInner({ stats, onDirectorClick }: { stats: StatsData; onDirectorClick?: (name: string) => void }) {
  const [mode, setMode] = useState<SectionToggle>('most_watched');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<DirectorCard | null>(null);

  const hasRatings = (stats.directors_with_ratings?.length ?? 0) > 0;

  // films come from top_directors; carry them into highest_rated rows too
  const filmsByName = useMemo(
    () => new Map((stats.top_directors ?? []).map((d) => [d.name, d.films ?? []])),
    [stats.top_directors],
  );

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
        .sort((a, b) => b.avg_rating - a.avg_rating)
        .map((d) => ({ ...d, films: filmsByName.get(d.name) ?? [] }));
    }
    // Most watched — merge profile_path from directors_with_ratings if present
    const profileMap = new Map(
      (stats.directors_with_ratings ?? []).map((d) => [d.name, d.profile_path]),
    );
    return (stats.top_directors ?? []).map((d) => ({
      ...d,
      profile_path: d.profile_path ?? profileMap.get(d.name),
    }));
  }, [mode, stats.top_directors, stats.directors_with_ratings, hasRatings, filmsByName]);

  const shown = directors.slice(0, visible);
  const hasMore = visible < directors.length;

  return (
    <SectionShell
      title="Directors"
      mode={mode}
      onToggle={handleToggle}
      ratedTabDisabled={!hasRatings}
      ratedTabHint={!hasRatings ? 'Ratings data not available in this export' : undefined}
      ratedTabTooltip="Your average rating across films you&apos;ve rated for each director (minimum 3 rated films)"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            secondaryStat={
              mode === 'highest_rated' && d.avg_rating != null
                ? `${d.count} film${d.count !== 1 ? 's' : ''}`
                : d.avg_rating != null ? `★ ${d.avg_rating.toFixed(1)} avg` : undefined
            }
            onShowFilms={
              d.films && d.films.length > 0
                ? () => {
                    setSelected(d);
                    trackItemClicked('directors_grid', 'director');
                  }
                : undefined
            }
          />
        ))}
      </div>

      <PersonFilmsModal
        open={selected != null}
        onClose={() => setSelected(null)}
        name={selected?.name ?? ''}
        films={selected?.films ?? []}
        profilePath={selected?.profile_path}
      />

      {/* Show more disabled — showing exactly 4 per user request */}

      {/* Scoring explanation */}
      <div className="mt-3 text-center">
        <p className="text-[11px] md:text-xs text-slate-500 italic leading-relaxed max-w-lg mx-auto">
          <strong className="text-slate-400 not-italic">Highest Rated</strong> sorts by{' '}
          <em>your</em> average rating across films you&apos;ve rated for each{' '}
          {mode === 'highest_rated' ? 'director' : 'person'} (minimum 3 rated films).
          {mode === 'most_watched' && hasRatings && (
            <> Switch to <strong className="text-slate-400 not-italic">Highest Rated</strong> to see avg ratings.</>
          )}
        </p>
      </div>
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
  ratedTabTooltip,
  children,
}: {
  title: string;
  mode: SectionToggle;
  onToggle: (m: SectionToggle) => void;
  ratedTabDisabled?: boolean;
  ratedTabHint?: string;
  /** Tooltip for the "Highest Rated" tab explaining what the metric means. */
  ratedTabTooltip?: string;
  children: React.ReactNode;
}) {
  const activeTooltip = ratedTabTooltip
    ? ratedTabTooltip
    : ratedTabHint;
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[#f5d7a8]/[0.12] bg-[#17120f]/85 p-5 shadow-2xl shadow-black/20 md:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,rgba(245,215,168,.05)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative z-10 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f5d7a8]/[0.08] pb-4">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#d8b56d]">Credits index</p>
          <h3 className="text-xl font-black tracking-normal text-[#fff7ed]">{title}</h3>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[#f5d7a8]/[0.12] bg-black/25 p-0.5">
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
            title={ratedTabDisabled ? ratedTabHint : activeTooltip}
            style={ratedTabDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
          >
            Highest Rated
          </button>
        </div>
      </div>
      {children}
      </div>
    </div>
  );
}

/** Circular portrait card shared by Directors and Cast sections. */
export function PersonCard({
  name,
  profilePath,
  primaryStat,
  secondaryStat,
  onShowFilms,
}: {
  name: string;
  profilePath?: string;
  primaryStat: string;
  secondaryStat?: string;
  /** When provided, renders a "+" button that opens this person's films modal. */
  onShowFilms?: () => void;
}) {
  const imageUrl = profilePath ? getProfileUrl(profilePath, 'share') : null;
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retried, setRetried] = useState(false);

  const showImage = imageUrl && !imageError;
  const showFallback = !imageUrl || imageError || !imageLoaded;

  useEffect(() => {
    if (!profilePath) {
      console.debug(`[PersonCard] No profile_path for ${name}`);
    } else if (!imageUrl) {
      console.debug(`[PersonCard] getProfileUrl returned null for ${name}: profilePath=${profilePath}`);
    }
  }, [profilePath, imageUrl, name]);

  const interactive = Boolean(onShowFilms);

  return (
    <div
      className={`group relative flex min-h-[204px] flex-col items-center gap-2 rounded-2xl border border-[#f5d7a8]/[0.08] bg-black/15 p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[#f5d7a8]/[0.2] hover:bg-[#241712]/60 ${interactive ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400' : ''}`}
      {...(interactive
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Show films with ${name}`,
            onClick: onShowFilms,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onShowFilms!();
              }
            },
          }
        : {})}
    >
      {/* Avatar */}
      <div
        className="relative h-28 w-28 overflow-hidden rounded-xl ring-2 ring-[#f5d7a8]/10 transition-all duration-200 group-hover:ring-[#ff8a3d]/40 md:h-32 md:w-32"
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
              const img = e.currentTarget as HTMLImageElement;
              if (!retried && imageUrl) {
                setRetried(true);
                img.src = `${imageUrl}?retry=1`;
              } else {
                setImageError(true);
                setImageLoaded(true);
                img.style.display = 'none';
              }
            }}
          />
        )}
        {showFallback && <PersonAvatarPlaceholder />}
      </div>
      {/* Name + stat */}
      <div className="space-y-0.5">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-[#fff7ed] md:text-base">{name}</p>
        <p className="text-sm text-[#d8b56d] md:text-base">{primaryStat}</p>
        {secondaryStat && (
          <p className="text-xs text-[#b6a99a] md:text-sm">{secondaryStat}</p>
        )}
      </div>
    </div>
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
