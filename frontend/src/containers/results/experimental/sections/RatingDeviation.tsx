'use client';

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

type RatedFilm = NonNullable<StatsData['rated_films']>[number];

interface EnrichedFilm {
  title: string;
  year?: number;
  rating: number;
  communityRating: number;
  poster_path?: string;
  delta: number;
  director?: string;
  runtime?: number;
  language?: string;
  review_text?: string;
}

type SubTab = 'higher' | 'lower';

const PAGE_SIZE = 12;

function getCommunityRating(film: RatedFilm): number | null {
  const value = film.community_rating ?? film.average_rating;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedTitle(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizedYear(value: unknown): string | null {
  const year = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(year) && year > 0 ? String(year) : null;
}

export function requiresRatingDeviation(stats: StatsData): GateResult {
  const valid = (stats.rated_films ?? []).filter((film) => getCommunityRating(film) !== null);
  if (valid.length < 5) {
    return gateFail(
      `rated_films absent or too few with community ratings (${valid.length} < 5).`,
      ['rated_films'],
    );
  }
  return gateOk();
}

export default function RatingDeviation({ stats }: { stats: StatsData }) {
  const gate = requiresRatingDeviation(stats);
  if (!gate.ok) return null;
  return <RatingDeviationInner stats={stats} />;
}

function RatingDeviationInner({ stats }: { stats: StatsData }) {
  const [tab, setTab] = useState<SubTab>('higher');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedFilm, setSelectedFilm] = useState<EnrichedFilm | null>(null);

  useEffect(() => {
    trackSectionViewed('rating_deviation');
  }, []);

  const { higher, lower } = useMemo<{ higher: EnrichedFilm[]; lower: EnrichedFilm[] }>(() => {
    type AllFilm = NonNullable<typeof stats.all_films>[0];
    const filmsByTitleYear = new Map<string, AllFilm>();
    const filmsByUniqueTitle = new Map<string, AllFilm | null>();
    (stats.all_films ?? []).forEach((film) => {
      const title = normalizedTitle(film.title);
      const year = normalizedYear(film.year);
      if (year) filmsByTitleYear.set(`${title}\u0000${year}`, film);
      filmsByUniqueTitle.set(title, filmsByUniqueTitle.has(title) ? null : film);
    });

    const films: EnrichedFilm[] = (stats.rated_films ?? []).flatMap((film) => {
      const rating = film.your_rating ?? film.rating;
      const communityRating = getCommunityRating(film);
      if (typeof rating !== 'number' || !Number.isFinite(rating) || communityRating === null) return [];

      const title = normalizedTitle(film.title);
      const year = normalizedYear(film.year);
      const enrichedData = year
        ? filmsByTitleYear.get(`${title}\u0000${year}`)
        : filmsByUniqueTitle.get(title) ?? undefined;
      return [{
        title: film.title,
        year: film.year,
        poster_path: film.poster_path || enrichedData?.poster_path,
        rating,
        communityRating,
        delta: Math.round((rating - communityRating) * 10) / 10,
        director: enrichedData?.director,
        runtime: enrichedData?.runtime,
        language: enrichedData?.language,
      }];
    });

    return {
      higher: films.filter((film) => film.delta > 0).sort((a, b) => b.delta - a.delta),
      lower: films.filter((film) => film.delta < 0).sort((a, b) => a.delta - b.delta),
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
        userAvg={0}
      />
      <section className="border-b border-[var(--results-border)] py-8 md:py-12">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="results-kicker mb-1">Taste signal</p>
              <h3 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--results-text)]">Your Rating Outliers</h3>
              <p className="mt-1 max-w-2xl text-sm text-[var(--results-muted)]">
                The films where your verdict moved furthest from the TMDB community average.
              </p>
            </div>
            <div className="results-segmented">
              <SubtabButton active={tab === 'higher'} color="green" onClick={() => handleTabChange('higher')}>
                You rated higher
              </SubtabButton>
              <SubtabButton active={tab === 'lower'} color="red" onClick={() => handleTabChange('lower')}>
                You rated lower
              </SubtabButton>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--results-border)] bg-[var(--results-border)] sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="bg-[var(--results-surface)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--results-text)]">How to read the evidence</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--results-muted)]">
                Difference = your rating minus that film&apos;s TMDB community average. Both scores use the same five-star scale.
              </p>
            </div>
            <div className="flex items-center bg-[var(--results-surface)] px-4 py-3 text-xs font-semibold text-[var(--results-muted)]">
              Example&nbsp; <span className="text-[var(--results-text)]">You 5.0★ − Community 3.2★</span>&nbsp;=&nbsp;<span style={{ color: LB_GREEN }}>You +1.8★</span>
            </div>
          </div>

          {shown.length === 0 && (
            <p className="py-8 text-center text-sm italic text-[#8d7f70]">
              {tab === 'higher' ? 'No films rated above the crowd.' : 'No films rated below the crowd.'}
            </p>
          )}

          {shown.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 md:gap-4">
              {shown.map((film) => (
                <FilmPosterCard
                  key={`${film.title}-${film.year}`}
                  film={film}
                  polarity={tab}
                  onOpenModal={(nextFilm) => {
                    setSelectedFilm(nextFilm);
                    trackItemClicked('rating_deviation', 'film');
                  }}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setVisible((value) => value + PAGE_SIZE);
                  trackShowMore('rating_deviation');
                }}
                className="rounded-full border border-[#f5d7a8]/[0.14] px-4 py-2 text-xs font-semibold text-[#b6a99a] transition-colors hover:border-[#ff8a3d]/50 hover:text-[#fff7ed]"
              >
                Show {Math.min(list.length - visible, PAGE_SIZE)} more
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FilmPosterCard({
  film,
  polarity,
  onOpenModal,
}: {
  film: EnrichedFilm;
  polarity: SubTab;
  onOpenModal?: (film: EnrichedFilm) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = film.poster_path ? getPosterUrl(film.poster_path, 'grid') : null;
  const deltaStr = formatDelta(film.delta);
  const deltaColor = polarity === 'higher' ? LB_GREEN : '#f87171';
  const showFallback = !imageUrl || imgFailed;

  return (
    <article className="group flex min-w-0 flex-col gap-2 text-left">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg ring-1 ring-white/8 transition-all group-hover:ring-white/20">
        {imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={film.title}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PosterImage src={showFallback ? null : imageUrl} alt={`${film.title} poster`} />
        )}

        <span
          className="absolute right-1.5 top-1.5 z-10 rounded-full px-2 py-1 text-xs font-bold shadow-lg"
          style={{ background: deltaColor, color: '#000', border: `1px solid ${deltaColor}` }}
        >
          You {deltaStr}★
        </span>

      </div>

      <div className="min-w-0 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--results-text)]">{film.title}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs leading-tight text-[var(--results-muted)]">
          <span>You <strong className="font-semibold text-[var(--results-text)]">{film.rating.toFixed(1)}★</strong></span>
          <span aria-hidden="true">·</span>
          <span>Community <strong className="font-semibold text-[var(--results-text)]">{film.communityRating.toFixed(1)}★</strong></span>
        </div>
        <button type="button" onClick={() => onOpenModal?.(film)} className="min-h-11 text-left text-xs font-semibold text-[var(--results-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--results-accent)]">View comparison</button>
      </div>
    </article>
  );
}

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
  const accent = color === 'green' ? LB_GREEN : '#f87171';
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] rounded-full px-3 py-1 text-xs font-semibold transition-colors"
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
