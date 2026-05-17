'use client';

/**
 * SECTION 2 — CAST GRID
 * Mirrors DirectorsGrid for actors/cast.
 *
 * Data requirements:
 *   Most watched  → stats.top_actors (always present if cast exists)
 *   Highest rated → stats.actors_with_ratings (emitted by backend when ratings available)
 *
 * Gating: if top_actors is empty, hide the entire section.
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
  trackItemClicked,
} from './section-utils';
import { SectionShell, PersonCard, ShowMoreButton } from './DirectorsGrid';

// ─── Gating ──────────────────────────────────────────────────────────────────

export function requiresCastGrid(stats: StatsData): GateResult {
  if (!stats.top_actors || stats.top_actors.length === 0) {
    return gateFail('No cast data in this export.', ['top_actors']);
  }
  return gateOk();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActorCard {
  name: string;
  count: number;
  avg_rating?: number;
  rated_count?: number;
  profile_path?: string;
}

const PAGE_SIZE = 3;

// ─── Component ───────────────────────────────────────────────────────────────

export default function CastGrid({ stats }: { stats: StatsData }) {
  const gate = requiresCastGrid(stats);
  if (!gate.ok) return null;

  return <CastGridInner stats={stats} />;
}

function CastGridInner({ stats }: { stats: StatsData }) {
  const [mode, setMode] = useState<SectionToggle>('most_watched');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const hasRatings = (stats.actors_with_ratings?.length ?? 0) > 0;

  useEffect(() => {
    trackSectionViewed('cast_grid');
  }, []);

  const handleToggle = useCallback((next: SectionToggle) => {
    setMode(next);
    setVisible(PAGE_SIZE);
    trackToggleChanged('cast_grid', next);
  }, []);

  const actors: ActorCard[] = useMemo(() => {
    if (mode === 'highest_rated' && hasRatings) {
      return (stats.actors_with_ratings ?? [])
        .slice()
        .sort((a, b) => b.avg_rating - a.avg_rating);
    }
    // Most watched — pull profile_paths from actors_with_ratings if available
    const profileMap = new Map(
      (stats.actors_with_ratings ?? []).map((a) => [a.name, a.profile_path]),
    );
    return (stats.top_actors ?? []).map((a) => ({
      ...a,
      profile_path: a.profile_path ?? profileMap.get(a.name),
    }));
  }, [mode, stats.top_actors, stats.actors_with_ratings, hasRatings]);

  const shown = actors.slice(0, visible);
  const hasMore = visible < actors.length;

  return (
    <SectionShell
      title="Cast"
      mode={mode}
      onToggle={handleToggle}
      ratedTabDisabled={!hasRatings}
      ratedTabHint={!hasRatings ? 'Ratings data not available in this export' : undefined}
  ratedTabTooltip="Your average rating across films you&apos;ve rated for each actor (minimum 3 rated films)"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {shown.map((a) => (
          <PersonCard
            key={a.name}
            name={a.name}
            profilePath={a.profile_path}
            primaryStat={
              mode === 'highest_rated' && a.avg_rating != null
                ? `★ ${a.avg_rating.toFixed(1)} avg`
                : `${a.count} film${a.count !== 1 ? 's' : ''}`
            }
            onClick={() => trackItemClicked('cast_grid', 'actor')}
          />
        ))}
      </div>

      {hasMore && (
        <ShowMoreButton
          onClick={() => {
            setVisible((v) => v + PAGE_SIZE);
            trackShowMore('cast_grid');
          }}
          remaining={actors.length - visible}
        />
      )}
    </SectionShell>
  );
}
