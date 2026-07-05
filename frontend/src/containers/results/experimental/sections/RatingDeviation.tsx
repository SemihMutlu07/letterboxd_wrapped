'use client';

/**
 * SECTION 3 — RATED HIGHER / LOWER THAN YOUR AVERAGE
 *
 * Computes delta = yourRating - userAvgRating for each rated film.
 * A) Rated Higher: largest positive delta first
 * B) Rated Lower:  most negative delta first
 *
 * Data requirements:
 *   stats.rated_films  — individual film records with your_rating + average_rating + poster_path
 *   stats.average_rating — user's global average
 *
 * Gating: if rated_films is absent or has < 5 entries, hide section.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getPosterUrl } from '@/lib/analytics';
import { PosterImage } from '@/components/results/Placeholders';
import FilmModal from './FilmModal';
import type { StatsData } from '../types';
import type { GateResult } from './section-utils';
import {
  gateOk,
  gateFail,
  trackSectionViewed,
  trackShowMore,
  trackItemClicked,
  formatDelta,
  LB_GREEN,
} from './section-utils';

// ─── Gating ──────────────────────────────────────────────────────────────────

export function requiresRatingDeviation(stats: StatsData): GateResult {
  if (!stats.rated_films || stats.rated_films.length < 5) {
    return gateFail(
      `rated_films absent or too few (${stats.rated_films?.length ?? 0} < 5).`,
      ['rated_films'],
    );
  }
  if (!hasAverageRating(stats)) {
    return gateFail('average_rating missing.', ['average_rating']);
  }
  return gateOk();
}

type StatsWithAverageRating = StatsData & { average_rating: number };

function hasAverageRating(stats: StatsData): stats is StatsWithAverageRating {
  return typeof stats.average_rating === 'number' && Number.isFinite(stats.average_rating);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedFilm {
  title: string;
  year?: number;
  rating: number;
  /** TMDB community rating on the 0–5 scale. */
  communityRating: number;
  poster_path?: string;
  /** rating − communityRating: how far your score diverges from the crowd. */
  delta: number;
  director?: string;
  runtime?: number;
  language?: string;
  review_text?: string;
}

type SubTab = 'higher' | 'lower';
const PAGE_SIZE = 12;

// ─── Component ───────────────────────────────────────────────────────────────

export default function RatingDeviation({ stats }: { stats: StatsData }) {
  const gate = requiresRatingDeviation(stats);
  if (!gate.ok) return null;

  return <RatingDeviationInner stats={stats as StatsWithAverageRating} />;
}

