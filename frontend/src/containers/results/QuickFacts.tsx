'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Gauge, Globe, Languages, CalendarRange } from 'lucide-react';
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
    <Section title="Quick Facts" subtitle="Your viewing at a glance" animateMode="mount">
      <div className="grid gap-3">
        {/* Top row — stack vertically on phones, side-by-side from sm: up */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <motion.div
            className="flex items-center justify-between gap-2 bg-slate-800/40 border border-slate-700/40 rounded-xl px-3 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.3 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">avg runtime</span>
                <span className="text-xl font-black text-white leading-tight">
                  {Math.round(avgMinutes)}
                  <span className="text-xs font-medium text-slate-400 ml-1">min</span>
                </span>
              </div>
            </div>
            <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 font-medium">
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
                <Gauge className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">pace</span>
                  <span className="text-xl font-black text-white leading-tight">
                    {filmsPerWeek.toFixed(1)}
                    <span className="text-xs font-medium text-slate-400 ml-1">/week</span>
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 font-medium">
                {pace}
              </span>
            </div>
            {paceExplainer && (
              <p className="text-[10px] text-slate-500 leading-snug">{paceExplainer}</p>
            )}
          </motion.div>
        </div>

        {/* Bottom row — compact stat chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        </div>
      </div>
    </Section>
  );
}
