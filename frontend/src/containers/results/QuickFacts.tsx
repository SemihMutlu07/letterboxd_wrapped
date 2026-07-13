'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Gauge, Globe, Languages, CalendarRange, Trophy } from 'lucide-react';
import Section from '@/components/results/Section';

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
  /** Total points earned in the poster-guessing game shown during scraping. */
  posterGameScore?: number;
  /** Rounds played in the poster-guessing game; chip only renders when > 0. */
  posterGameRounds?: number;
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

/** Tailwind color trio (icon/label/badge) — pace gets livelier as it climbs. */
const PACE_COLORS: Record<string, { icon: string; label: string; badge: string }> = {
  'Binge Watcher': { icon: 'text-rose-400', label: 'text-rose-300/90', badge: 'bg-rose-500/15 text-rose-300' },
  Dedicated: { icon: 'text-amber-400', label: 'text-amber-300/90', badge: 'bg-amber-500/15 text-amber-300' },
  Regular: { icon: 'text-sky-400', label: 'text-sky-300/90', badge: 'bg-sky-500/15 text-sky-300' },
  Casual: { icon: 'text-slate-300', label: 'text-slate-300/90', badge: 'bg-slate-600/40 text-slate-200' },
};

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
  posterGameScore,
  posterGameRounds,
}: QuickFactsProps) {
  const pace = paceTier(filmsPerWeek);
  const paceColors = PACE_COLORS[pace];
  const runtimeLabel = runtimeTier(avgMinutes);
  const showPosterGame = !!posterGameRounds && posterGameRounds > 0;

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
    <Section title="Quick Facts" subtitle="Your viewing at a glance">
      <div className="grid gap-3">
        {/* Top row — stack vertically on phones, side-by-side from sm: up */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <motion.div
            className="flex items-center justify-between gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.3 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-5 h-5 text-orange-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-orange-300/90 font-medium">avg runtime</span>
                <span className="text-xl font-black text-white leading-tight">
                  {Math.round(avgMinutes)}
                  <span className="text-xs font-medium text-slate-300 ml-1">min</span>
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 font-medium">
              {runtimeLabel}
            </span>
          </motion.div>

          <motion.div
            className="flex flex-col gap-1 bg-slate-800/40 border border-slate-700/40 rounded-xl px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Gauge className={`w-5 h-5 shrink-0 ${paceColors.icon}`} />
                <div className="flex flex-col min-w-0">
                  <span className={`text-[10px] uppercase tracking-wider font-medium ${paceColors.label}`}>pace</span>
                  <span className="text-xl font-black text-white leading-tight">
                    {filmsPerWeek.toFixed(1)}
                    <span className="text-xs font-medium text-slate-300 ml-1">/week</span>
                  </span>
                </div>
              </div>
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${paceColors.badge}`}>
                {pace}
              </span>
            </div>
            {paceExplainer && (
              <p className="text-[10px] text-slate-300/80 leading-snug">{paceExplainer}</p>
            )}
          </motion.div>
        </div>

        {/* Bottom row — compact stat chips */}
        <div className={`grid grid-cols-1 gap-2 ${showPosterGame ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <motion.div
            className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/15 rounded-lg px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 text-xl font-black leading-none shrink-0">{totalCountries}</span>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[11px] uppercase tracking-wider text-emerald-300/80 font-medium">
                countries explored
              </span>
              {topCountry && (
                <span className="text-[10px] text-emerald-400/70 truncate">mostly {topCountry}</span>
              )}
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/15 rounded-lg px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <Languages className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-orange-400 text-xl font-black leading-none shrink-0">{languageCount}</span>
            <span className="text-[11px] uppercase tracking-wider text-orange-300/80 font-medium leading-tight">
              {languageCount === 1 ? 'language' : 'different languages'}
            </span>
          </motion.div>

          <motion.div
            className="flex items-center gap-3 bg-fuchsia-500/10 border border-fuchsia-500/15 rounded-lg px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <CalendarRange className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <span className="text-fuchsia-400 text-xl font-black leading-none shrink-0">{decadeSpan}</span>
            <span className="text-[11px] uppercase tracking-wider text-fuchsia-300/80 font-medium leading-tight">
              decades on screen
            </span>
          </motion.div>

          {showPosterGame && (
            <motion.div
              className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/15 rounded-lg px-3 py-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-400 text-xl font-black leading-none shrink-0">{posterGameScore ?? 0}</span>
              <span className="text-[11px] uppercase tracking-wider text-amber-300/80 font-medium leading-tight">
                poster game score
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </Section>
  );
}