function RatingDeviationInner({ stats }: { stats: StatsWithAverageRating }) {
  const [tab, setTab] = useState<SubTab>('higher');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedFilm, setSelectedFilm] = useState<EnrichedFilm | null>(null);

  const userAvg = stats.average_rating;

  useEffect(() => {
    trackSectionViewed('rating_deviation');
  }, []);

  const { higher, lower } = useMemo<{ higher: EnrichedFilm[]; lower: EnrichedFilm[] }>(() => {
    // Build lookup of all_films by title for enrichment
    const allFilmsLookup = new Map<string, NonNullable<typeof stats.all_films>[0]>();
    (stats.all_films ?? []).forEach((f) => {
      allFilmsLookup.set(f.title, f);
    });

    const films: EnrichedFilm[] = (stats.rated_films ?? []).map((f) => {
      const enrichedData = allFilmsLookup.get(f.title);
      return {
        title: f.title,
        year: f.year,
        poster_path: f.poster_path,
        rating: f.your_rating ?? 0,
        communityRating: f.average_rating ?? 0,
        delta: Math.round(((f.your_rating ?? 0) - userAvg) * 10) / 10,
        director: enrichedData?.director,
        runtime: enrichedData?.runtime,
        language: enrichedData?.language,
      };
    });
    return {
      higher: films.filter((f) => f.delta > 0).sort((a, b) => b.delta - a.delta),
      lower: films.filter((f) => f.delta < 0).sort((a, b) => a.delta - b.delta),
    };
  }, [stats.rated_films, stats.all_films]);

  const list = tab === 'higher' ? higher : lower;
  const shown = list.slice(0, visible);
  const hasMore = visible < list.length;

  const handleTabChange = (next: SubTab) => {
    setTab(next);
    setVisible(PAGE_SIZE);
  };

  return (
    <>
      <FilmModal
        open={selectedFilm !== null}
        onClose={() => setSelectedFilm(null)}
        film={selectedFilm || {
          title: '',
          rating: 0,
          communityRating: 0,
        }}
        userAvg={userAvg}
      />
      <div className="relative overflow-hidden rounded-[24px] border border-[#f5d7a8]/[0.12] bg-[#17120f]/85 p-5 shadow-2xl shadow-black/20 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,rgba(245,215,168,.05)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f5d7a8]/[0.08] pb-4">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#d8b56d]">Contact sheet</p>
            <h3 className="text-xl font-black tracking-normal text-[#fff7ed]">Your Rating Outliers</h3>
            <p className="mt-0.5 text-xs text-[#b6a99a]">
              Where your rating diverges most from the crowd · your avg ★ {userAvg.toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[#f5d7a8]/[0.12] bg-black/25 p-0.5">
            <SubtabButton active={tab === 'higher'} color="green" onClick={() => handleTabChange('higher')}>
              Rated Higher
            </SubtabButton>
            <SubtabButton active={tab === 'lower'} color="red" onClick={() => handleTabChange('lower')}>
              Rated Lower
            </SubtabButton>
          </div>
        </div>

        {/* Empty state */}
        {shown.length === 0 && (
          <p className="text-sm text-[#8d7f70] italic text-center py-8">
            {tab === 'higher'
              ? 'No films rated above your average.'
              : 'No films rated below your average.'}
          </p>
        )}

        {/* Film grid */}
        {shown.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
            {shown.map((film) => (
              <FilmPosterCard
                key={`${film.title}-${film.year}`}
                film={film}
                userAvg={userAvg}
                polarity={tab}
                onOpenModal={(f) => {
                  setSelectedFilm(f);
                  trackItemClicked('rating_deviation', 'film');
                }}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-1">
            <button
              onClick={() => {
                setVisible((v) => v + PAGE_SIZE);
                trackShowMore('rating_deviation');
              }}
              className="rounded-full border border-[#f5d7a8]/[0.14] px-4 py-2 text-xs font-semibold text-[#b6a99a] transition-colors hover:border-[#ff8a3d]/50 hover:text-[#fff7ed]"
            >
              Show {Math.min(list.length - visible, PAGE_SIZE)} more
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

// ─── Film poster card ─────────────────────────────────────────────────────────

function FilmPosterCard({
  film,
  userAvg,
  polarity,
  onOpenModal,
}: {
  film: EnrichedFilm;
  userAvg: number;
  polarity: SubTab;
  onOpenModal?: (film: EnrichedFilm) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const imageUrl = film.poster_path ? getPosterUrl(film.poster_path, 'grid') : null;
  const deltaStr = formatDelta(film.delta);
  const deltaColor = polarity === 'higher' ? LB_GREEN : '#f87171';
  const showFallback = !imageUrl || imgFailed;

  const handleClick = () => {
    setRevealed((prev) => !prev);
  };

  const handleModalClick = () => {
    onOpenModal?.(film);
  };

  return (
    <div
      onClick={handleClick}
      className="flex min-w-0 flex-col gap-1.5 text-left group cursor-default"
    >
      {/* Poster */}
      <div
        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/8 group-hover:ring-white/20 transition-all"
      >
        {imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={film.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PosterImage src={showFallback ? null : imageUrl} alt={`${film.title} poster`} />
        )}
        {/* Delta badge */}
        <span
          className="absolute top-1.5 right-1.5 text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10"
          style={{ background: deltaColor, color: '#000', border: `1px solid ${deltaColor}` }}
        >
          {deltaStr}
        </span>

        {/* ↗ hint icon */}
        {!revealed && (
          <span className="absolute bottom-1.5 right-1.5 text-white/40 text-xs leading-none pointer-events-none">
            ↗
          </span>
        )}

        {/* Bottom panel overlay — covers lower ~55% of poster */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-[55%] flex flex-col items-center justify-center gap-2 p-4 bg-[#0f0f0f]/95 transition-transform duration-300 ease-out ${
            revealed ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <p className="text-sm font-bold text-white leading-tight line-clamp-3 text-center">
            {film.title}
          </p>
          {film.year && (
            <p className="text-xs text-slate-300">{film.year}</p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleModalClick();
            }}
            className="mt-1 text-[11px] font-semibold px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors text-center"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Caption */}
      <div className="min-w-0 px-0.5 space-y-0.5">
        <p className="text-xs font-medium text-white leading-tight line-clamp-1">{film.title}</p>
        <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
          ★ {film.rating.toFixed(1)} vs avg {userAvg.toFixed(1)}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SubtabButton({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: 'green' | 'red';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const accent = color === 'green' ? '#00c030' : '#f87171';
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 min-h-[44px] rounded-full text-xs font-semibold transition-colors"
      style={
        active
          ? { background: accent + '26', color: accent, border: `1px solid ${accent}4d` }
          : { color: '#cbd5e1' }
      }
    >
      {children}
    </button>
  );
}
