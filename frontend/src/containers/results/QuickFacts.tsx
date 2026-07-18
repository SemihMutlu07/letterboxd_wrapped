'use client';

import React from 'react';
import { Clock, Gauge, Globe, Languages, CalendarRange } from 'lucide-react';
import Section from '@/components/results/Section';
import ScrollPanel from '@/components/results/ScrollPanel';

interface QuickFactsProps {
  avgMinutes: number;
  totalCountries: number;
  filmsPerWeek: number;
  languageCount: number;
  decadeSpan: number;
  topCountry?: string;
  rewatchedCount?: number;
  /** Total films informing the pace number; rendered in the explainer. */
  totalFilms?: number;
  /** Window in days the pace number is averaged over. */
  paceWindowDays?: number;
  /** Whether the pace window came from real diary dates or a 365-day fallback. */
  paceWindowSource?: 'diary' | 'fallback';
  /** Films actually logged during the Letterboxd window (excludes lifetime backfill). */
  diaryFilmCount?: number;
  /** Total films marked as watched (lifetime, including pre-Letterboxd). */
  lifetimeFilmCount?: number;
}

function formatYears(days: number): string {
  if (days <= 0) return '<1 day';
  if (days < 60) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = days / 365;
  return years >= 2 ? `${years.toFixed(1)} years` : `${Math.round(days / 30)} months`;
}

function paceTier(filmsPerWeek: number): string {
  if (filmsPerWeek >= 10) return 'Binge Watcher';
  if (filmsPerWeek >= 5) return 'Dedicated';
  if (filmsPerWeek >= 2) return 'Regular';
  return 'Casual';
}

function runtimeTier(avgMinutes: number): string {
  if (avgMinutes >= 140) return 'Marathon Ready';
  if (avgMinutes >= 110) return 'Feature-Length';
  return 'Short & Sweet';
}

export default function QuickFacts({
  avgMinutes,
  totalCountries,
  filmsPerWeek,
  languageCount,
  decadeSpan,
  topCountry,
  totalFilms,
  paceWindowDays,
  paceWindowSource,
  diaryFilmCount,
  lifetimeFilmCount,
}: QuickFactsProps) {
  const pace = paceTier(filmsPerWeek);
  const runtimeLabel = runtimeTier(avgMinutes);

  const paceExplainer = (() => {
    if (!paceWindowDays) return null;
    const window = formatYears(paceWindowDays);
    // Prefer the diary-only count (films actually logged inside the Letterboxd
    // window). When that count is meaningfully smaller than the lifetime total,
    // surface both so users see that the pace is computed honestly.
    const diary = diaryFilmCount ?? 0;
    const lifetime = lifetimeFilmCount ?? totalFilms ?? 0;
    if (paceWindowSource === 'fallback') {
      return `${lifetime || diary} films / ${window} (no diary dates — using a 365-day estimate)`;
    }
    if (diary > 0 && lifetime > diary) {
      return `${diary} films logged across ${window} (${lifetime} lifetime watched)`;
    }
    if (diary > 0) {
      return `${diary} films logged across ${window} of Letterboxd activity`;
    }
    if (lifetime > 0) {
      return `${lifetime} films across ${window} of Letterboxd activity`;
    }
    return null;
  })();

  return (
    <Section title="Quick Facts" subtitle="Your viewing, annotated">
      <ScrollPanel className="grid gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
          <div className="results-stat flex min-w-0 flex-col justify-between gap-5 rounded-2xl sm:min-h-44">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 shrink-0 text-[var(--results-accent)]" />
                <span className="text-xs font-semibold text-[var(--results-text)]">Your viewing pace</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--results-muted)]">Primary signal</span>
            </div>
            <div>
              <span className="text-5xl font-semibold leading-none tracking-[-0.04em] text-[var(--results-text)]">
                {filmsPerWeek.toFixed(1)}
              </span>
              <span className="ml-2 text-sm font-medium text-[var(--results-muted)]">films / week</span>
              <p className="mt-2 text-sm font-semibold text-[var(--results-text)]">{pace}</p>
            </div>
            {paceExplainer && (
              <p className="border-t border-[var(--results-border)] pt-3 text-xs leading-relaxed text-[var(--results-muted)]">{paceExplainer}</p>
            )}
          </div>

          <div className="results-stat flex min-w-0 flex-col justify-between gap-5 rounded-2xl sm:min-h-44">
            <div className="flex items-center justify-between gap-3">
              <Clock className="h-5 w-5 shrink-0 text-slate-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--results-muted)]">Typical feature</span>
            </div>
            <div>
              <span className="text-4xl font-semibold leading-none tracking-[-0.03em] text-[var(--results-text)]">{Math.round(avgMinutes)}</span>
              <span className="ml-1 text-sm font-medium text-[var(--results-muted)]">minutes</span>
              <p className="mt-2 text-xs text-[var(--results-muted)]">{runtimeLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="results-stat flex min-w-0 flex-col justify-between gap-5 rounded-2xl">
            <div className="flex items-center justify-between"><Globe className="h-5 w-5 text-[var(--results-accent)]" /><span className="text-[10px] uppercase tracking-[0.16em] text-[var(--results-muted)]">Range</span></div>
            <div><span className="text-3xl font-semibold leading-none text-[var(--results-text)]">{totalCountries}</span><span className="ml-2 text-xs text-[var(--results-muted)]">countries explored</span>
              {topCountry && (
                <p className="mt-2 truncate text-xs text-[var(--results-muted)]">Most often: {topCountry}</p>
              )}
            </div>
          </div>

          <div className="results-stat flex min-w-0 flex-col justify-between gap-5 rounded-2xl">
            <div className="flex items-center justify-between"><Languages className="h-5 w-5 text-orange-400" /><span className="text-[10px] uppercase tracking-[0.16em] text-[var(--results-muted)]">Voices</span></div>
            <div><span className="text-3xl font-semibold leading-none text-[var(--results-text)]">{languageCount}</span><span className="ml-2 text-xs text-[var(--results-muted)]">{languageCount === 1 ? 'language heard' : 'languages heard'}</span></div>
          </div>

          <div className="results-stat flex min-w-0 flex-col justify-between gap-5 rounded-2xl">
            <div className="flex items-center justify-between"><CalendarRange className="h-5 w-5 text-[var(--results-accent)]" /><span className="text-[10px] uppercase tracking-[0.16em] text-[var(--results-muted)]">Time span</span></div>
            <div><span className="text-3xl font-semibold leading-none text-[var(--results-text)]">{decadeSpan}</span><span className="ml-2 text-xs text-[var(--results-muted)]">decades on screen</span></div>
          </div>
        </div>
      </ScrollPanel>
    </Section>
  );
}
