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
import { getDirectTmdbImageUrl } from '@/lib/analytics';
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
    <section className="border-b border-[var(--results-border)] py-8 md:py-12">
      <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="results-kicker mb-1">Credits</p>
          <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--results-text)]">{title}</h3>
        </div>
        <div className="results-segmented">
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
    </section>
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
  const imageUrl = profilePath ? getDirectTmdbImageUrl(profilePath, 'w500') : null;
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retried, setRetried] = useState(false);

  const showImage = imageUrl && !imageError;
  const showFallback = !imageUrl || imageError || !imageLoaded;

  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setRetried(false);
  }, [name, profilePath]);

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
      className={`group relative flex min-h-[220px] flex-col items-start gap-3 border-t border-[var(--results-border)] py-4 text-left transition-colors ${interactive ? 'cursor-pointer hover:bg-[color-mix(in_srgb,var(--results-text)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--results-accent)]' : ''}`}
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
        className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--results-surface)]"
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
        <p className="line-clamp-2 text-base font-semibold leading-tight text-[var(--results-text)]">{name}</p>
        <p className="text-sm text-[var(--results-accent)]">{primaryStat}</p>
        {secondaryStat && (
          <p className="text-xs text-[var(--results-muted)] md:text-sm">{secondaryStat}</p>
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
        className="results-secondary-action px-4 py-2 text-xs font-semibold transition-colors"
      >
        Show {Math.min(remaining, PAGE_SIZE)} more
      </button>
    </div>
  );
}
